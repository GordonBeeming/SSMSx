using System.Collections.Concurrent;
using System.Reflection;
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
var requestCancellation = new ConcurrentDictionary<string, CancellationTokenSource>();
var cancelledRequestIds = new ConcurrentDictionary<string, DateTimeOffset>();
var cancelledRequestIdTtl = TimeSpan.FromMinutes(5);

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

void PruneExpiredCancelledRequestIds()
{
    var cutoff = DateTimeOffset.UtcNow - cancelledRequestIdTtl;
    foreach (var entry in cancelledRequestIds)
    {
        if (entry.Value <= cutoff)
        {
            cancelledRequestIds.TryRemove(entry.Key, out _);
        }
    }
}

bool TryConsumeCancelledRequestId(string requestId)
{
    PruneExpiredCancelledRequestIds();
    if (!cancelledRequestIds.TryRemove(requestId, out var cancelledAt))
    {
        return false;
    }

    return DateTimeOffset.UtcNow - cancelledAt <= cancelledRequestIdTtl;
}

var handlers = new Dictionary<string, Func<JsonElement?, Task<JsonElement>>>
{
    ["ping"] = _ => Task.FromResult(JsonSerializer.SerializeToElement(
        new PingResult { Message = "pong", Version = SidecarVersion() },
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
            saved = await connectionStore.SaveAsync(args.Connection);
            var credKey = $"ssmsx/{saved.Id}";
            await credentialStore.StoreAsync(credKey, args.Password);
            saved = await connectionStore.SaveAsync(saved with { CredentialRef = credKey });
        }
        else if (args.ClearCredential)
        {
            saved = await connectionStore.SaveAsync(args.Connection);
            if (saved.CredentialRef != null)
            {
                try { await credentialStore.DeleteAsync(saved.CredentialRef); }
                catch (Exception ex) { await Console.Error.WriteLineAsync($"Warning: Failed to delete credential '{saved.CredentialRef}': {ex.Message}"); }
            }
            saved = await connectionStore.SaveAsync(saved with { CredentialRef = null });
        }
        else
        {
            var existing = await connectionStore.GetAsync(args.Connection.Id);
            var connectionToSave = existing?.CredentialRef != null
                ? args.Connection with { CredentialRef = existing.CredentialRef }
                : args.Connection;
            saved = await connectionStore.SaveAsync(connectionToSave);
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

    ["explorer.databaseDiagram"] = async p =>
    {
        var args = Deserialize<ExplorerDatabaseDiagramParams>(p, ProtocolJsonContext.Default.ExplorerDatabaseDiagramParams);
        var result = await schemaDiscovery.GetDatabaseDiagramAsync(args.ConnectionId, args.Database);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.DatabaseDiagramInfo);
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

static string SidecarVersion()
{
    return Assembly
        .GetExecutingAssembly()
        .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
        ?.InformationalVersion ?? "dev";
}

var cancellableHandlers = new Dictionary<string, Func<JsonElement?, CancellationToken, Task<JsonElement>>>
{
    ["connection.test"] = async (p, ct) =>
    {
        var args = Deserialize<ConnectionTestParams>(p, ProtocolJsonContext.Default.ConnectionTestParams);
        try
        {
            await connectionManager.TestAsync(args.Connection, credentialStore, args.Password, ct);
            return JsonSerializer.SerializeToElement(
                new ConnectionTestResult { Success = true },
                ProtocolJsonContext.Default.ConnectionTestResult);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            await Console.Error.WriteLineAsync($"Connection test failed: {ex}");
            return JsonSerializer.SerializeToElement(
                new ConnectionTestResult { Success = false, Error = ex.Message },
                ProtocolJsonContext.Default.ConnectionTestResult);
        }
    },

    ["connection.connect"] = async (p, ct) =>
    {
        var args = Deserialize<ConnectionConnectParams>(p, ProtocolJsonContext.Default.ConnectionConnectParams);
        var connId = await connectionManager.ConnectAsync(args.Id, connectionStore, credentialStore, ct);
        return JsonSerializer.SerializeToElement(
            new ConnectionConnectResult { ConnectionId = connId },
            ProtocolJsonContext.Default.ConnectionConnectResult);
    },
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
            if (peek is not null && peek.Method == "request.cancel")
            {
                try
                {
                    var cancelArgs = Deserialize<RequestCancelParams>(peek.Params, ProtocolJsonContext.Default.RequestCancelParams);
                    var cancelled = false;
                    if (requestCancellation.TryGetValue(cancelArgs.RequestId, out var cts))
                    {
                        try
                        {
                            cts.Cancel();
                            cancelled = true;
                        }
                        catch (ObjectDisposedException)
                        {
                            cancelled = false;
                        }
                    }
                    else
                    {
                        PruneExpiredCancelledRequestIds();
                        cancelledRequestIds[cancelArgs.RequestId] = DateTimeOffset.UtcNow;
                        cancelled = true;
                    }
                    SendResult(peek.Id, JsonSerializer.SerializeToElement(cancelled, ProtocolJsonContext.Default.Boolean));
                }
                catch (Exception ex)
                {
                    SendError(peek.Id, "CANCEL_ERROR", ex.Message);
                }
                continue;
            }

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

        if (cancellableHandlers.TryGetValue(request.Method, out var cancellableHandler))
        {
            var cts = new CancellationTokenSource();
            requestCancellation[request.Id] = cts;
            if (TryConsumeCancelledRequestId(request.Id))
            {
                cts.Cancel();
            }
            _ = Task.Run(() => HandleCancellableRequest(request, cancellableHandler, cts));
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
    var queryId = requestId;
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

async Task HandleCancellableRequest(
    JsonRpcRequest request,
    Func<JsonElement?, CancellationToken, Task<JsonElement>> handler,
    CancellationTokenSource cts)
{
    try
    {
        var result = await handler(request.Params, cts.Token);
        SendResult(request.Id, result);
    }
    catch (OperationCanceledException)
    {
        SendError(request.Id, "REQUEST_CANCELLED", "Request cancelled");
    }
    catch (Exception ex)
    {
        SendError(request.Id, "INTERNAL_ERROR", ex.Message);
    }
    finally
    {
        requestCancellation.TryRemove(request.Id, out _);
        cancelledRequestIds.TryRemove(request.Id, out _);
        cts.Dispose();
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
