using System.Text.Json;
using Ssmsx.Protocol;
using Ssmsx.Protocol.Models;
using Xunit;

namespace Ssmsx.Protocol.Tests.Models;

public class ConnectionInfoTests
{
    [Fact]
    public void Serialization_RoundTrip_PreservesAllFields()
    {
        var original = new ConnectionInfo
        {
            Id = "test-id",
            Name = "My Server",
            ServerName = "sql.example.com",
            AuthType = AuthType.EntraMfa,
            Username = "admin",
            CredentialRef = "vault-ref",
            Database = "mydb",
            Encrypt = EncryptMode.Strict,
            TrustServerCertificate = true,
            ConnectionString = "Server=sql.example.com;",
            Color = "#00FF00",
            ColorProfileId = "custom-night",
            LastUsed = new DateTime(2026, 3, 15, 12, 0, 0, DateTimeKind.Utc),
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        var json = JsonSerializer.Serialize(original, ProtocolJsonContext.Default.ConnectionInfo);
        var deserialized = JsonSerializer.Deserialize(json, ProtocolJsonContext.Default.ConnectionInfo);

        Assert.NotNull(deserialized);
        Assert.Equal(original.Id, deserialized.Id);
        Assert.Equal(original.Name, deserialized.Name);
        Assert.Equal(original.ServerName, deserialized.ServerName);
        Assert.Equal(original.AuthType, deserialized.AuthType);
        Assert.Equal(original.Username, deserialized.Username);
        Assert.Equal(original.CredentialRef, deserialized.CredentialRef);
        Assert.Equal(original.Database, deserialized.Database);
        Assert.Equal(original.Encrypt, deserialized.Encrypt);
        Assert.Equal(original.TrustServerCertificate, deserialized.TrustServerCertificate);
        Assert.Equal(original.ConnectionString, deserialized.ConnectionString);
        Assert.Equal(original.Color, deserialized.Color);
        Assert.Equal(original.ColorProfileId, deserialized.ColorProfileId);
        Assert.Equal(original.LastUsed, deserialized.LastUsed);
        Assert.Equal(original.CreatedAt, deserialized.CreatedAt);
    }

    [Fact]
    public void AuthType_SerializesAsString()
    {
        var connection = new ConnectionInfo
        {
            ServerName = "localhost",
            AuthType = AuthType.SqlAuth
        };

        var json = JsonSerializer.Serialize(connection, ProtocolJsonContext.Default.ConnectionInfo);

        Assert.Contains("\"SqlAuth\"", json);
    }

    [Fact]
    public void AuthType_AllValues_SerializeAsStrings()
    {
        foreach (var value in Enum.GetValues<AuthType>())
        {
            var connection = new ConnectionInfo
            {
                ServerName = "localhost",
                AuthType = value
            };

            var json = JsonSerializer.Serialize(connection, ProtocolJsonContext.Default.ConnectionInfo);
            Assert.Contains($"\"{value}\"", json);
        }
    }

    [Fact]
    public void EncryptMode_SerializesAsString()
    {
        var connection = new ConnectionInfo
        {
            ServerName = "localhost",
            Encrypt = EncryptMode.Optional
        };

        var json = JsonSerializer.Serialize(connection, ProtocolJsonContext.Default.ConnectionInfo);

        Assert.Contains("\"Optional\"", json);
    }

    [Fact]
    public void EncryptMode_AllValues_SerializeAsStrings()
    {
        foreach (var value in Enum.GetValues<EncryptMode>())
        {
            var connection = new ConnectionInfo
            {
                ServerName = "localhost",
                Encrypt = value
            };

            var json = JsonSerializer.Serialize(connection, ProtocolJsonContext.Default.ConnectionInfo);
            Assert.Contains($"\"{value}\"", json);
        }
    }

    [Fact]
    public void DefaultValues_AreSetCorrectly()
    {
        var connection = new ConnectionInfo
        {
            ServerName = "localhost"
        };

        Assert.False(string.IsNullOrEmpty(connection.Id));
        Assert.True(Guid.TryParse(connection.Id, out _));
        Assert.Null(connection.Name);
        Assert.Equal(AuthType.SqlAuth, connection.AuthType);
        Assert.Equal(EncryptMode.Mandatory, connection.Encrypt);
        Assert.False(connection.TrustServerCertificate);
        Assert.Null(connection.Username);
        Assert.Null(connection.CredentialRef);
        Assert.Null(connection.Database);
        Assert.Null(connection.ConnectionString);
        Assert.Null(connection.Color);
        Assert.Equal("red", connection.ColorProfileId);
        Assert.False(connection.HasExplicitColorProfileId);
        Assert.Null(connection.LastUsed);
        Assert.True(connection.CreatedAt > DateTime.MinValue);
    }

    [Fact]
    public void NullableFields_OmittedInJson_WhenNull()
    {
        var connection = new ConnectionInfo
        {
            ServerName = "localhost"
        };

        var json = JsonSerializer.Serialize(connection, ProtocolJsonContext.Default.ConnectionInfo);

        Assert.DoesNotContain("\"username\"", json);
        Assert.DoesNotContain("\"name\"", json);
        Assert.DoesNotContain("\"credentialRef\"", json);
        Assert.DoesNotContain("\"database\"", json);
        Assert.DoesNotContain("\"connectionString\"", json);
        Assert.DoesNotContain("\"color\"", json);
        Assert.DoesNotContain("\"lastUsed\"", json);
        Assert.Contains("\"colorProfileId\":\"red\"", json);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ColorProfileId_BlankOrMissing_UsesRedDefault(string? colorProfileId)
    {
        var connection = colorProfileId is null
            ? new ConnectionInfo { ServerName = "localhost" }
            : new ConnectionInfo { ServerName = "localhost", ColorProfileId = colorProfileId };

        Assert.Equal("red", connection.ColorProfileId);
        Assert.False(connection.HasExplicitColorProfileId);
    }

    [Fact]
    public void Serialization_RoundTrip_PreservesNullOptionalName()
    {
        var original = new ConnectionInfo
        {
            ServerName = "localhost",
            Name = null,
            ColorProfileId = "blue"
        };

        var json = JsonSerializer.Serialize(original, ProtocolJsonContext.Default.ConnectionInfo);
        var deserialized = JsonSerializer.Deserialize(json, ProtocolJsonContext.Default.ConnectionInfo);

        Assert.NotNull(deserialized);
        Assert.Null(deserialized.Name);
        Assert.Equal("blue", deserialized.ColorProfileId);
    }
}
