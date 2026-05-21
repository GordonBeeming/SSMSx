using Ssmsx.Core.Storage;
using Ssmsx.Protocol.Models;
using Xunit;

namespace Ssmsx.Core.Tests.Storage;

public class ConnectionStoreTests : IDisposable
{
    private readonly string _tempDir;
    private readonly ConnectionStore _store;

    public ConnectionStoreTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        _store = new ConnectionStore(_tempDir);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
            Directory.Delete(_tempDir, true);
    }

    [Fact]
    public async Task ListAsync_EmptyStore_ReturnsEmptyList()
    {
        var result = await _store.ListAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task SaveAsync_And_GetAsync_RoundTrip()
    {
        var connection = new ConnectionInfo
        {
            Id = "test-1",
            Name = "Test Server",
            ServerName = "localhost",
            AuthType = AuthType.SqlAuth,
            Username = "sa",
            CredentialRef = "cred-ref-1",
            Database = "master",
            Encrypt = EncryptMode.Mandatory,
            TrustServerCertificate = true,
            Color = "#FF0000",
            LastUsed = new DateTime(2026, 1, 15, 10, 30, 0, DateTimeKind.Utc),
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        await _store.SaveAsync(connection);
        var retrieved = await _store.GetAsync("test-1");

        Assert.NotNull(retrieved);
        Assert.Equal("test-1", retrieved.Id);
        Assert.Equal("Test Server", retrieved.Name);
        Assert.Equal("localhost", retrieved.ServerName);
        Assert.Equal(AuthType.SqlAuth, retrieved.AuthType);
        Assert.Equal("sa", retrieved.Username);
        Assert.Equal("cred-ref-1", retrieved.CredentialRef);
        Assert.Equal("master", retrieved.Database);
        Assert.Equal(EncryptMode.Mandatory, retrieved.Encrypt);
        Assert.True(retrieved.TrustServerCertificate);
        Assert.Equal("#FF0000", retrieved.Color);
        Assert.Equal(new DateTime(2026, 1, 15, 10, 30, 0, DateTimeKind.Utc), retrieved.LastUsed);
        Assert.Equal(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), retrieved.CreatedAt);
    }

    [Fact]
    public async Task SaveAsync_Upserts_ExistingConnection()
    {
        var connection = new ConnectionInfo
        {
            Id = "test-1",
            Name = "Original Name",
            ServerName = "localhost"
        };

        await _store.SaveAsync(connection);

        var updated = connection with { Name = "Updated Name" };
        await _store.SaveAsync(updated);

        var result = await _store.ListAsync();
        Assert.Single(result);
        Assert.Equal("Updated Name", result[0].Name);
    }

    [Fact]
    public async Task SaveAsync_ReusesExistingConnection_WhenDetailsMatch()
    {
        var createdAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var existing = new ConnectionInfo
        {
            Id = "existing",
            Name = "Original",
            ServerName = "127.0.0.1,4242",
            AuthType = AuthType.ConnectionString,
            Username = "sa",
            Database = "AdventureWorks2022",
            Encrypt = EncryptMode.Optional,
            TrustServerCertificate = true,
            ConnectionString = "Server=127.0.0.1,4242;Database=AdventureWorks2022;User Id=sa;Password=one;Encrypt=Optional;TrustServerCertificate=True;",
            CreatedAt = createdAt,
            CredentialRef = "ssmsx/existing"
        };
        var duplicate = existing with
        {
            Id = "duplicate",
            Name = "Duplicate",
            ConnectionString = "Data Source=127.0.0.1,4242;Initial Catalog=AdventureWorks2022;UID=sa;PWD=two;Trust Server Certificate=True;Encrypt=Optional;",
            LastUsed = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc)
        };

        await _store.SaveAsync(existing);
        var saved = await _store.SaveAsync(duplicate);

        var result = await _store.ListAsync();
        Assert.Single(result);
        Assert.Equal("existing", saved.Id);
        Assert.Equal("existing", result[0].Id);
        Assert.Equal("Duplicate", result[0].Name);
        Assert.Equal("ssmsx/existing", result[0].CredentialRef);
        Assert.Equal(createdAt, result[0].CreatedAt);
        Assert.Equal(duplicate.LastUsed, result[0].LastUsed);
    }

    [Fact]
    public async Task ListAsync_ReturnsSortedByLastUsedDescending()
    {
        var oldest = new ConnectionInfo
        {
            Id = "old",
            ServerName = "old-server",
            LastUsed = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        var newest = new ConnectionInfo
        {
            Id = "new",
            ServerName = "new-server",
            LastUsed = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        var middle = new ConnectionInfo
        {
            Id = "mid",
            ServerName = "mid-server",
            LastUsed = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        await _store.SaveAsync(oldest);
        await _store.SaveAsync(middle);
        await _store.SaveAsync(newest);

        var result = await _store.ListAsync();

        Assert.Equal(3, result.Count);
        Assert.Equal("new", result[0].Id);
        Assert.Equal("mid", result[1].Id);
        Assert.Equal("old", result[2].Id);
    }

    [Fact]
    public async Task DeleteAsync_RemovesConnection_ReturnsTrue()
    {
        var connection = new ConnectionInfo
        {
            Id = "to-delete",
            ServerName = "localhost"
        };

        await _store.SaveAsync(connection);
        var deleted = await _store.DeleteAsync("to-delete");

        Assert.True(deleted);
        Assert.Null(await _store.GetAsync("to-delete"));
        Assert.Empty(await _store.ListAsync());
    }

    [Fact]
    public async Task DeleteAsync_NonExistent_ReturnsFalse()
    {
        var result = await _store.DeleteAsync("does-not-exist");

        Assert.False(result);
    }

    [Fact]
    public async Task GetAsync_NonExistent_ReturnsNull()
    {
        var result = await _store.GetAsync("does-not-exist");

        Assert.Null(result);
    }

    [Fact]
    public async Task MultipleSaves_And_List()
    {
        for (int i = 0; i < 5; i++)
        {
            await _store.SaveAsync(new ConnectionInfo
            {
                Id = $"conn-{i}",
                ServerName = $"server-{i}",
                LastUsed = new DateTime(2026, 1, 1 + i, 0, 0, 0, DateTimeKind.Utc)
            });
        }

        var result = await _store.ListAsync();

        Assert.Equal(5, result.Count);
        // Verify descending order
        Assert.Equal("conn-4", result[0].Id);
        Assert.Equal("conn-0", result[4].Id);
    }
}
