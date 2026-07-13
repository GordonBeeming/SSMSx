using System.Data.SqlTypes;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Ssmsx.Core.Connections;
using Ssmsx.Protocol.Messages;
using Ssmsx.Protocol.Models;

namespace Ssmsx.Core.Query;

/// <summary>
/// Executes SQL queries against active connections, streaming results in batches
/// and supporting cooperative cancellation.
/// </summary>
public class QueryExecutor
{
    private static readonly Regex BatchSeparator = new(
        @"^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$",
        RegexOptions.IgnoreCase | RegexOptions.Multiline | RegexOptions.CultureInvariant);

    private readonly ConnectionManager _connectionManager;
    private readonly QueryCancellationManager _cancellationManager;

    /// <summary>
    /// The number of rows to include in each streamed batch.
    /// </summary>
    private const int BatchSize = 5000;

    /// <summary>
    /// Default command timeout in seconds. Zero means no timeout (queries can run indefinitely,
    /// cancellation is handled via the CancellationToken and QueryCancellationManager).
    /// </summary>
    private const int DefaultCommandTimeoutSeconds = 0;

    public QueryExecutor(ConnectionManager connectionManager, QueryCancellationManager cancellationManager)
    {
        _connectionManager = connectionManager ?? throw new ArgumentNullException(nameof(connectionManager));
        _cancellationManager = cancellationManager ?? throw new ArgumentNullException(nameof(cancellationManager));
    }

    /// <summary>
    /// Executes a SQL query, streaming result batches via the onBatch callback.
    /// Supports multiple result sets and cooperative cancellation.
    /// </summary>
    /// <param name="connectionId">The ID of the active connection to use.</param>
    /// <param name="database">The database context to execute the query against.</param>
    /// <param name="sql">The SQL text to execute.</param>
    /// <param name="queryId">A unique identifier for this query execution.</param>
    /// <param name="onBatch">Callback invoked for each batch of results.</param>
    /// <param name="ct">Cancellation token for cooperative cancellation.</param>
    public async Task ExecuteAsync(
        string connectionId,
        string database,
        string sql,
        string queryId,
        Func<QueryExecuteResult, Task> onBatch,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(connectionId))
            throw new ArgumentException("Connection ID cannot be null or empty.", nameof(connectionId));
        if (string.IsNullOrWhiteSpace(database))
            throw new ArgumentException("Database cannot be null or empty.", nameof(database));
        if (string.IsNullOrWhiteSpace(sql))
            throw new ArgumentException("SQL cannot be null or empty.", nameof(sql));
        if (string.IsNullOrWhiteSpace(queryId))
            throw new ArgumentException("Query ID cannot be null or empty.", nameof(queryId));
        ArgumentNullException.ThrowIfNull(onBatch);

        var connection = _connectionManager.GetConnection(connectionId);
        var messages = new List<QueryMessage>();
        var stopwatch = new Stopwatch();
        long totalRows = 0;
        int batchNumber = 0;

        // Hook into InfoMessage for PRINT statements and non-fatal errors
        SqlInfoMessageEventHandler infoMessageHandler = (sender, args) =>
        {
            foreach (SqlError error in args.Errors)
            {
                var severity = error.Class > 10 ? "error" : "info";
                messages.Add(new QueryMessage
                {
                    Text = error.Message,
                    Severity = severity,
                    LineNumber = error.LineNumber > 0 ? error.LineNumber : null
                });
            }
        };

        connection.InfoMessage += infoMessageHandler;
        try
        {
            connection.ChangeDatabase(database);
            stopwatch.Start();
            int resultSetIndex = 0;

            foreach (var batchSql in SplitBatches(sql))
            {
                ct.ThrowIfCancellationRequested();

                await using var cmd = new SqlCommand(batchSql, connection)
                {
                    CommandTimeout = DefaultCommandTimeoutSeconds
                };

                _cancellationManager.SetCommand(queryId, cmd);

                await using var reader = await cmd.ExecuteReaderAsync(ct);

                do
                {
                    // Read column metadata for this result set
                    var columns = ReadColumnMetadata(reader);
                    bool isFirstBatchForResultSet = true;

                    var rowBuffer = new List<List<object?>>();

                    while (await reader.ReadAsync(ct))
                    {
                        var row = ReadRow(reader);
                        rowBuffer.Add(row);
                        totalRows++;

                        if (rowBuffer.Count >= BatchSize)
                        {
                            batchNumber++;
                            var batch = new QueryExecuteResult
                            {
                                QueryId = queryId,
                                Columns = isFirstBatchForResultSet ? columns : null,
                                Rows = rowBuffer,
                                Batch = batchNumber,
                                Done = false,
                                ResultSetIndex = resultSetIndex,
                                Database = connection.Database
                            };

                            await onBatch(batch);
                            rowBuffer = new List<List<object?>>();
                            isFirstBatchForResultSet = false;
                        }
                    }

                    // Send remaining rows for this result set (or an empty batch with columns if no rows)
                    if (rowBuffer.Count > 0 || isFirstBatchForResultSet)
                    {
                        batchNumber++;
                        var batch = new QueryExecuteResult
                        {
                            QueryId = queryId,
                            Columns = isFirstBatchForResultSet ? columns : null,
                            Rows = rowBuffer.Count > 0 ? rowBuffer : null,
                            Batch = batchNumber,
                            Done = false,
                            ResultSetIndex = resultSetIndex,
                            Database = connection.Database
                        };

                        await onBatch(batch);
                    }

                    resultSetIndex++;
                }
                while (await reader.NextResultAsync(ct));
            }

            stopwatch.Stop();

            // Send final "done" batch
            batchNumber++;
            var finalBatch = new QueryExecuteResult
            {
                QueryId = queryId,
                Batch = batchNumber,
                Done = true,
                ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                TotalRows = totalRows,
                Messages = messages.Count > 0 ? messages : null,
                Database = connection.Database
            };

            await onBatch(finalBatch);
        }
        catch (OperationCanceledException)
        {
            stopwatch.Stop();

            messages.Add(new QueryMessage
            {
                Text = "Query execution was cancelled by the user.",
                Severity = "info"
            });

            batchNumber++;
            var cancelledBatch = new QueryExecuteResult
            {
                QueryId = queryId,
                Batch = batchNumber,
                Done = true,
                ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                TotalRows = totalRows,
                Messages = messages.Count > 0 ? messages : null,
                Database = connection.Database
            };

            await onBatch(cancelledBatch);
        }
        catch (SqlException ex) when (ex.Number == 0 && ex.Message.Contains("Operation cancelled"))
        {
            // SqlCommand.Cancel() can throw SqlException with this pattern
            stopwatch.Stop();

            messages.Add(new QueryMessage
            {
                Text = "Query execution was cancelled by the user.",
                Severity = "info"
            });

            batchNumber++;
            var cancelledBatch = new QueryExecuteResult
            {
                QueryId = queryId,
                Batch = batchNumber,
                Done = true,
                ExecutionTimeMs = stopwatch.ElapsedMilliseconds,
                TotalRows = totalRows,
                Messages = messages.Count > 0 ? messages : null,
                Database = connection.Database
            };

            await onBatch(cancelledBatch);
        }
        finally
        {
            connection.InfoMessage -= infoMessageHandler;
            _cancellationManager.Remove(queryId);
        }
    }

    internal static IEnumerable<string> SplitBatches(string sql)
    {
        var batches = new List<string>();
        var currentBatch = new StringBuilder();
        var inString = false;
        var blockCommentDepth = 0;

        using var reader = new StringReader(sql);
        while (reader.ReadLine() is { } line)
        {
            if (!inString && blockCommentDepth == 0 && BatchSeparator.IsMatch(line))
            {
                AddBatch(batches, currentBatch);
                continue;
            }

            if (currentBatch.Length > 0)
                currentBatch.AppendLine();
            currentBatch.Append(line);
            TrackSqlState(line, ref inString, ref blockCommentDepth);
        }

        AddBatch(batches, currentBatch);
        return batches;
    }

    private static void AddBatch(List<string> batches, StringBuilder batch)
    {
        if (!string.IsNullOrWhiteSpace(batch.ToString()))
            batches.Add(batch.ToString());
        batch.Clear();
    }

    private static void TrackSqlState(string line, ref bool inString, ref int blockCommentDepth)
    {
        for (var i = 0; i < line.Length; i++)
        {
            if (inString)
            {
                if (line[i] != '\'')
                    continue;
                if (i + 1 < line.Length && line[i + 1] == '\'')
                    i++;
                else
                    inString = false;
                continue;
            }

            if (blockCommentDepth > 0)
            {
                if (i + 1 < line.Length && line[i] == '/' && line[i + 1] == '*')
                {
                    blockCommentDepth++;
                    i++;
                }
                else if (i + 1 < line.Length && line[i] == '*' && line[i + 1] == '/')
                {
                    blockCommentDepth--;
                    i++;
                }
                continue;
            }

            if (i + 1 < line.Length && line[i] == '-' && line[i + 1] == '-')
                return;
            if (i + 1 < line.Length && line[i] == '/' && line[i + 1] == '*')
            {
                blockCommentDepth++;
                i++;
            }
            else if (line[i] == '\'')
            {
                inString = true;
            }
        }
    }

    /// <summary>
    /// Reads column metadata from the current result set of a SqlDataReader.
    /// </summary>
    private static List<QueryColumn> ReadColumnMetadata(SqlDataReader reader)
    {
        var columns = new List<QueryColumn>();
        for (int i = 0; i < reader.FieldCount; i++)
        {
            var column = new QueryColumn
            {
                Name = reader.GetName(i),
                DataType = reader.GetDataTypeName(i),
                IsNullable = true, // Default to nullable; enriched by schema table below
                MaxLength = null
            };
            columns.Add(column);
        }

        // Try to get richer schema info if available
        try
        {
            var schemaTable = reader.GetSchemaTable();
            if (schemaTable is not null)
            {
                for (int i = 0; i < columns.Count && i < schemaTable.Rows.Count; i++)
                {
                    var schemaRow = schemaTable.Rows[i];

                    bool isNullable = columns[i].IsNullable;
                    if (schemaTable.Columns.Contains("AllowDBNull") && schemaRow["AllowDBNull"] is bool allowNull)
                    {
                        isNullable = allowNull;
                    }

                    int? maxLength = null;
                    if (schemaTable.Columns.Contains("ColumnSize") && schemaRow["ColumnSize"] is int colSize && colSize > 0)
                    {
                        maxLength = colSize;
                    }

                    columns[i] = columns[i] with
                    {
                        IsNullable = isNullable,
                        MaxLength = maxLength
                    };
                }
            }
        }
        catch (Exception ex)
        {
            // Schema table is optional enrichment — log but don't fail the query
            Console.Error.WriteLine($"Warning: Could not read schema table for column metadata: {ex.Message}");
        }

        return columns;
    }

    /// <summary>
    /// Reads a single row from the SqlDataReader, converting values to JSON-safe types.
    /// UDT columns (geography, geometry, hierarchyid) are read as raw bytes to avoid
    /// loading Microsoft.SqlServer.Types which we don't ship.
    /// </summary>
    private static List<object?> ReadRow(SqlDataReader reader)
    {
        var row = new List<object?>(reader.FieldCount);
        for (int i = 0; i < reader.FieldCount; i++)
        {
            if (reader.IsDBNull(i))
            {
                row.Add(null);
                continue;
            }

            // Check for UDT types that need Microsoft.SqlServer.Types assembly
            // and read them as raw bytes instead of trying to instantiate the CLR type.
            var typeName = reader.GetDataTypeName(i);
            if (IsUnsupportedUdt(typeName))
            {
                row.Add(ReadUdtAsBytes(reader, i));
                continue;
            }

            try
            {
                var value = reader.GetValue(i);
                row.Add(ConvertToJsonSafeValue(value));
            }
            catch (Exception ex) when (IsAssemblyLoadError(ex))
            {
                // Fallback: the CLR type wasn't recognized ahead of time but needs an
                // assembly we don't have. Read as bytes instead.
                row.Add(ReadUdtAsBytes(reader, i));
            }
        }
        return row;
    }

    private static bool IsUnsupportedUdt(string dataTypeName)
    {
        // Match fully-qualified names like "sys.geography" or short "geography"
        var name = dataTypeName.Split('.').Last().ToLowerInvariant();
        return name is "geography" or "geometry" or "hierarchyid";
    }

    private static bool IsAssemblyLoadError(Exception ex)
    {
        // Walks inner exceptions looking for FileNotFoundException on SqlServer.Types,
        // which is what gets thrown when GetValue() tries to instantiate a spatial type
        // without the assembly available.
        for (var e = ex; e != null; e = e.InnerException)
        {
            if (e is System.IO.FileNotFoundException || e is System.IO.FileLoadException)
                return true;
            if (e.Message.Contains("Microsoft.SqlServer.Types", StringComparison.Ordinal))
                return true;
        }
        return false;
    }

    private static object? ReadUdtAsBytes(SqlDataReader reader, int i)
    {
        try
        {
            var sqlBytes = reader.GetSqlBytes(i);
            if (sqlBytes.IsNull)
                return null;
            return "0x" + Convert.ToHexString(sqlBytes.Value);
        }
        catch (Exception ex)
        {
            return $"<unreadable UDT: {ex.Message}>";
        }
    }

    /// <summary>
    /// Converts a SQL value to a JSON-safe representation.
    /// All values are converted to types registered in ProtocolJsonContext:
    /// null, string, bool, byte, short, int, long, float, double, decimal.
    ///
    /// SQL Server type → CLR type from GetValue() → JSON-safe output:
    ///   bigint          → Int64          → long (kept)
    ///   int             → Int32          → int (kept)
    ///   smallint        → Int16          → short (kept)
    ///   tinyint         → Byte           → byte (kept)
    ///   bit             → Boolean        → bool (kept)
    ///   decimal/numeric → Decimal        → decimal (kept)
    ///   money/smallmoney→ Decimal        → decimal (kept)
    ///   float           → Double         → double (kept)
    ///   real            → Single         → float (kept)
    ///   char/nchar/varchar/nvarchar/text/ntext → String → string (kept)
    ///   date/datetime/datetime2/smalldatetime  → DateTime → string (ISO 8601)
    ///   datetimeoffset  → DateTimeOffset → string (ISO 8601)
    ///   time            → TimeSpan       → string (hh:mm:ss.fffffff)
    ///   uniqueidentifier→ Guid           → string
    ///   binary/varbinary/image/rowversion/timestamp → Byte[] → string (base64)
    ///   xml             → SqlXml         → string (XML content)
    ///   sql_variant     → Object         → recursive (underlying type)
    /// </summary>
    private static object? ConvertToJsonSafeValue(object value)
    {
        return value switch
        {
            // Null
            DBNull => null,

            // Numeric types — kept as-is (registered in ProtocolJsonContext)
            bool b => b,
            byte b => b,
            short s => s,
            int i => i,
            long l => l,
            float f => f,
            double d => d,
            decimal m => m,

            // String types — kept as-is
            string s => s,

            // Binary types → base64 string
            byte[] bytes => Convert.ToBase64String(bytes),

            // Date/time types → ISO 8601 string
            DateTime dt => dt.ToString("O"),
            DateTimeOffset dto => dto.ToString("O"),
            TimeSpan ts => ts.ToString("c"), // constant format: hh:mm:ss.fffffff

            // Guid → string
            Guid guid => guid.ToString(),

            // SqlXml (from SQL xml type) → XML content string
            SqlXml xml => xml.IsNull ? null : xml.Value,

            // Fallback for any unexpected type (e.g. SqlTypes wrappers) → string
            _ => value.ToString()
        };
    }
}
