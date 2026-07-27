using System.Text.Json.Serialization;

namespace Ssmsx.Protocol.Models;

public record ConnectionInfo
{
    private string? _colorProfileId;

    [JsonPropertyName("id")]
    public string Id { get; init; } = Guid.NewGuid().ToString();

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("serverName")]
    public required string ServerName { get; init; }

    [JsonPropertyName("authType")]
    public AuthType AuthType { get; init; } = AuthType.SqlAuth;

    [JsonPropertyName("username")]
    public string? Username { get; init; }

    [JsonPropertyName("credentialRef")]
    public string? CredentialRef { get; init; }

    [JsonPropertyName("database")]
    public string? Database { get; init; }

    [JsonPropertyName("encrypt")]
    public EncryptMode Encrypt { get; init; } = EncryptMode.Mandatory;

    [JsonPropertyName("trustServerCertificate")]
    public bool TrustServerCertificate { get; init; }

    [JsonPropertyName("connectionString")]
    public string? ConnectionString { get; init; }

    [JsonPropertyName("color")]
    public string? Color { get; init; }

    [JsonPropertyName("colorProfileId")]
    public string ColorProfileId
    {
        get => string.IsNullOrWhiteSpace(_colorProfileId) ? "red" : _colorProfileId;
        init => _colorProfileId = value;
    }

    [JsonIgnore]
    public bool HasExplicitColorProfileId => !string.IsNullOrWhiteSpace(_colorProfileId);

    [JsonPropertyName("lastUsed")]
    public DateTime? LastUsed { get; init; }

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
