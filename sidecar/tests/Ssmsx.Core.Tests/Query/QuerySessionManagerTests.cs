using Microsoft.Data.SqlClient;
using Ssmsx.Core.Query;
using Xunit;

namespace Ssmsx.Core.Tests.Query;

public sealed class QuerySessionManagerTests
{
    [Fact]
    public async Task AcquireAsync_ReusesConnectionWithinSession()
    {
        var openedConnections = new List<SqlConnection>();
        await using var manager = CreateManager(openedConnections);

        SqlConnection firstConnection;
        await using (var first = await manager.AcquireAsync("tab-1", "connection-1"))
            firstConnection = first.Connection;

        await using var second = await manager.AcquireAsync("tab-1", "connection-1");

        Assert.Same(firstConnection, second.Connection);
        Assert.Single(openedConnections);
    }

    [Fact]
    public async Task AcquireAsync_UsesIndependentConnectionsForDifferentSessions()
    {
        var openedConnections = new List<SqlConnection>();
        await using var manager = CreateManager(openedConnections);

        await using var first = await manager.AcquireAsync("tab-1", "connection-1");
        await using var second = await manager.AcquireAsync("tab-2", "connection-1");

        Assert.NotSame(first.Connection, second.Connection);
        Assert.Equal(2, openedConnections.Count);
    }

    [Fact]
    public async Task AcquireAsync_RejectsOverlappingExecutionWithinSession()
    {
        var openedConnections = new List<SqlConnection>();
        await using var manager = CreateManager(openedConnections);
        await using var first = await manager.AcquireAsync("tab-1", "connection-1");

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            manager.AcquireAsync("tab-1", "connection-1"));

        Assert.Contains("already executing", error.Message);
        Assert.Single(openedConnections);
    }

    [Fact]
    public async Task AcquireAsync_ReplacesRetargetedSessionAndIgnoresStaleClose()
    {
        var openedConnections = new List<SqlConnection>();
        await using var manager = CreateManager(openedConnections);

        SqlConnection oldConnection;
        await using (var first = await manager.AcquireAsync("tab-1", "connection-old"))
            oldConnection = first.Connection;

        var oldDisposed = false;
        oldConnection.Disposed += (_, _) => oldDisposed = true;

        await using (var replacement = await manager.AcquireAsync("tab-1", "connection-new"))
        {
            Assert.NotSame(oldConnection, replacement.Connection);
        }

        Assert.True(oldDisposed);
        Assert.False(await manager.CloseSessionAsync("tab-1", "connection-old"));

        await using var current = await manager.AcquireAsync("tab-1", "connection-new");
        Assert.Same(openedConnections[1], current.Connection);
    }

    [Fact]
    public async Task CloseSessionAsync_CancelsExecutionAndDisposesConnection()
    {
        var openedConnections = new List<SqlConnection>();
        await using var manager = CreateManager(openedConnections);
        var lease = await manager.AcquireAsync("tab-1", "connection-1");
        var connectionDisposed = false;
        lease.Connection.Disposed += (_, _) => connectionDisposed = true;

        Assert.True(await manager.CloseSessionAsync("tab-1", "connection-1"));

        Assert.True(lease.CancellationToken.IsCancellationRequested);
        Assert.True(connectionDisposed);
        await lease.DisposeAsync();
    }

    [Fact]
    public async Task CloseConnectionSessionsAsync_ClosesOnlyMatchingSessions()
    {
        var openedConnections = new List<SqlConnection>();
        await using var manager = CreateManager(openedConnections);

        await using (var first = await manager.AcquireAsync("tab-1", "connection-1")) { }
        await using (var second = await manager.AcquireAsync("tab-2", "connection-1")) { }
        await using (var other = await manager.AcquireAsync("tab-3", "connection-2")) { }

        var matchingDisposed = new[] { false, false };
        openedConnections[0].Disposed += (_, _) => matchingDisposed[0] = true;
        openedConnections[1].Disposed += (_, _) => matchingDisposed[1] = true;

        Assert.Equal(2, await manager.CloseConnectionSessionsAsync("connection-1"));
        Assert.All(matchingDisposed, Assert.True);

        await using var retained = await manager.AcquireAsync("tab-3", "connection-2");
        Assert.Same(openedConnections[2], retained.Connection);
    }

    [Fact]
    public async Task BrokenSession_IsUnpublishedBeforeAConcurrentNextExecution()
    {
        var openedConnections = new List<SqlConnection>();
        await using var manager = CreateManager(openedConnections);

        var first = await manager.AcquireAsync("tab-1", "connection-1");
        var firstConnection = first.Connection;
        first.MarkBroken();
        var release = first.DisposeAsync().AsTask();

        await using var second = await manager.AcquireAsync("tab-1", "connection-1");
        await release;

        Assert.NotSame(firstConnection, second.Connection);
        Assert.Equal(2, openedConnections.Count);
    }

    [Fact]
    public async Task FailedConnectionOpen_IsEvictedBeforeRetry()
    {
        var attempts = 0;
        await using var manager = new QuerySessionManager((_, _) =>
        {
            attempts++;
            return attempts == 1
                ? Task.FromException<SqlConnection>(new InvalidOperationException("open failed"))
                : Task.FromResult(new SqlConnection());
        });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            manager.AcquireAsync("tab-1", "connection-1"));

        await using var retry = await manager.AcquireAsync("tab-1", "connection-1");
        Assert.Equal(2, attempts);
    }

    private static QuerySessionManager CreateManager(List<SqlConnection> openedConnections) =>
        new((_, _) =>
        {
            var connection = new SqlConnection();
            openedConnections.Add(connection);
            return Task.FromResult(connection);
        });
}
