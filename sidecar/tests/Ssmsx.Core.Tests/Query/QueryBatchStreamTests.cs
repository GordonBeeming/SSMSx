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
}
