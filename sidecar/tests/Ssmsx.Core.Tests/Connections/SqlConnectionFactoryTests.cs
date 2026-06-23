using Microsoft.Data.SqlClient;
using Ssmsx.Core.Connections;
using Ssmsx.Core.Credentials;
using Ssmsx.Protocol.Models;
using Xunit;

namespace Ssmsx.Core.Tests.Connections;

public class SqlConnectionFactoryTests
{
    private readonly SqlConnectionFactory _factory = new();

    [Fact]
    public async Task CreateAsync_ConnectionStringAuth_RequiresConnectionString()
    {
        var info = new ConnectionInfo
        {
            ServerName = "localhost",
            AuthType = AuthType.ConnectionString,
            ConnectionString = null
        };

        var store = new FakeCredentialStore();

        await Assert.ThrowsAsync<ArgumentException>(
            () => _factory.CreateAsync(info, store));
    }

    [Fact]
    public async Task CreateAsync_SqlAuth_NoPasswordAvailable_ThrowsInvalidOperation()
    {
        var info = new ConnectionInfo
        {
            ServerName = "localhost",
            AuthType = AuthType.SqlAuth,
            Username = "sa",
            CredentialRef = null
        };

        var store = new FakeCredentialStore();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _factory.CreateAsync(info, store));
    }

    [Fact]
    public async Task CreateAsync_SqlAuth_NullUsername_ThrowsArgumentException()
    {
        var info = new ConnectionInfo
        {
            ServerName = "localhost",
            AuthType = AuthType.SqlAuth,
            Username = null,
            CredentialRef = "cred-1"
        };

        var store = new FakeCredentialStore();
        store.Store("cred-1", "password123");

        await Assert.ThrowsAsync<ArgumentException>(
            () => _factory.CreateAsync(info, store));
    }

    [Fact]
    public void BuildEntraMfaConnectionString_UsesSqlClientInteractiveAuthentication()
    {
        var info = new ConnectionInfo
        {
            ServerName = "demo.database.windows.net",
            AuthType = AuthType.EntraMfa,
            Username = "user@example.com",
            Database = "testdb",
            Encrypt = EncryptMode.Mandatory
        };

        var connectionString = SqlConnectionFactory.BuildEntraMfaConnectionString(info);

        var builder = new SqlConnectionStringBuilder(connectionString);
        Assert.Equal(SqlAuthenticationMethod.ActiveDirectoryInteractive, builder.Authentication);
        Assert.Equal("user@example.com", builder.UserID);
        Assert.Equal("testdb", builder.InitialCatalog);
        Assert.Equal("demo.database.windows.net", builder.DataSource);
    }

    private class FakeCredentialStore : ICredentialStore
    {
        private readonly Dictionary<string, string> _store = new();

        public void Store(string key, string secret) => _store[key] = secret;

        public Task StoreAsync(string key, string secret)
        {
            _store[key] = secret;
            return Task.CompletedTask;
        }

        public Task<string?> RetrieveAsync(string key)
        {
            _store.TryGetValue(key, out var value);
            return Task.FromResult(value);
        }

        public Task DeleteAsync(string key)
        {
            _store.Remove(key);
            return Task.CompletedTask;
        }
    }
}
