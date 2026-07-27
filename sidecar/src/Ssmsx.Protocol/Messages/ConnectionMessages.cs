using System.Text.Json.Serialization;
using Ssmsx.Protocol.Models;

namespace Ssmsx.Protocol.Messages;

public record ConnectionGetParams
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
}

public record ConnectionDeleteParams
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
}

public record ConnectionReassignColorProfileParams
{
    [JsonPropertyName("fromProfileId")]
    public required string FromProfileId { get; init; }

    [JsonPropertyName("toProfileId")]
    public required string ToProfileId { get; init; }
}

public record ConnectionSaveParams
{
    [JsonPropertyName("connection")]
    public required ConnectionInfo Connection { get; init; }

    [JsonPropertyName("password")]
    public string? Password { get; init; }

    [JsonPropertyName("clearCredential")]
    public bool ClearCredential { get; init; }
}

public record ConnectionTestParams
{
    [JsonPropertyName("connection")]
    public required ConnectionInfo Connection { get; init; }

    [JsonPropertyName("password")]
    public string? Password { get; init; }
}

public record ConnectionConnectParams
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
}

public record ConnectionDisconnectParams
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
}

public record RequestCancelParams
{
    [JsonPropertyName("requestId")]
    public required string RequestId { get; init; }
}

public record ConnectionTestResult
{
    [JsonPropertyName("success")]
    public bool Success { get; init; }

    [JsonPropertyName("error")]
    public string? Error { get; init; }
}

public record ConnectionConnectResult
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }
}

public record ConnectionDeleteResult
{
    [JsonPropertyName("deleted")]
    public bool Deleted { get; init; }
}

public record ConnectionReassignColorProfileResult
{
    [JsonPropertyName("updatedCount")]
    public int UpdatedCount { get; init; }
}
