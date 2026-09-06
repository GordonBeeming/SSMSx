using Microsoft.Data.SqlClient;
using Ssmsx.Core.Query;
using Xunit;

namespace Ssmsx.Core.Tests.Query;

public sealed class QueryCancellationManagerTests
{
    [Fact]
    public void Register_RejectsDuplicateQueryIdWithoutReplacingOriginalState()
    {
        var manager = new QueryCancellationManager();
        using var original = new CancellationTokenSource();
        using var duplicate = new CancellationTokenSource();
        manager.Register("query-1", original);

        Assert.Throws<InvalidOperationException>(() => manager.Register("query-1", duplicate));
        Assert.True(manager.Cancel("query-1"));
        Assert.True(original.IsCancellationRequested);
        Assert.False(duplicate.IsCancellationRequested);

        manager.Remove("query-1");
    }

    [Fact]
    public void RemoveAfterDuplicateRegistrationFailure_CleansUpOriginalStateForReuse()
    {
        var manager = new QueryCancellationManager();
        using var original = new CancellationTokenSource();
        using var duplicate = new CancellationTokenSource();
        using var replacement = new CancellationTokenSource();
        manager.Register("query-1", original);

        Assert.Throws<InvalidOperationException>(() => manager.Register("query-1", duplicate));

        manager.Remove("query-1");
        manager.Register("query-1", replacement);

        Assert.True(manager.Cancel("query-1"));
        Assert.True(replacement.IsCancellationRequested);
        manager.Remove("query-1");
    }

    [Fact]
    public void CancelBeforeSetCommand_CancelsTokenAndAcceptsLateCommand()
    {
        var manager = new QueryCancellationManager();
        var cancellation = new CancellationTokenSource();
        using var command = new SqlCommand();
        manager.Register("query-1", cancellation);

        Assert.True(manager.Cancel("query-1"));
        manager.SetCommand("query-1", command);

        Assert.True(cancellation.IsCancellationRequested);
        manager.Remove("query-1");
    }

    [Fact]
    public async Task CancelAndSetCommand_AreSafeWhenTheyRace()
    {
        var manager = new QueryCancellationManager();

        for (var index = 0; index < 100; index++)
        {
            var queryId = $"query-{index}";
            var cancellation = new CancellationTokenSource();
            using var command = new SqlCommand();
            manager.Register(queryId, cancellation);

            await Task.WhenAll(
                Task.Run(() => manager.Cancel(queryId)),
                Task.Run(() => manager.SetCommand(queryId, command)));

            Assert.True(cancellation.IsCancellationRequested);
            manager.Remove(queryId);
        }
    }
}
