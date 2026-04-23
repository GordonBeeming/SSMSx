using System.Text.Json.Serialization;

namespace Ssmsx.Protocol.Models;

public record QueryColumn
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("dataType")]
    public required string DataType { get; init; }

    [JsonPropertyName("isNullable")]
    public bool IsNullable { get; init; }

    [JsonPropertyName("maxLength")]
    public int? MaxLength { get; init; }
}

public record QueryMessage
{
    [JsonPropertyName("text")]
    public required string Text { get; init; }

    [JsonPropertyName("severity")]
    public required string Severity { get; init; } // "info" or "error"

    [JsonPropertyName("lineNumber")]
    public int? LineNumber { get; init; }
}
