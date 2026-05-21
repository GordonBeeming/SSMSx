using System.Text.Json.Serialization;

namespace Ssmsx.Protocol.Models;

public record DatabaseInfo
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("state")]
    public required string State { get; init; }

    [JsonPropertyName("compatibilityLevel")]
    public int CompatibilityLevel { get; init; }

    [JsonPropertyName("collationName")]
    public string? CollationName { get; init; }

    [JsonPropertyName("recoveryModel")]
    public string? RecoveryModel { get; init; }
}

public record TableInfo
{
    [JsonPropertyName("schema")]
    public required string Schema { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("rowCount")]
    public long RowCount { get; init; }

    [JsonPropertyName("createDate")]
    public DateTime? CreateDate { get; init; }
}

public record ViewInfo
{
    [JsonPropertyName("schema")]
    public required string Schema { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("createDate")]
    public DateTime? CreateDate { get; init; }
}

public record ColumnInfo
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("dataType")]
    public required string DataType { get; init; }

    [JsonPropertyName("maxLength")]
    public int MaxLength { get; init; }

    [JsonPropertyName("precision")]
    public int Precision { get; init; }

    [JsonPropertyName("scale")]
    public int Scale { get; init; }

    [JsonPropertyName("isNullable")]
    public bool IsNullable { get; init; }

    [JsonPropertyName("defaultValue")]
    public string? DefaultValue { get; init; }

    [JsonPropertyName("isIdentity")]
    public bool IsIdentity { get; init; }

    [JsonPropertyName("isComputed")]
    public bool IsComputed { get; init; }
}

public record KeyInfo
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("type")]
    public required string Type { get; init; }

    [JsonPropertyName("columns")]
    public required List<string> Columns { get; init; }

    [JsonPropertyName("referencedTable")]
    public string? ReferencedTable { get; init; }

    [JsonPropertyName("referencedColumns")]
    public List<string>? ReferencedColumns { get; init; }
}

public record IndexInfo
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("type")]
    public required string Type { get; init; }

    [JsonPropertyName("isUnique")]
    public bool IsUnique { get; init; }

    [JsonPropertyName("columns")]
    public required List<string> Columns { get; init; }

    [JsonPropertyName("includedColumns")]
    public List<string>? IncludedColumns { get; init; }
}

public record StoredProcedureInfo
{
    [JsonPropertyName("schema")]
    public required string Schema { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("createDate")]
    public DateTime? CreateDate { get; init; }

    [JsonPropertyName("modifyDate")]
    public DateTime? ModifyDate { get; init; }
}

public record FunctionInfo
{
    [JsonPropertyName("schema")]
    public required string Schema { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("type")]
    public required string Type { get; init; }

    [JsonPropertyName("createDate")]
    public DateTime? CreateDate { get; init; }

    [JsonPropertyName("modifyDate")]
    public DateTime? ModifyDate { get; init; }
}

public record DatabaseUserInfo
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("type")]
    public required string Type { get; init; }

    [JsonPropertyName("defaultSchema")]
    public string? DefaultSchema { get; init; }

    [JsonPropertyName("loginName")]
    public string? LoginName { get; init; }
}

public record ObjectScriptResult
{
    [JsonPropertyName("definition")]
    public string? Definition { get; init; }
}

public record DatabaseDiagramInfo
{
    [JsonPropertyName("database")]
    public required string Database { get; init; }

    [JsonPropertyName("tables")]
    public required List<DiagramTableInfo> Tables { get; init; }

    [JsonPropertyName("relationships")]
    public required List<DiagramRelationshipInfo> Relationships { get; init; }
}

public record DiagramTableInfo
{
    [JsonPropertyName("schema")]
    public required string Schema { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("rowCount")]
    public long RowCount { get; init; }

    [JsonPropertyName("columns")]
    public required List<DiagramColumnInfo> Columns { get; init; }

    [JsonPropertyName("primaryKey")]
    public required List<string> PrimaryKey { get; init; }
}

public record DiagramColumnInfo
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("dataType")]
    public required string DataType { get; init; }

    [JsonPropertyName("isNullable")]
    public bool IsNullable { get; init; }

    [JsonPropertyName("isIdentity")]
    public bool IsIdentity { get; init; }

    [JsonPropertyName("isPrimaryKey")]
    public bool IsPrimaryKey { get; init; }

    [JsonPropertyName("isForeignKey")]
    public bool IsForeignKey { get; init; }

    [JsonPropertyName("defaultDefinition")]
    public string? DefaultDefinition { get; init; }
}

public record DiagramRelationshipInfo
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("fromSchema")]
    public required string FromSchema { get; init; }

    [JsonPropertyName("fromTable")]
    public required string FromTable { get; init; }

    [JsonPropertyName("fromColumns")]
    public required List<string> FromColumns { get; init; }

    [JsonPropertyName("toSchema")]
    public required string ToSchema { get; init; }

    [JsonPropertyName("toTable")]
    public required string ToTable { get; init; }

    [JsonPropertyName("toColumns")]
    public required List<string> ToColumns { get; init; }
}
