using System.Threading.Channels;
using Ssmsx.Protocol.Messages;

namespace Ssmsx.Core.Query;

// SQL event handlers are synchronous. A single consumer preserves their order with
// result batches without blocking SqlClient or letting callback writes overlap.
internal sealed class QueryBatchStream : IAsyncDisposable
{
    private readonly Channel<(QueryExecuteResult Batch, TaskCompletionSource? Receipt)> _channel =
        Channel.CreateUnbounded<(QueryExecuteResult, TaskCompletionSource?)>(
            new UnboundedChannelOptions { SingleReader = true, AllowSynchronousContinuations = false });
    private readonly Task _consumer;

    public QueryBatchStream(Func<QueryExecuteResult, Task> onBatch)
    {
        _consumer = ConsumeAsync(onBatch);
    }

    public void Post(QueryExecuteResult batch)
    {
        if (!_channel.Writer.TryWrite((batch, null)))
            throw new InvalidOperationException("Query result stream is closed.");
    }

    public async Task SendAsync(QueryExecuteResult batch)
    {
        var receipt = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await _channel.Writer.WriteAsync((batch, receipt));
        await receipt.Task;
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
                    item.Receipt?.SetException(ex);
                    throw;
                }
            }
        }
        catch (Exception ex)
        {
            _channel.Writer.TryComplete(ex);
            while (_channel.Reader.TryRead(out var pending))
                pending.Receipt?.SetException(ex);
            throw;
        }
    }

    public async ValueTask DisposeAsync()
    {
        _channel.Writer.TryComplete();
        await _consumer;
    }
}
