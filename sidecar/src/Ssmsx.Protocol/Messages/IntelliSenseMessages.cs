namespace Ssmsx.Protocol.Messages;

public record IntelliSenseGetMetadataParams
{
    public required string ConnectionId { get; init; }
    public required string Database { get; init; }
}

public record IntelliSenseMetadata
{
    public required List<IntelliSenseTable> Tables { get; init; }
    public required List<IntelliSenseColumn> Columns { get; init; }
    public required List<IntelliSenseProcedure> Procedures { get; init; }
    public required List<IntelliSenseFunction> Functions { get; init; }
}

public record IntelliSenseTable
{
    public required string Schema { get; init; }
    public required string Name { get; init; }
    public required string Type { get; init; } // "table" or "view"
}

public record IntelliSenseColumn
{
    public required string Schema { get; init; }
    public required string TableName { get; init; }
    public required string Name { get; init; }
    public required string DataType { get; init; }
}

public record IntelliSenseProcedure
{
    public required string Schema { get; init; }
    public required string Name { get; init; }
}

public record IntelliSenseFunction
{
    public required string Schema { get; init; }
    public required string Name { get; init; }
    public required string Type { get; init; } // "scalar", "table", "inline"
}
