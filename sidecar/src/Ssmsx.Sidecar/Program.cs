using System.Collections.Concurrent;
using System.Text.Json;
using Ssmsx.Protocol;
using Ssmsx.Protocol.Messages;
using Ssmsx.Protocol.Models;
using Ssmsx.Core.Storage;
using Ssmsx.Core.Connections;
using Ssmsx.Core.Credentials;
using Ssmsx.Core.Explorer;
using Ssmsx.Core.Query;

// Disable stdout buffering for real-time communication
Console.OutputEncoding = System.Text.Encoding.UTF8;

// Initialize shared services
var connectionStore = new ConnectionStore();
var credentialStore = CredentialStoreFactory.Create();
var connectionManager = new ConnectionManager();
var schemaDiscovery = new SchemaDiscoveryService(connectionManager);
var queryCancellationManager = new QueryCancellationManager();
var queryExecutor = new QueryExecutor(connectionManager, queryCancellationManager);
var intelliSenseService = new IntelliSenseService(connectionManager);

await using var stdout = Console.OpenStandardOutput();
using var writer = new StreamWriter(stdout) { AutoFlush = true };

// All stdout writes MUST go through this to prevent interleaving
var writerLock = new object();
void WriteResponse(string json)
{
    lock (writerLock) { writer.WriteLine(json); }
}

void SendResult(string requestId, JsonElement result)
{
    var response = new JsonRpcResponse { Id = requestId, Result = result };
    WriteResponse(JsonSerializer.Serialize(response, ProtocolJsonContext.Default.JsonRpcResponse));
}

void SendError(string requestId, string code, string message)
{
    var response = new JsonRpcResponse
    {
        Id = requestId,
        Error = new JsonRpcError { Code = code, Message = message }
    };
    WriteResponse(JsonSerializer.Serialize(response, ProtocolJsonContext.Default.JsonRpcResponse));
}

var handlers = new Dictionary<string, Func<JsonElement?, Task<JsonElement>>>
{
    ["ping"] = _ => Task.FromResult(JsonSerializer.SerializeToElement(
        new PingResult { Message = "pong", Version = "0.1.0" },
        ProtocolJsonContext.Default.PingResult)),

    ["connection.list"] = async _ =>
    {
        var connections = await connectionStore.ListAsync();
        return JsonSerializer.SerializeToElement(connections, ProtocolJsonContext.Default.ListConnectionInfo);
    },

    ["connection.get"] = async p =>
    {
        var args = Deserialize<ConnectionGetParams>(p, ProtocolJsonContext.Default.ConnectionGetParams);
        var connection = await connectionStore.GetAsync(args.Id);
        return connection is not null
            ? JsonSerializer.SerializeToElement(connection, ProtocolJsonContext.Default.ConnectionInfo)
            : JsonSerializer.SerializeToElement<object?>(null, ProtocolJsonContext.Default.Object);
    },

    ["connection.save"] = async p =>
    {
        var args = Deserialize<ConnectionSaveParams>(p, ProtocolJsonContext.Default.ConnectionSaveParams);
        ConnectionInfo saved;
        if (!string.IsNullOrEmpty(args.Password))
        {
            var credKey = $"ssmsx/{args.Connection.Id}";
            await credentialStore.StoreAsync(credKey, args.Password);
            saved = args.Connection with { CredentialRef = credKey };
            await connectionStore.SaveAsync(saved);
        }
        else if (args.ClearCredential)
        {
            var existing = await connectionStore.GetAsync(args.Connection.Id);
            if (existing?.CredentialRef != null)
            {
                try { await credentialStore.DeleteAsync(existing.CredentialRef); }
                catch (Exception ex) { await Console.Error.WriteLineAsync($"Warning: Failed to delete credential '{existing.CredentialRef}': {ex.Message}"); }
            }
            saved = args.Connection with { CredentialRef = null };
            await connectionStore.SaveAsync(saved);
        }
        else
        {
            var existing = await connectionStore.GetAsync(args.Connection.Id);
            saved = existing?.CredentialRef != null
                ? args.Connection with { CredentialRef = existing.CredentialRef }
                : args.Connection;
            await connectionStore.SaveAsync(saved);
        }
        return JsonSerializer.SerializeToElement(saved, ProtocolJsonContext.Default.ConnectionInfo);
    },

    ["connection.delete"] = async p =>
    {
        var args = Deserialize<ConnectionDeleteParams>(p, ProtocolJsonContext.Default.ConnectionDeleteParams);
        try { await credentialStore.DeleteAsync($"ssmsx/{args.Id}"); }
        catch (Exception ex) { await Console.Error.WriteLineAsync($"Warning: Failed to delete credential for connection '{args.Id}': {ex.Message}"); }
        var deleted = await connectionStore.DeleteAsync(args.Id);
        return JsonSerializer.SerializeToElement(
            new ConnectionDeleteResult { Deleted = deleted },
            ProtocolJsonContext.Default.ConnectionDeleteResult);
    },

    ["connection.test"] = async p =>
    {
        var args = Deserialize<ConnectionTestParams>(p, ProtocolJsonContext.Default.ConnectionTestParams);
        try
        {
            await connectionManager.TestAsync(args.Connection, credentialStore, args.Password);
            return JsonSerializer.SerializeToElement(
                new ConnectionTestResult { Success = true },
                ProtocolJsonContext.Default.ConnectionTestResult);
        }
        catch (Exception ex)
        {
            return JsonSerializer.SerializeToElement(
                new ConnectionTestResult { Success = false, Error = ex.Message },
                ProtocolJsonContext.Default.ConnectionTestResult);
        }
    },

    ["connection.connect"] = async p =>
    {
        var args = Deserialize<ConnectionConnectParams>(p, ProtocolJsonContext.Default.ConnectionConnectParams);
        var connId = await connectionManager.ConnectAsync(args.Id, connectionStore, credentialStore);
        return JsonSerializer.SerializeToElement(
            new ConnectionConnectResult { ConnectionId = connId },
            ProtocolJsonContext.Default.ConnectionConnectResult);
    },

    ["connection.disconnect"] = async p =>
    {
        var args = Deserialize<ConnectionDisconnectParams>(p, ProtocolJsonContext.Default.ConnectionDisconnectParams);
        await connectionManager.DisconnectAsync(args.Id);
        return JsonSerializer.SerializeToElement(true, ProtocolJsonContext.Default.Boolean);
    },

    ["explorer.databases"] = async p =>
    {
        var args = Deserialize<ExplorerDatabasesParams>(p, ProtocolJsonContext.Default.ExplorerDatabasesParams);
        var result = await schemaDiscovery.GetDatabasesAsync(args.ConnectionId);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ListDatabaseInfo);
    },

    ["explorer.tables"] = async p =>
    {
        var args = Deserialize<ExplorerTablesParams>(p, ProtocolJsonContext.Default.ExplorerTablesParams);
        var result = await schemaDiscovery.GetTablesAsync(args.ConnectionId, args.Database);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ListTableInfo);
    },

    ["explorer.views"] = async p =>
    {
        var args = Deserialize<ExplorerViewsParams>(p, ProtocolJsonContext.Default.ExplorerViewsParams);
        var result = await schemaDiscovery.GetViewsAsync(args.ConnectionId, args.Database);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ListViewInfo);
    },

    ["explorer.columns"] = async p =>
    {
        var args = Deserialize<ExplorerColumnsParams>(p, ProtocolJsonContext.Default.ExplorerColumnsParams);
        var result = await schemaDiscovery.GetColumnsAsync(args.ConnectionId, args.Database, args.Schema, args.ObjectName);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ListColumnInfo);
    },

    ["explorer.keys"] = async p =>
    {
        var args = Deserialize<ExplorerKeysParams>(p, ProtocolJsonContext.Default.ExplorerKeysParams);
        var result = await schemaDiscovery.GetKeysAsync(args.ConnectionId, args.Database, args.Schema, args.TableName);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ListKeyInfo);
    },

    ["explorer.indexes"] = async p =>
    {
        var args = Deserialize<ExplorerIndexesParams>(p, ProtocolJsonContext.Default.ExplorerIndexesParams);
        var result = await schemaDiscovery.GetIndexesAsync(args.ConnectionId, args.Database, args.Schema, args.TableName);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ListIndexInfo);
    },

    ["explorer.procedures"] = async p =>
    {
        var args = Deserialize<ExplorerProceduresParams>(p, ProtocolJsonContext.Default.ExplorerProceduresParams);
        var result = await schemaDiscovery.GetProceduresAsync(args.ConnectionId, args.Database);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ListStoredProcedureInfo);
    },

    ["explorer.functions"] = async p =>
    {
        var args = Deserialize<ExplorerFunctionsParams>(p, ProtocolJsonContext.Default.ExplorerFunctionsParams);
        var result = await schemaDiscovery.GetFunctionsAsync(args.ConnectionId, args.Database);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ListFunctionInfo);
    },

    ["explorer.users"] = async p =>
    {
        var args = Deserialize<ExplorerUsersParams>(p, ProtocolJsonContext.Default.ExplorerUsersParams);
        var result = await schemaDiscovery.GetUsersAsync(args.ConnectionId, args.Database);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ListDatabaseUserInfo);
    },

    ["explorer.objectDefinition"] = async p =>
    {
        var args = Deserialize<ExplorerObjectDefinitionParams>(p, ProtocolJsonContext.Default.ExplorerObjectDefinitionParams);
        var result = await schemaDiscovery.GetObjectDefinitionAsync(args.ConnectionId, args.Database, args.Schema, args.ObjectName, args.ObjectType);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.ObjectScriptResult);
    },

    ["intellisense.getMetadata"] = async p =>
    {
        var args = Deserialize<IntelliSenseGetMetadataParams>(p, ProtocolJsonContext.Default.IntelliSenseGetMetadataParams);
        var result = await intelliSenseService.GetMetadataAsync(args.ConnectionId, args.Database);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.IntelliSenseMetadata);
    },

    // Note: query.cancel is handled directly on the stdin reader thread
    // (not here) so it works even while a query blocks the main loop.
};

// --- Request processing ---
// We use a concurrent queue + semaphore so a background stdin reader can enqueue
// requests while the main processing loop handles them one at a time.
// This allows query.cancel to be queued and processed between query batches,
// since async awaits yield control to process the next queued request.
var requestQueue = new BlockingCollection<string>();

// Background stdin reader — reads lines and enqueues them.
// Cancel requests are handled inline on this thread (SqlCommand.Cancel is thread-safe)
// so they work even while a query is blocking the main processing loop.
var stdinReader = new Thread(() =>
{
    string? inputLine;
    while ((inputLine = Console.ReadLine()) is not null)
    {
        if (string.IsNullOrWhiteSpace(inputLine))
            continue;

        // Fast-path: handle query.cancel directly on the reader thread
        // so it works even while the main loop is blocked on a streaming query
        try
        {
            var peek = JsonSerializer.Deserialize(inputLine, ProtocolJsonContext.Default.JsonRpcRequest);
            if (peek is not null && peek.Method == "query.cancel")
            {
                try
                {
                    var cancelArgs = Deserialize<QueryCancelParams>(peek.Params, ProtocolJsonContext.Default.QueryCancelParams);
                    var cancelled = queryCancellationManager.Cancel(cancelArgs.QueryId);
                    var cancelResult = JsonSerializer.SerializeToElement(
                        new QueryCancelResult { Cancelled = cancelled },
                        ProtocolJsonContext.Default.QueryCancelResult);
                    SendResult(peek.Id, cancelResult);
                }
                catch (Exception ex)
                {
                    SendError(peek.Id, "CANCEL_ERROR", ex.Message);
                }
                continue; // Don't enqueue — already handled
            }
        }
        catch
        {
            // If parsing fails, let the main loop handle the error
        }

        requestQueue.Add(inputLine);
    }
    requestQueue.CompleteAdding();
})
{
    IsBackground = true,
    Name = "StdinReader"
};
stdinReader.Start();

// Main processing loop — processes requests from the queue
foreach (var requestLine in requestQueue.GetConsumingEnumerable())
{
    string requestId = "unknown";
    try
    {
        var request = JsonSerializer.Deserialize(requestLine, ProtocolJsonContext.Default.JsonRpcRequest);
        if (request is null)
        {
            SendError("unknown", "INVALID_REQUEST", "Deserialized request was null");
            continue;
        }

        requestId = request.Id;

        // query.execute streams multiple responses, then completes
        if (request.Method == "query.execute")
        {
            await HandleQueryExecute(request.Id, request.Params);
            continue;
        }

        if (handlers.TryGetValue(request.Method, out var handler))
        {
            var result = await handler(request.Params);
            SendResult(request.Id, result);
        }
        else
        {
            SendError(request.Id, "METHOD_NOT_FOUND", $"Unknown method: {request.Method}");
        }
    }
    catch (JsonException ex)
    {
        SendError("unknown", "PARSE_ERROR", ex.Message);
    }
    catch (Exception ex)
    {
        SendError(requestId, "INTERNAL_ERROR", ex.Message);
    }
}

// --- query.execute handler ---
async Task HandleQueryExecute(string requestId, JsonElement? p)
{
    var args = Deserialize<QueryExecuteParams>(p, ProtocolJsonContext.Default.QueryExecuteParams);
    var queryId = Guid.NewGuid().ToString();
    using var cts = new CancellationTokenSource();
    queryCancellationManager.Register(queryId, cts);

    // Send immediate "started" response so frontend knows the queryId for cancellation
    {
        var startBatch = new QueryExecuteResult
        {
            QueryId = queryId,
            Batch = 0,
            Done = false
        };
        SendResult(requestId, JsonSerializer.SerializeToElement(startBatch, ProtocolJsonContext.Default.QueryExecuteResult));
    }

    try
    {
        await queryExecutor.ExecuteAsync(
            args.ConnectionId,
            args.Database,
            args.Sql,
            queryId,
            batch =>
            {
                SendResult(requestId, JsonSerializer.SerializeToElement(batch, ProtocolJsonContext.Default.QueryExecuteResult));
                return Task.CompletedTask;
            },
            cts.Token);
    }
    catch (Exception ex)
    {
        await Console.Error.WriteLineAsync($"Error executing query '{queryId}': {ex.Message}");
        SendError(requestId, "QUERY_ERROR", ex.Message);
    }
}

// Helper to deserialize params with proper error handling
static T Deserialize<T>(JsonElement? element, System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> typeInfo)
{
    if (element is null)
        throw new ArgumentException($"Missing params for {typeof(T).Name}");
    return JsonSerializer.Deserialize(element.Value, typeInfo)
        ?? throw new ArgumentException($"Failed to deserialize params for {typeof(T).Name}");
}
