using System.Runtime.ExceptionServices;
using System.Threading.Channels;
using Ssmsx.Protocol.Messages;

namespace Ssmsx.Core.Query;

// SQL event handlers are synchronous. A single consumer preserves their order with
// result batches without blocking SqlClient or letting callback writes overlap.
internal sealed class QueryBatchStream : IAsyncDisposable
{
    internal const int Capacity = 1024;

    private readonly Channel<(QueryExecuteResult Batch, TaskCompletionSource? Receipt)> _channel =
        Channel.CreateBounded<(QueryExecuteResult, TaskCompletionSource?)>(
            new BoundedChannelOptions(Capacity)
            {
                SingleReader = true,
                AllowSynchronousContinuations = false,
                FullMode = BoundedChannelFullMode.Wait
            });
    private readonly Task _consumer;
    private Exception? _failure;

    public QueryBatchStream(Func<QueryExecuteResult, Task> onBatch)
    {
        _consumer = ConsumeAsync(onBatch);
    }

    public void Post(QueryExecuteResult batch)
    {
        if (!_channel.Writer.TryWrite((batch, null)))
        {
            // Blocking a SQL event handler can deadlock the reader. Fail explicitly
            // when output cannot keep up, rather than silently losing SQL messages.
            var failure = Volatile.Read(ref _failure);
            if (failure is not null)
                ExceptionDispatchInfo.Capture(failure).Throw();
            var error = new InvalidOperationException("Query output exceeded the pending message limit or the output stream closed.");
            Volatile.Write(ref _failure, error);
            _channel.Writer.TryComplete(error);
            throw error;
        }
    }

    public async Task SendAsync(QueryExecuteResult batch)
    {
        var receipt = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        try
        {
            await _channel.Writer.WriteAsync((batch, receipt));
            await receipt.Task;
        }
        catch (ChannelClosedException)
        {
            var failure = Volatile.Read(ref _failure);
            if (failure is not null)
                ExceptionDispatchInfo.Capture(failure).Throw();
            throw;
        }
    }

    private async Task ConsumeAsync(Func<QueryExecuteResult, Task> onBatch)
    {
        int batchNumber = 0;
        try
        {
            await foreach (var item in _channel.Reader.ReadAllAsync())
            {
                try
                {
                    await onBatch(item.Batch with { Batch = ++batchNumber });
                    item.Receipt?.SetResult();
                }
                catch (Exception ex)
                {
                    Volatile.Write(ref _failure, ex);
                    // Producers can resume as soon as their receipt faults.
                    // Close the writer first so they cannot enqueue into a failed stream.
                    _channel.Writer.TryComplete(ex);
                    item.Receipt?.SetException(ex);
                    throw;
                }
            }
        }
        catch (Exception ex)
        {
            Volatile.Write(ref _failure, ex);
            _channel.Writer.TryComplete(ex);
            while (_channel.Reader.TryRead(out var pending))
                pending.Receipt?.SetException(ex);
            throw;
        }
    }

    public ValueTask DisposeAsync() => CompleteAsync(null);

    public async ValueTask CompleteAsync(Exception? primaryError)
    {
        _channel.Writer.TryComplete();
        try
        {
            await _consumer;
        }
        catch (Exception outputError) when (primaryError is not null)
        {
            if (!ReferenceEquals(outputError, primaryError))
                Console.Error.WriteLine($"Query output failed while preserving the execution error: {outputError.Message}");
        }
    }
}
