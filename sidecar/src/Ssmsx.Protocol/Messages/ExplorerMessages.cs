using System.Text.Json.Serialization;

namespace Ssmsx.Protocol.Messages;

public record ExplorerDatabasesParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }
}

public record ExplorerTablesParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }
}

public record ExplorerViewsParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }
}

public record ExplorerColumnsParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }

    [JsonPropertyName("schema")]
    public required string Schema { get; init; }

    [JsonPropertyName("objectName")]
    public required string ObjectName { get; init; }
}

public record ExplorerKeysParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }

    [JsonPropertyName("schema")]
    public required string Schema { get; init; }

    [JsonPropertyName("tableName")]
    public required string TableName { get; init; }
}

public record ExplorerIndexesParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }

    [JsonPropertyName("schema")]
    public required string Schema { get; init; }

    [JsonPropertyName("tableName")]
    public required string TableName { get; init; }
}

public record ExplorerProceduresParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }
}

public record ExplorerFunctionsParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }
}

public record ExplorerUsersParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }
}

public record ExplorerObjectDefinitionParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }

    [JsonPropertyName("schema")]
    public required string Schema { get; init; }

    [JsonPropertyName("objectName")]
    public required string ObjectName { get; init; }

    [JsonPropertyName("objectType")]
    public required string ObjectType { get; init; }
}

public record ExplorerDatabaseDiagramParams
{
    [JsonPropertyName("connectionId")]
    public required string ConnectionId { get; init; }

    [JsonPropertyName("database")]
    public required string Database { get; init; }
}
