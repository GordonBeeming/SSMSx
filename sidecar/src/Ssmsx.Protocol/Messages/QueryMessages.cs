using System.Text.Json.Serialization;
using Ssmsx.Protocol.Models;

namespace Ssmsx.Protocol.Messages;

public record QueryExecuteParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }

    [JsonPropertyName("sql")]
    public required string Sql { get; init; }
}

public record QueryCancelParams
{
    [JsonPropertyName("queryId")]
    public required string QueryId { get; init; }
}

public record QueryExecuteResult
{
    [JsonPropertyName("queryId")]
    public required string QueryId { get; init; }

    [JsonPropertyName("columns")]
    public List<QueryColumn>? Columns { get; init; }

    [JsonPropertyName("rows")]
    public List<List<object?>>? Rows { get; init; }

    [JsonPropertyName("batch")]
    public int Batch { get; init; }

    [JsonPropertyName("done")]
    public bool Done { get; init; }

    [JsonPropertyName("executionTimeMs")]
    public long? ExecutionTimeMs { get; init; }

    [JsonPropertyName("totalRows")]
    public long? TotalRows { get; init; }

    [JsonPropertyName("messages")]
    public List<QueryMessage>? Messages { get; init; }

    [JsonPropertyName("resultSetIndex")]
    public int? ResultSetIndex { get; init; }
}

public record QueryCancelResult
{
    [JsonPropertyName("cancelled")]
    public bool Cancelled { get; init; }
}
