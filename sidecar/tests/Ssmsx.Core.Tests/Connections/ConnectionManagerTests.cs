using Microsoft.Data.SqlClient;
using Ssmsx.Core.Connections;
using Ssmsx.Core.Credentials;
using Ssmsx.Core.Storage;
using Ssmsx.Protocol.Models;
using Xunit;

namespace Ssmsx.Core.Tests.Connections;

public sealed class ConnectionManagerTests : IDisposable
{
    private readonly string _tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, recursive: true);
    }

    [Fact]
    public async Task ConnectAsync_DisposesOpenedConnection_WhenSavedConnectionWasDeleted()
    {
        var store = new ConnectionStore(_tempDir);
        var info = await store.SaveAsync(new ConnectionInfo
        {
            Id = "deleted-during-open",
            ServerName = "server.example.com"
        });
        var openedConnection = new SqlConnection();
        var disposed = false;
        openedConnection.Disposed += (_, _) => disposed = true;
        var factory = new FakeSqlConnectionFactory(async (_, _, _) =>
        {
            Assert.True(await store.DeleteAsync(info.Id));
            return openedConnection;
        });
        var manager = new ConnectionManager(factory);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            manager.ConnectAsync(info.Id, store, new FakeCredentialStore()));

        Assert.Contains("deleted while it was opening", error.Message);
        Assert.True(disposed);
        Assert.Throws<InvalidOperationException>(() => manager.GetConnection(info.Id));
    }

    [Fact]
    public async Task CreateQueryConnectionAsync_ReusesActiveProfileAndCredentialContext()
    {
        var store = new ConnectionStore(_tempDir);
        var info = await store.SaveAsync(new ConnectionInfo
        {
            Id = "query-session",
            ServerName = "server.example.com",
            CredentialRef = "ssmsx/query-session"
        });
        var credentialStore = new FakeCredentialStore();
        var primaryConnection = new SqlConnection();
        var queryConnection = new SqlConnection();
        var calls = new List<(ConnectionInfo Info, ICredentialStore CredentialStore)>();
        var factory = new FakeSqlConnectionFactory((receivedInfo, receivedCredentialStore, _) =>
        {
            calls.Add((receivedInfo, receivedCredentialStore));
            return Task.FromResult(calls.Count == 1 ? primaryConnection : queryConnection);
        });
        var manager = new ConnectionManager(factory);

        await manager.ConnectAsync(info.Id, store, credentialStore);
        var created = await manager.CreateQueryConnectionAsync(info.Id);

        Assert.Same(queryConnection, created);
        Assert.Equal(2, calls.Count);
        Assert.Equal(info.Id, calls[1].Info.Id);
        Assert.Same(credentialStore, calls[1].CredentialStore);

        await created.DisposeAsync();
        await manager.DisconnectAsync(info.Id);
    }

    [Fact]
    public async Task CreateQueryConnectionAsync_RejectsConnectionReplacedDuringOpen()
    {
        var store = new ConnectionStore(_tempDir);
        var info = await store.SaveAsync(new ConnectionInfo
        {
            Id = "replaced-during-open",
            ServerName = "server.example.com"
        });
        var credentialStore = new FakeCredentialStore();
        var primaryConnection = new SqlConnection();
        var pendingQueryConnection = new SqlConnection();
        var queryConnectionDisposed = false;
        pendingQueryConnection.Disposed += (_, _) => queryConnectionDisposed = true;
        var replacementConnection = new SqlConnection();
        var queryOpenStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseQueryOpen = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var callCount = 0;
        var factory = new FakeSqlConnectionFactory(async (_, _, _) =>
        {
            var call = Interlocked.Increment(ref callCount);
            if (call == 1)
                return primaryConnection;
            if (call == 2)
            {
                queryOpenStarted.SetResult();
                await releaseQueryOpen.Task;
                return pendingQueryConnection;
            }

            return replacementConnection;
        });
        var manager = new ConnectionManager(factory);
        await manager.ConnectAsync(info.Id, store, credentialStore);

        var pendingQuery = manager.CreateQueryConnectionAsync(info.Id);
        await queryOpenStarted.Task;
        await manager.ConnectAsync(info.Id, store, credentialStore);
        releaseQueryOpen.SetResult();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => pendingQuery);
        Assert.Contains("changed while the query session was opening", error.Message);
        Assert.Same(replacementConnection, manager.GetConnection(info.Id));
        Assert.True(queryConnectionDisposed);

        await manager.DisconnectAsync(info.Id);
    }

    private sealed class FakeSqlConnectionFactory(
        Func<ConnectionInfo, ICredentialStore, CancellationToken, Task<SqlConnection>> create) : SqlConnectionFactory
    {
        public override Task<SqlConnection> CreateAsync(
            ConnectionInfo info,
            ICredentialStore credentialStore,
            string? inlinePassword = null,
            CancellationToken ct = default) => create(info, credentialStore, ct);
    }

    private sealed class FakeCredentialStore : ICredentialStore
    {
        public Task StoreAsync(string key, string secret) => Task.CompletedTask;

        public Task<string?> RetrieveAsync(string key) => Task.FromResult<string?>(null);

        public Task DeleteAsync(string key) => Task.CompletedTask;
    }
}
