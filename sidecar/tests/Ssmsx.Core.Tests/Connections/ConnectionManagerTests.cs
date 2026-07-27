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
        var factory = new FakeSqlConnectionFactory(async () =>
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

    private sealed class FakeSqlConnectionFactory(
        Func<Task<SqlConnection>> create) : SqlConnectionFactory
    {
        public override Task<SqlConnection> CreateAsync(
            ConnectionInfo info,
            ICredentialStore credentialStore,
            string? inlinePassword = null,
            CancellationToken ct = default) => create();
    }

    private sealed class FakeCredentialStore : ICredentialStore
    {
        public Task StoreAsync(string key, string secret) => Task.CompletedTask;

        public Task<string?> RetrieveAsync(string key) => Task.FromResult<string?>(null);

        public Task DeleteAsync(string key) => Task.CompletedTask;
    }
}
