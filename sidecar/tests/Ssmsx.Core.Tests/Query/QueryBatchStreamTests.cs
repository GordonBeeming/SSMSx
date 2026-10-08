using Ssmsx.Core.Query;
using Ssmsx.Protocol.Messages;
using Ssmsx.Protocol.Models;
using Xunit;

namespace Ssmsx.Core.Tests.Query;

public class QueryBatchStreamTests
{
    [Fact]
    public async Task StreamsMessagesBeforeCompletionAndSerializesRowsAndDone()
    {
        var batches = new List<QueryExecuteResult>();
        var firstMessage = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var stream = new QueryBatchStream(async batch =>
        {
            await Task.Yield();
            batches.Add(batch);
            firstMessage.TrySetResult();
        });
        stream.Post(new QueryExecuteResult { QueryId = "query", Messages = [new QueryMessage { Text = "Starting", Severity = "info" }] });
        await firstMessage.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Single(batches);
        Assert.False(batches[0].Done);
        await stream.SendAsync(new QueryExecuteResult { QueryId = "query", Rows = [[1]], ResultSetIndex = 0 });
        stream.Post(new QueryExecuteResult { QueryId = "query", Messages = [new QueryMessage { Text = "Finished", Severity = "info" }] });
        await stream.SendAsync(new QueryExecuteResult { QueryId = "query", Done = true });
        Assert.Equal([1, 2, 3, 4], batches.Select(batch => batch.Batch));
        Assert.Equal("Finished", batches[2].Messages?[0].Text);
        Assert.True(batches[3].Done);
    }

    [Fact]
    public async Task CallbackFailureFaultsSendAndDisposalWithoutHanging()
    {
        var stream = new QueryBatchStream(_ => Task.FromException(new IOException("Output closed")));
        await Assert.ThrowsAsync<IOException>(() => stream.SendAsync(new QueryExecuteResult { QueryId = "query" }).WaitAsync(TimeSpan.FromSeconds(5)));
        await Assert.ThrowsAsync<IOException>(() => stream.DisposeAsync().AsTask());
    }
    [Fact]
    public async Task OverflowFailsExplicitlyWithoutGrowingTheQueue()
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var stream = new QueryBatchStream(async _ =>
        {
            started.TrySetResult();
            await release.Task;
        });
        stream.Post(new QueryExecuteResult { QueryId = "query" });
        await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        try
        {
            for (var i = 0; i < QueryBatchStream.Capacity; i++)
                stream.Post(new QueryExecuteResult { QueryId = "query" });
            var error = Assert.Throws<InvalidOperationException>(() => stream.Post(new QueryExecuteResult { QueryId = "query" }));
            Assert.Contains("pending message limit", error.Message);
        }
        finally
        {
            release.TrySetResult();
        }
        await Assert.ThrowsAsync<InvalidOperationException>(() => stream.DisposeAsync().AsTask());
    }

    [Fact]
    public async Task CompletionPreservesThePrimaryExecutionException()
    {
        var primary = new InvalidOperationException("Original SQL diagnostic");
        async Task ExecuteAsync()
        {
            var stream = new QueryBatchStream(_ => Task.FromException(new IOException("Output closed")));
            stream.Post(new QueryExecuteResult { QueryId = "query" });
            try
            {
                throw primary;
            }
            finally
            {
                await stream.CompleteAsync(primary);
            }
        }
        var error = await Assert.ThrowsAsync<InvalidOperationException>(ExecuteAsync);
        Assert.Same(primary, error);
    }

    [Fact]
    public async Task ProducersPreserveAnEarlierOutputFailure()
    {
        var outputError = new IOException("Output pipe closed");
        var stream = new QueryBatchStream(_ => Task.FromException(outputError));
        await Assert.ThrowsAsync<IOException>(() => stream.SendAsync(new QueryExecuteResult { QueryId = "query" }));
        var error = Assert.Throws<IOException>(() => stream.Post(new QueryExecuteResult { QueryId = "query" }));
        Assert.Same(outputError, error);
        var sendError = await Assert.ThrowsAsync<IOException>(() => stream.SendAsync(new QueryExecuteResult { QueryId = "query" }));
        Assert.Same(outputError, sendError);
        await stream.CompleteAsync(outputError);
    }

    [Fact]
    public async Task BlockedProducerReceivesTheOriginalOutputFailure()
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var outputError = new IOException("Output pipe closed");
        var stream = new QueryBatchStream(async _ =>
        {
            started.TrySetResult();
            await release.Task;
            throw outputError;
        });
        stream.Post(new QueryExecuteResult { QueryId = "query" });
        await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        for (var i = 0; i < QueryBatchStream.Capacity; i++)
            stream.Post(new QueryExecuteResult { QueryId = "query" });
        var blocked = stream.SendAsync(new QueryExecuteResult { QueryId = "query" });
        release.TrySetResult();
        var error = await Assert.ThrowsAsync<IOException>(() => blocked.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.Same(outputError, error);
        await stream.CompleteAsync(outputError);
    }

}
