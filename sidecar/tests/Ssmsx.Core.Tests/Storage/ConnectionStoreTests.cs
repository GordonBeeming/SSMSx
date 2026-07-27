using System.Text.Json;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Runtime.Versioning;
using Ssmsx.Protocol;
using Ssmsx.Core.Storage;
using Ssmsx.Protocol.Models;
using Xunit;

namespace Ssmsx.Core.Tests.Storage;

public class ConnectionStoreTests : IDisposable
{
    private readonly string _tempDir;
    private readonly ConnectionStore _store;
    private string FilePath => Path.Combine(_tempDir, "connections.json");

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
        Assert.Null(retrieved.Color);
        Assert.Equal("red", retrieved.ColorProfileId);
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

        var updated = connection with { Name = "Updated Name", ColorProfileId = "blue" };
        await _store.SaveAsync(updated);

        var result = await _store.ListAsync();
        Assert.Single(result);
        Assert.Equal("Updated Name", result[0].Name);
        Assert.Equal("blue", result[0].ColorProfileId);
        Assert.Null(result[0].Color);
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

    [Fact]
    public async Task SaveAsync_BlankAlias_RemainsBlankForUiFallback()
    {
        var saved = await _store.SaveAsync(new ConnectionInfo
        {
            ServerName = "server-name",
            Name = "   "
        });

        Assert.Equal("   ", saved.Name);
        Assert.NotEqual(saved.ServerName, saved.Name);
    }

    [Fact]
    public async Task SaveAsync_NullColor_DefaultsToRed()
    {
        var saved = await _store.SaveAsync(new ConnectionInfo
        {
            ServerName = "localhost",
            Color = null
        });

        Assert.Equal("red", saved.ColorProfileId);
        Assert.Null(saved.Color);
    }

    [Theory]
    [InlineData("#22c55e", "green")]
    [InlineData("#166534", "green")]
    [InlineData("#16a34a", "green")]
    [InlineData("#ef4444", "red")]
    [InlineData("#FF0000", "red")]
    [InlineData("#991B1B", "red")]
    [InlineData("#dc2626", "red")]
    [InlineData("#3b82f6", "blue")]
    [InlineData("#1D4ED8", "blue")]
    [InlineData("#0063B2", "blue")]
    [InlineData("#eab308", "amber")]
    [InlineData("#f97316", "amber")]
    [InlineData("#92400E", "amber")]
    [InlineData("#d97706", "amber")]
    [InlineData("#a855f7", "violet")]
    [InlineData("#6D28D9", "violet")]
    [InlineData("#7c3aed", "violet")]
    [InlineData("#334155", "slate")]
    [InlineData("#555555", "slate")]
    public async Task SaveAsync_MapsRecognizedLegacyColors(string color, string expectedProfileId)
    {
        var saved = await _store.SaveAsync(new ConnectionInfo
        {
            ServerName = "localhost",
            Color = color
        });

        Assert.Equal(expectedProfileId, saved.ColorProfileId);
        Assert.Null(saved.Color);
    }

    [Fact]
    public async Task SaveAsync_UnknownLegacyColor_DefaultsToRed()
    {
        var saved = await _store.SaveAsync(new ConnectionInfo
        {
            ServerName = "localhost",
            Color = "#123456"
        });

        Assert.Equal("red", saved.ColorProfileId);
        Assert.Null(saved.Color);
    }

    [Fact]
    public async Task SaveAsync_PreservesExplicitProfileAndClearsLegacyColor()
    {
        var saved = await _store.SaveAsync(new ConnectionInfo
        {
            ServerName = "localhost",
            Color = "#123456",
            ColorProfileId = "custom-night"
        });

        Assert.Equal("custom-night", saved.ColorProfileId);
        Assert.Null(saved.Color);
        var canonicalJson = await File.ReadAllTextAsync(FilePath);
        Assert.Contains("\"colorProfileId\":\"custom-night\"", canonicalJson);
        Assert.DoesNotContain("\"color\":", canonicalJson);
    }

    [Fact]
    public async Task ListAsync_RewritesLegacyJsonOnce()
    {
        const string legacyJson = """
            [{"id":"legacy","name":null,"serverName":"localhost","authType":"SqlAuth","encrypt":"Mandatory","trustServerCertificate":false,"color":null,"createdAt":"2026-01-01T00:00:00Z"}]
            """;
        await File.WriteAllTextAsync(FilePath, legacyJson);

        var firstRead = await _store.ListAsync();

        var connection = Assert.Single(firstRead);
        Assert.Null(connection.Name);
        Assert.Equal("red", connection.ColorProfileId);
        Assert.Null(connection.Color);

        var canonicalJson = await File.ReadAllTextAsync(FilePath);
        Assert.Contains("\"colorProfileId\":\"red\"", canonicalJson);
        Assert.DoesNotContain("\"color\":", canonicalJson);

        var marker = new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        File.SetLastWriteTimeUtc(FilePath, marker);

        var secondRead = await _store.ListAsync();

        Assert.Single(secondRead);
        Assert.Equal(marker, File.GetLastWriteTimeUtc(FilePath));
    }

    [Fact]
    public async Task SaveAsync_DeduplicationKeepsIdentityCredentialsAndNewestNonblankAppearance()
    {
        var createdAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var existing = new ConnectionInfo
        {
            Id = "existing",
            Name = "Original",
            ServerName = "localhost",
            CredentialRef = "ssmsx/existing",
            ColorProfileId = "blue",
            CreatedAt = createdAt,
            LastUsed = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc)
        };
        var newer = existing with
        {
            Id = "newer",
            Name = "Preferred",
            CredentialRef = null,
            ColorProfileId = "violet",
            CreatedAt = createdAt.AddDays(1),
            LastUsed = new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc)
        };
        var newestBlank = existing with
        {
            Id = "newest-blank",
            Name = "   ",
            CredentialRef = null,
            ColorProfileId = "   ",
            CreatedAt = createdAt.AddDays(2),
            LastUsed = new DateTime(2026, 1, 4, 0, 0, 0, DateTimeKind.Utc)
        };

        await _store.SaveAsync(existing);
        await _store.SaveAsync(newer);
        var saved = await _store.SaveAsync(newestBlank);

        var connection = Assert.Single(await _store.ListAsync());
        Assert.Equal("existing", saved.Id);
        Assert.Equal("existing", connection.Id);
        Assert.Equal("ssmsx/existing", connection.CredentialRef);
        Assert.Equal(createdAt, connection.CreatedAt);
        Assert.Equal(newestBlank.LastUsed, connection.LastUsed);
        Assert.Equal("Preferred", connection.Name);
        Assert.Equal("violet", connection.ColorProfileId);
        Assert.Null(connection.Color);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task SaveAsync_SameId_AllowsAliasToBeCleared(string? alias)
    {
        var existing = new ConnectionInfo
        {
            Id = "existing",
            Name = "Alias",
            ServerName = "localhost",
            CredentialRef = "ssmsx/existing",
            ColorProfileId = "blue",
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            LastUsed = new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc)
        };
        await _store.SaveAsync(existing);

        var saved = await _store.SaveAsync(existing with
        {
            Name = alias,
            CredentialRef = null,
            LastUsed = new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc)
        });

        Assert.Equal(alias, saved.Name);
        Assert.Null(saved.CredentialRef);
        Assert.Equal(new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc), saved.LastUsed);
        Assert.Equal("blue", saved.ColorProfileId);
    }

    [Fact]
    public async Task SaveAsync_SameIdFromOlderClient_PreservesStoredAppearance()
    {
        await _store.SaveAsync(new ConnectionInfo
        {
            Id = "existing",
            Name = "Production",
            ServerName = "sql.example.com",
            Database = "master",
            ColorProfileId = "violet",
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });

        const string olderClientJson = """
            {"id":"existing","serverName":"sql.example.com","database":"ApplicationDb","authType":"SqlAuth","encrypt":"Mandatory","trustServerCertificate":false,"createdAt":"2026-01-01T00:00:00Z"}
            """;
        var olderClientUpdate = JsonSerializer.Deserialize(
            olderClientJson,
            ProtocolJsonContext.Default.ConnectionInfo);

        Assert.NotNull(olderClientUpdate);
        Assert.Null(olderClientUpdate.Name);
        Assert.False(olderClientUpdate.HasExplicitColorProfileId);

        var saved = await _store.SaveAsync(olderClientUpdate);

        Assert.Equal("Production", saved.Name);
        Assert.Equal("violet", saved.ColorProfileId);
        Assert.Equal("ApplicationDb", saved.Database);
    }

    [Fact]
    public async Task ReassignColorProfileAsync_UpdatesAllMatchesInOneStoreOperation()
    {
        await _store.SaveAsync(new ConnectionInfo
        {
            Id = "first",
            Name = "First",
            ServerName = "first.example.com",
            ColorProfileId = "custom"
        });
        await _store.SaveAsync(new ConnectionInfo
        {
            Id = "second",
            Name = "Second",
            ServerName = "second.example.com",
            ColorProfileId = "custom"
        });
        await _store.SaveAsync(new ConnectionInfo
        {
            Id = "unchanged",
            ServerName = "third.example.com",
            ColorProfileId = "blue"
        });

        var updatedCount = await _store.ReassignColorProfileAsync("custom", "red");

        Assert.Equal(2, updatedCount);
        var connections = await _store.ListAsync();
        Assert.Equal("red", connections.Single(connection => connection.Id == "first").ColorProfileId);
        Assert.Equal("red", connections.Single(connection => connection.Id == "second").ColorProfileId);
        Assert.Equal("blue", connections.Single(connection => connection.Id == "unchanged").ColorProfileId);
        Assert.Equal("First", connections.Single(connection => connection.Id == "first").Name);
    }

    [Fact]
    public async Task UpdateLastUsedAsync_PreservesLatestStoredConnectionFields()
    {
        var original = await _store.SaveAsync(new ConnectionInfo
        {
            Id = "existing",
            Name = "Old alias",
            ServerName = "sql.example.com",
            ColorProfileId = "blue"
        });
        await _store.SaveAsync(original with
        {
            Name = "New alias",
            ColorProfileId = "green"
        });
        var lastUsed = new DateTime(2026, 7, 27, 3, 0, 0, DateTimeKind.Utc);

        var updated = await _store.UpdateLastUsedAsync("existing", lastUsed);

        Assert.True(updated);
        var saved = await _store.GetAsync("existing");
        Assert.NotNull(saved);
        Assert.Equal("New alias", saved.Name);
        Assert.Equal("green", saved.ColorProfileId);
        Assert.Equal(lastUsed, saved.LastUsed);
    }

    [Fact]
    public async Task ConcurrentStores_DoNotLoseSavesOrCollideOnTemporaryFiles()
    {
        var secondStore = new ConnectionStore(_tempDir);

        await Task.WhenAll(Enumerable.Range(0, 20).Select(index =>
        {
            var store = index % 2 == 0 ? _store : secondStore;
            return store.SaveAsync(new ConnectionInfo
            {
                Id = $"connection-{index}",
                ServerName = $"server-{index}"
            });
        }));

        var connections = await _store.ListAsync();
        Assert.Equal(20, connections.Count);
        Assert.Empty(Directory.GetFiles(_tempDir, "*.tmp"));
    }

    [Fact]
    public async Task ListAsync_ReturnsNormalizedData_WhenMigrationRewriteFails()
    {
        if (OperatingSystem.IsWindows())
            return;

        await _store.ListAsync();
        const string legacyJson = """
            [{"id":"legacy","serverName":"localhost","authType":"SqlAuth","encrypt":"Mandatory","trustServerCertificate":false,"color":"#3b82f6","createdAt":"2026-01-01T00:00:00Z"}]
            """;
        await File.WriteAllTextAsync(FilePath, legacyJson);
        File.SetUnixFileMode(
            _tempDir,
            UnixFileMode.UserRead | UnixFileMode.UserExecute);

        try
        {
            var connections = await _store.ListAsync();

            var connection = Assert.Single(connections);
            Assert.Equal("blue", connection.ColorProfileId);
            Assert.Contains("\"color\":\"#3b82f6\"", await File.ReadAllTextAsync(FilePath));
        }
        finally
        {
            File.SetUnixFileMode(
                _tempDir,
                UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        }
    }

    [Fact]
    public async Task StoreFiles_AreOwnerOnly_OnUnix()
    {
        if (OperatingSystem.IsWindows())
            return;

        await _store.SaveAsync(new ConnectionInfo
        {
            ServerName = "localhost"
        });

        Assert.Equal(
            UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute,
            File.GetUnixFileMode(_tempDir));
        Assert.Equal(
            UnixFileMode.UserRead | UnixFileMode.UserWrite,
            File.GetUnixFileMode(FilePath));
        Assert.Equal(
            UnixFileMode.UserRead | UnixFileMode.UserWrite,
            File.GetUnixFileMode(Path.Combine(_tempDir, "connections.lock")));
    }

    [Fact]
    public async Task StoreFiles_HaveRestrictedAcls_OnWindows()
    {
        if (!OperatingSystem.IsWindows())
            return;

        await _store.SaveAsync(new ConnectionInfo
        {
            ServerName = "localhost"
        });

        var currentUser = WindowsIdentity.GetCurrent().User;
        Assert.NotNull(currentUser);
        var allowed = new HashSet<SecurityIdentifier>
        {
            currentUser,
            new(WellKnownSidType.LocalSystemSid, null),
            new(WellKnownSidType.BuiltinAdministratorsSid, null)
        };

        AssertRestrictedWindowsAcl(
            new DirectoryInfo(_tempDir).GetAccessControl(),
            allowed,
            currentUser);
        AssertRestrictedWindowsAcl(
            new FileInfo(FilePath).GetAccessControl(),
            allowed,
            currentUser);
        AssertRestrictedWindowsAcl(
            new FileInfo(Path.Combine(_tempDir, "connections.lock")).GetAccessControl(),
            allowed,
            currentUser);
    }

    [SupportedOSPlatform("windows")]
    private static void AssertRestrictedWindowsAcl(
        FileSystemSecurity security,
        HashSet<SecurityIdentifier> allowed,
        SecurityIdentifier currentUser)
    {
        Assert.True(security.AreAccessRulesProtected);
        var accessRules = security
            .GetAccessRules(includeExplicit: true, includeInherited: false, typeof(SecurityIdentifier))
            .Cast<FileSystemAccessRule>()
            .Where(rule => rule.AccessControlType == AccessControlType.Allow)
            .ToList();

        Assert.Contains(
            accessRules,
            rule => currentUser.Equals(rule.IdentityReference));
        Assert.All(
            accessRules,
            rule => Assert.Contains((SecurityIdentifier)rule.IdentityReference, allowed));
    }
}
