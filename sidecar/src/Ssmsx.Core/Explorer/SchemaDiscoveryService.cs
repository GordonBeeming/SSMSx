using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Ssmsx.Core.Connections;
using Ssmsx.Protocol.Models;

namespace Ssmsx.Core.Explorer;

public partial class SchemaDiscoveryService
{
    private readonly ConnectionManager _connectionManager;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _connectionLocks = new();

    /// <summary>
    /// Default command timeout in seconds for SQL queries against the Object Explorer.
    /// Kept low to avoid blocking the UI for unresponsive databases.
    /// </summary>
    private const int DefaultCommandTimeoutSeconds = 10;

    public SchemaDiscoveryService(ConnectionManager connectionManager)
    {
        _connectionManager = connectionManager;
    }

    private SemaphoreSlim GetConnectionLock(string connectionId)
    {
        return _connectionLocks.GetOrAdd(connectionId, _ => new SemaphoreSlim(1, 1));
    }

    private async Task<T> WithDatabaseAsync<T>(string connectionId, string database, Func<SqlConnection, Task<T>> action)
    {
        ValidateDatabaseName(database);
        var semaphore = GetConnectionLock(connectionId);
        await semaphore.WaitAsync();
        try
        {
            var connection = _connectionManager.GetConnection(connectionId);
            var originalDb = connection.Database;
            try
            {
                connection.ChangeDatabase(database);
                return await action(connection);
            }
            finally
            {
                if (!string.IsNullOrEmpty(originalDb))
                    connection.ChangeDatabase(originalDb);
            }
        }
        finally
        {
            semaphore.Release();
        }
    }

    [GeneratedRegex(@"^[a-zA-Z0-9_ .\-]+$")]
    private static partial Regex SafeNameRegex();

    internal static void ValidateDatabaseName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Database name cannot be empty");
        if (!SafeNameRegex().IsMatch(name))
            throw new ArgumentException($"Invalid database name: {name}");
    }

    private static string QuoteName(string name) => $"[{name.Replace("]", "]]")}]";

    public async Task<List<DatabaseInfo>> GetDatabasesAsync(string connectionId)
    {
        var semaphore = GetConnectionLock(connectionId);
        await semaphore.WaitAsync();
        try
        {
            var connection = _connectionManager.GetConnection(connectionId);
            const string sql = """
                SELECT name, state_desc, compatibility_level, collation_name, recovery_model_desc
                FROM sys.databases
                ORDER BY name
                """;

            await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
            await using var reader = await cmd.ExecuteReaderAsync();
            var results = new List<DatabaseInfo>();
            while (await reader.ReadAsync())
            {
                results.Add(new DatabaseInfo
                {
                    Name = reader.GetString(0),
                    State = reader.GetString(1),
                    CompatibilityLevel = reader.GetByte(2),
                    CollationName = reader.IsDBNull(3) ? null : reader.GetString(3),
                    RecoveryModel = reader.IsDBNull(4) ? null : reader.GetString(4)
                });
            }
            return results;
        }
        finally
        {
            semaphore.Release();
        }
    }

    public Task<List<TableInfo>> GetTablesAsync(string connectionId, string database)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            const string sql = """
                SELECT s.name AS [schema], t.name,
                       ISNULL(SUM(p.rows), 0) AS row_count, t.create_date
                FROM sys.tables t
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
                GROUP BY s.name, t.name, t.create_date
                ORDER BY s.name, t.name
                """;

            await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
            await using var reader = await cmd.ExecuteReaderAsync();
            var results = new List<TableInfo>();
            while (await reader.ReadAsync())
            {
                results.Add(new TableInfo
                {
                    Schema = reader.GetString(0),
                    Name = reader.GetString(1),
                    RowCount = reader.GetInt64(2),
                    CreateDate = reader.GetDateTime(3)
                });
            }
            return results;
        });
    }

    public Task<List<ViewInfo>> GetViewsAsync(string connectionId, string database)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            const string sql = """
                SELECT s.name AS [schema], v.name, v.create_date
                FROM sys.views v
                JOIN sys.schemas s ON v.schema_id = s.schema_id
                ORDER BY s.name, v.name
                """;

            await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
            await using var reader = await cmd.ExecuteReaderAsync();
            var results = new List<ViewInfo>();
            while (await reader.ReadAsync())
            {
                results.Add(new ViewInfo
                {
                    Schema = reader.GetString(0),
                    Name = reader.GetString(1),
                    CreateDate = reader.GetDateTime(2)
                });
            }
            return results;
        });
    }

    public Task<List<ColumnInfo>> GetColumnsAsync(string connectionId, string database, string schema, string objectName)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            const string sql = """
                SELECT c.name, t.name AS data_type, c.max_length, c.precision, c.scale,
                       c.is_nullable, dc.definition, c.is_identity, c.is_computed
                FROM sys.columns c
                JOIN sys.types t ON c.user_type_id = t.user_type_id
                LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
                WHERE c.object_id = OBJECT_ID(@objectName)
                ORDER BY c.column_id
                """;

            await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
            cmd.Parameters.AddWithValue("@objectName", $"{schema}.{objectName}");
            await using var reader = await cmd.ExecuteReaderAsync();
            var results = new List<ColumnInfo>();
            while (await reader.ReadAsync())
            {
                results.Add(new ColumnInfo
                {
                    Name = reader.GetString(0),
                    DataType = reader.GetString(1),
                    MaxLength = reader.GetInt16(2),
                    Precision = reader.GetByte(3),
                    Scale = reader.GetByte(4),
                    IsNullable = reader.GetBoolean(5),
                    DefaultValue = reader.IsDBNull(6) ? null : reader.GetString(6),
                    IsIdentity = reader.GetBoolean(7),
                    IsComputed = reader.GetBoolean(8)
                });
            }
            return results;
        });
    }

    public Task<List<KeyInfo>> GetKeysAsync(string connectionId, string database, string schema, string tableName)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            var results = new List<KeyInfo>();
            var objectName = $"{schema}.{tableName}";

            // Primary keys and unique constraints
            const string keySql = """
                SELECT kc.name, kc.type_desc,
                       STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal)
                FROM sys.key_constraints kc
                JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id AND kc.unique_index_id = ic.index_id
                JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                WHERE kc.parent_object_id = OBJECT_ID(@objectName)
                GROUP BY kc.name, kc.type_desc
                """;

            await using (var cmd = new SqlCommand(keySql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds })
            {
                cmd.Parameters.AddWithValue("@objectName", objectName);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    results.Add(new KeyInfo
                    {
                        Name = reader.GetString(0),
                        Type = reader.GetString(1),
                        Columns = reader.GetString(2).Split(", ").ToList()
                    });
                }
            }

            // Foreign keys
            const string fkSql = """
                SELECT fk.name,
                       STRING_AGG(cp.name, ', ') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS columns,
                       SCHEMA_NAME(rt.schema_id) + '.' + rt.name AS referenced_table,
                       STRING_AGG(cr.name, ', ') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS referenced_columns
                FROM sys.foreign_keys fk
                JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
                JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
                JOIN sys.tables rt ON fkc.referenced_object_id = rt.object_id
                WHERE fk.parent_object_id = OBJECT_ID(@objectName)
                GROUP BY fk.name, rt.schema_id, rt.name
                """;

            await using (var cmd = new SqlCommand(fkSql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds })
            {
                cmd.Parameters.AddWithValue("@objectName", objectName);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    results.Add(new KeyInfo
                    {
                        Name = reader.GetString(0),
                        Type = "FOREIGN_KEY_CONSTRAINT",
                        Columns = reader.GetString(1).Split(", ").ToList(),
                        ReferencedTable = reader.GetString(2),
                        ReferencedColumns = reader.GetString(3).Split(", ").ToList()
                    });
                }
            }

            return results;
        });
    }

    public Task<List<IndexInfo>> GetIndexesAsync(string connectionId, string database, string schema, string tableName)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            const string sql = """
                SELECT i.name, i.type_desc, i.is_unique,
                       c.name AS col_name, ic.is_included_column
                FROM sys.indexes i
                JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                WHERE i.object_id = OBJECT_ID(@objectName)
                  AND i.name IS NOT NULL
                  AND i.type > 0
                ORDER BY i.name, ic.is_included_column, ic.key_ordinal
                """;

            await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
            cmd.Parameters.AddWithValue("@objectName", $"{schema}.{tableName}");
            await using var reader = await cmd.ExecuteReaderAsync();

            // Collect raw rows, then aggregate in C#
            var indexData = new Dictionary<string, (string Type, bool IsUnique, List<string> KeyColumns, List<string> IncludedColumns)>();
            while (await reader.ReadAsync())
            {
                var name = reader.GetString(0);
                var type = reader.GetString(1);
                var isUnique = reader.GetBoolean(2);
                var colName = reader.GetString(3);
                var isIncluded = reader.GetBoolean(4);

                if (!indexData.ContainsKey(name))
                    indexData[name] = (type, isUnique, new List<string>(), new List<string>());

                var entry = indexData[name];
                if (isIncluded)
                    entry.IncludedColumns.Add(colName);
                else
                    entry.KeyColumns.Add(colName);
            }

            return indexData.Select(kvp => new IndexInfo
            {
                Name = kvp.Key,
                Type = kvp.Value.Type,
                IsUnique = kvp.Value.IsUnique,
                Columns = kvp.Value.KeyColumns,
                IncludedColumns = kvp.Value.IncludedColumns.Count > 0 ? kvp.Value.IncludedColumns : null
            }).ToList();
        });
    }

    public Task<List<StoredProcedureInfo>> GetProceduresAsync(string connectionId, string database)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            const string sql = """
                SELECT s.name AS [schema], p.name, p.create_date, p.modify_date
                FROM sys.procedures p
                JOIN sys.schemas s ON p.schema_id = s.schema_id
                ORDER BY s.name, p.name
                """;

            await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
            await using var reader = await cmd.ExecuteReaderAsync();
            var results = new List<StoredProcedureInfo>();
            while (await reader.ReadAsync())
            {
                results.Add(new StoredProcedureInfo
                {
                    Schema = reader.GetString(0),
                    Name = reader.GetString(1),
                    CreateDate = reader.GetDateTime(2),
                    ModifyDate = reader.GetDateTime(3)
                });
            }
            return results;
        });
    }

    public Task<List<FunctionInfo>> GetFunctionsAsync(string connectionId, string database)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            const string sql = """
                SELECT s.name AS [schema], o.name,
                       CASE o.type
                           WHEN 'FN' THEN 'Scalar'
                           WHEN 'IF' THEN 'Inline Table'
                           WHEN 'TF' THEN 'Table'
                           ELSE o.type
                       END AS function_type,
                       o.create_date, o.modify_date
                FROM sys.objects o
                JOIN sys.schemas s ON o.schema_id = s.schema_id
                WHERE o.type IN ('FN', 'IF', 'TF')
                ORDER BY s.name, o.name
                """;

            await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
            await using var reader = await cmd.ExecuteReaderAsync();
            var results = new List<FunctionInfo>();
            while (await reader.ReadAsync())
            {
                results.Add(new FunctionInfo
                {
                    Schema = reader.GetString(0),
                    Name = reader.GetString(1),
                    Type = reader.GetString(2),
                    CreateDate = reader.GetDateTime(3),
                    ModifyDate = reader.GetDateTime(4)
                });
            }
            return results;
        });
    }

    public Task<List<DatabaseUserInfo>> GetUsersAsync(string connectionId, string database)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            const string sql = """
                SELECT dp.name, dp.type_desc, dp.default_schema_name,
                       sp.name AS login_name
                FROM sys.database_principals dp
                LEFT JOIN sys.server_principals sp ON dp.sid = sp.sid
                WHERE dp.type IN ('S', 'U', 'G')
                  AND dp.name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest', 'public')
                ORDER BY dp.name
                """;

            await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
            await using var reader = await cmd.ExecuteReaderAsync();
            var results = new List<DatabaseUserInfo>();
            while (await reader.ReadAsync())
            {
                results.Add(new DatabaseUserInfo
                {
                    Name = reader.GetString(0),
                    Type = reader.GetString(1),
                    DefaultSchema = reader.IsDBNull(2) ? null : reader.GetString(2),
                    LoginName = reader.IsDBNull(3) ? null : reader.GetString(3)
                });
            }
            return results;
        });
    }

    public Task<ObjectScriptResult> GetObjectDefinitionAsync(string connectionId, string database, string schema, string objectName, string objectType)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            if (objectType == "table")
            {
                return await GetTableCreateScriptAsync(connection, schema, objectName);
            }

            // For views, procedures, functions — use OBJECT_DEFINITION
            const string sql = "SELECT OBJECT_DEFINITION(OBJECT_ID(@objectName))";
            await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
            cmd.Parameters.AddWithValue("@objectName", $"{schema}.{objectName}");
            var result = await cmd.ExecuteScalarAsync();
            var definition = result switch
            {
                string s => s,
                DBNull => null,
                null => null,
                _ => null
            };
            return new ObjectScriptResult
            {
                Definition = definition
            };
        });
    }

    public Task<DatabaseDiagramInfo> GetDatabaseDiagramAsync(string connectionId, string database)
    {
        return WithDatabaseAsync(connectionId, database, async connection =>
        {
            const string tableSql = """
                WITH row_counts AS (
                    SELECT object_id, SUM(rows) AS row_count
                    FROM sys.partitions
                    WHERE index_id IN (0, 1)
                    GROUP BY object_id
                ),
                pk_columns AS (
                    SELECT ic.object_id, ic.column_id
                    FROM sys.key_constraints kc
                    JOIN sys.index_columns ic
                      ON kc.parent_object_id = ic.object_id
                     AND kc.unique_index_id = ic.index_id
                    WHERE kc.type = 'PK'
                ),
                fk_columns AS (
                    SELECT DISTINCT parent_object_id AS object_id, parent_column_id AS column_id
                    FROM sys.foreign_key_columns
                )
                SELECT
                    s.name AS schema_name,
                    t.name AS table_name,
                    ISNULL(rc.row_count, 0) AS row_count,
                    c.name AS column_name,
                    CASE
                        WHEN ty.name IN ('char','varchar','binary','varbinary')
                            THEN ty.name + '(' + CASE WHEN c.max_length = -1 THEN 'max' ELSE CONVERT(varchar(10), c.max_length) END + ')'
                        WHEN ty.name IN ('nchar','nvarchar')
                            THEN ty.name + '(' + CASE WHEN c.max_length = -1 THEN 'max' ELSE CONVERT(varchar(10), c.max_length / 2) END + ')'
                        WHEN ty.name IN ('decimal','numeric')
                            THEN ty.name + '(' + CONVERT(varchar(10), c.precision) + ',' + CONVERT(varchar(10), c.scale) + ')'
                        WHEN ty.name IN ('datetime2','datetimeoffset','time')
                            THEN ty.name + '(' + CONVERT(varchar(10), c.scale) + ')'
                        ELSE ty.name
                    END AS data_type,
                    c.is_nullable,
                    c.is_identity,
                    CASE WHEN pk.object_id IS NULL THEN CONVERT(bit, 0) ELSE CONVERT(bit, 1) END AS is_primary_key,
                    CASE WHEN fk.object_id IS NULL THEN CONVERT(bit, 0) ELSE CONVERT(bit, 1) END AS is_foreign_key,
                    dc.definition AS default_definition
                FROM sys.tables t
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                JOIN sys.columns c ON t.object_id = c.object_id
                JOIN sys.types ty ON c.user_type_id = ty.user_type_id
                LEFT JOIN row_counts rc ON t.object_id = rc.object_id
                LEFT JOIN pk_columns pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
                LEFT JOIN fk_columns fk ON c.object_id = fk.object_id AND c.column_id = fk.column_id
                LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
                WHERE t.is_ms_shipped = 0
                ORDER BY s.name, t.name, c.column_id
                """;

            var tables = new Dictionary<string, DiagramTableInfo>(StringComparer.OrdinalIgnoreCase);

            await using (var cmd = new SqlCommand(tableSql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds })
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var schema = reader.GetString(0);
                    var tableName = reader.GetString(1);
                    var key = $"{schema}.{tableName}";

                    if (!tables.TryGetValue(key, out var table))
                    {
                        table = new DiagramTableInfo
                        {
                            Schema = schema,
                            Name = tableName,
                            RowCount = reader.GetInt64(2),
                            Columns = new List<DiagramColumnInfo>(),
                            PrimaryKey = new List<string>()
                        };
                        tables[key] = table;
                    }

                    var columnName = reader.GetString(3);
                    var isPrimaryKey = reader.GetBoolean(7);
                    if (isPrimaryKey)
                        table.PrimaryKey.Add(columnName);

                    table.Columns.Add(new DiagramColumnInfo
                    {
                        Name = columnName,
                        DataType = reader.GetString(4),
                        IsNullable = reader.GetBoolean(5),
                        IsIdentity = reader.GetBoolean(6),
                        IsPrimaryKey = isPrimaryKey,
                        IsForeignKey = reader.GetBoolean(8),
                        DefaultDefinition = reader.IsDBNull(9) ? null : reader.GetString(9)
                    });
                }
            }

            const string relationshipSql = """
                SELECT
                    fk.name,
                    ps.name AS from_schema,
                    pt.name AS from_table,
                    STRING_AGG(pc.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS from_columns,
                    rs.name AS to_schema,
                    rt.name AS to_table,
                    STRING_AGG(rc.name, ',') WITHIN GROUP (ORDER BY fkc.constraint_column_id) AS to_columns
                FROM sys.foreign_keys fk
                JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                JOIN sys.tables pt ON fkc.parent_object_id = pt.object_id
                JOIN sys.schemas ps ON pt.schema_id = ps.schema_id
                JOIN sys.columns pc ON fkc.parent_object_id = pc.object_id AND fkc.parent_column_id = pc.column_id
                JOIN sys.tables rt ON fkc.referenced_object_id = rt.object_id
                JOIN sys.schemas rs ON rt.schema_id = rs.schema_id
                JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
                WHERE pt.is_ms_shipped = 0 AND rt.is_ms_shipped = 0
                GROUP BY fk.name, ps.name, pt.name, rs.name, rt.name
                ORDER BY ps.name, pt.name, fk.name
                """;

            var relationships = new List<DiagramRelationshipInfo>();
            await using (var cmd = new SqlCommand(relationshipSql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds })
            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    relationships.Add(new DiagramRelationshipInfo
                    {
                        Name = reader.GetString(0),
                        FromSchema = reader.GetString(1),
                        FromTable = reader.GetString(2),
                        FromColumns = reader.GetString(3).Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                        ToSchema = reader.GetString(4),
                        ToTable = reader.GetString(5),
                        ToColumns = reader.GetString(6).Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
                    });
                }
            }

            return new DatabaseDiagramInfo
            {
                Database = database,
                Tables = tables.Values.OrderBy(t => t.Schema).ThenBy(t => t.Name).ToList(),
                Relationships = relationships
            };
        });
    }

    private static async Task<ObjectScriptResult> GetTableCreateScriptAsync(SqlConnection connection, string schema, string tableName)
    {
        // Build CREATE TABLE from metadata
        var quotedSchema = QuoteName(schema);
        var quotedTable = QuoteName(tableName);
        var objectName = $"{schema}.{tableName}";

        const string colSql = """
            SELECT c.name, t.name AS type_name, c.max_length, c.precision, c.scale,
                   c.is_nullable, c.is_identity, dc.definition,
                   CASE WHEN t.name IN ('char','varchar','nchar','nvarchar','binary','varbinary') THEN 1 ELSE 0 END AS has_length,
                   CASE WHEN t.name IN ('decimal','numeric') THEN 1 ELSE 0 END AS has_precision,
                   c.is_computed, cc.definition AS computed_definition
            FROM sys.columns c
            JOIN sys.types t ON c.user_type_id = t.user_type_id
            LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
            LEFT JOIN sys.computed_columns cc ON c.object_id = cc.object_id AND c.column_id = cc.column_id
            WHERE c.object_id = OBJECT_ID(@objectName)
            ORDER BY c.column_id
            """;

        var columns = new List<string>();
        await using (var cmd = new SqlCommand(colSql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds })
        {
            cmd.Parameters.AddWithValue("@objectName", objectName);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var colName = QuoteName(reader.GetString(0));
                var typeName = reader.GetString(1);
                var maxLen = reader.GetInt16(2);
                var precision = reader.GetByte(3);
                var scale = reader.GetByte(4);
                var nullable = reader.GetBoolean(5);
                var identity = reader.GetBoolean(6);
                var defaultVal = reader.IsDBNull(7) ? null : reader.GetString(7);
                var hasLength = reader.GetInt32(8) == 1;
                var hasPrecision = reader.GetInt32(9) == 1;
                var isComputed = reader.GetBoolean(10);
                var computedDefinition = reader.IsDBNull(11) ? null : reader.GetString(11);

                if (isComputed && computedDefinition != null)
                {
                    columns.Add($"    {colName} AS ({computedDefinition})");
                    continue;
                }

                var typeSpec = typeName;
                if (hasLength)
                {
                    if (maxLen == -1)
                        typeSpec += "(MAX)";
                    else
                    {
                        // nchar/nvarchar store max_length in bytes (2 per char)
                        var charLen = typeName.StartsWith("n", StringComparison.OrdinalIgnoreCase)
                            ? maxLen / 2 : maxLen;
                        typeSpec += $"({charLen})";
                    }
                }
                else if (hasPrecision)
                    typeSpec += $"({precision}, {scale})";

                var parts = $"    {colName} {typeSpec}";
                if (identity) parts += " IDENTITY(1,1)";
                if (!nullable) parts += " NOT NULL";
                else parts += " NULL";
                if (defaultVal != null) parts += $" DEFAULT {defaultVal}";
                columns.Add(parts);
            }
        }

        var script = $"CREATE TABLE {quotedSchema}.{quotedTable}\n(\n{string.Join(",\n", columns)}\n)";
        return new ObjectScriptResult { Definition = script };
    }
}
