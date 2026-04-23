using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Ssmsx.Core.Connections;
using Ssmsx.Protocol.Messages;

namespace Ssmsx.Core.Query;

public partial class IntelliSenseService
{
    private readonly ConnectionManager _connectionManager;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _connectionLocks = new();

    /// <summary>
    /// Default command timeout in seconds for IntelliSense metadata queries.
    /// Kept low to avoid blocking the UI for unresponsive databases.
    /// </summary>
    private const int DefaultCommandTimeoutSeconds = 10;

    public IntelliSenseService(ConnectionManager connectionManager)
    {
        _connectionManager = connectionManager;
    }

    private SemaphoreSlim GetConnectionLock(string connectionId)
    {
        return _connectionLocks.GetOrAdd(connectionId, _ => new SemaphoreSlim(1, 1));
    }

    [GeneratedRegex(@"^[a-zA-Z0-9_ .\-]+$")]
    private static partial Regex SafeNameRegex();

    private static void ValidateDatabaseName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Database name cannot be empty");
        if (!SafeNameRegex().IsMatch(name))
            throw new ArgumentException($"Invalid database name: {name}");
    }

    public async Task<IntelliSenseMetadata> GetMetadataAsync(string connectionId, string database, CancellationToken ct = default)
    {
        ValidateDatabaseName(database);
        var semaphore = GetConnectionLock(connectionId);
        await semaphore.WaitAsync(ct);
        try
        {
            var connection = _connectionManager.GetConnection(connectionId);
            var originalDb = connection.Database;
            try
            {
                connection.ChangeDatabase(database);

                var tables = await GetTablesAndViewsAsync(connection, ct);
                var columns = await GetColumnsAsync(connection, ct);
                var procedures = await GetProceduresAsync(connection, ct);
                var functions = await GetFunctionsAsync(connection, ct);

                return new IntelliSenseMetadata
                {
                    Tables = tables,
                    Columns = columns,
                    Procedures = procedures,
                    Functions = functions
                };
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

    private static async Task<List<IntelliSenseTable>> GetTablesAndViewsAsync(SqlConnection connection, CancellationToken ct)
    {
        const string sql = """
            SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            ORDER BY TABLE_SCHEMA, TABLE_NAME
            """;

        await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<IntelliSenseTable>();
        while (await reader.ReadAsync(ct))
        {
            var tableType = reader.GetString(2);
            results.Add(new IntelliSenseTable
            {
                Schema = reader.GetString(0),
                Name = reader.GetString(1),
                Type = tableType == "BASE TABLE" ? "table" : "view"
            });
        }
        return results;
    }

    private static async Task<List<IntelliSenseColumn>> GetColumnsAsync(SqlConnection connection, CancellationToken ct)
    {
        const string sql = """
            SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
            """;

        await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<IntelliSenseColumn>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new IntelliSenseColumn
            {
                Schema = reader.GetString(0),
                TableName = reader.GetString(1),
                Name = reader.GetString(2),
                DataType = reader.GetString(3)
            });
        }
        return results;
    }

    private static async Task<List<IntelliSenseProcedure>> GetProceduresAsync(SqlConnection connection, CancellationToken ct)
    {
        const string sql = """
            SELECT s.name AS [schema], p.name
            FROM sys.procedures p
            JOIN sys.schemas s ON p.schema_id = s.schema_id
            ORDER BY s.name, p.name
            """;

        await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<IntelliSenseProcedure>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new IntelliSenseProcedure
            {
                Schema = reader.GetString(0),
                Name = reader.GetString(1)
            });
        }
        return results;
    }

    private static async Task<List<IntelliSenseFunction>> GetFunctionsAsync(SqlConnection connection, CancellationToken ct)
    {
        const string sql = """
            SELECT s.name AS [schema], o.name,
                   CASE o.type
                       WHEN 'FN' THEN 'scalar'
                       WHEN 'IF' THEN 'inline'
                       WHEN 'TF' THEN 'table'
                       ELSE o.type
                   END AS function_type
            FROM sys.objects o
            JOIN sys.schemas s ON o.schema_id = s.schema_id
            WHERE o.type IN ('FN', 'IF', 'TF')
            ORDER BY s.name, o.name
            """;

        await using var cmd = new SqlCommand(sql, connection) { CommandTimeout = DefaultCommandTimeoutSeconds };
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var results = new List<IntelliSenseFunction>();
        while (await reader.ReadAsync(ct))
        {
            results.Add(new IntelliSenseFunction
            {
                Schema = reader.GetString(0),
                Name = reader.GetString(1),
                Type = reader.GetString(2)
            });
        }
        return results;
    }
}
