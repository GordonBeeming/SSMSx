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
var connectionOperations = new ConnectionOperationCoordinator();
var schemaDiscovery = new SchemaDiscoveryService(connectionManager);
var queryCancellationManager = new QueryCancellationManager();
var querySessionManager = new QuerySessionManager(connectionManager);
var queryExecutor = new QueryExecutor(querySessionManager, queryCancellationManager);
var intelliSenseService = new IntelliSenseService(connectionManager);
var requestCancellation = new ConcurrentDictionary<string, CancellationTokenSource>();
var cancelledRequestIds = new ConcurrentDictionary<string, DateTimeOffset>();
var activeQueryTasks = new ConcurrentDictionary<string, Task>();
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

    ["connection.reassignColorProfile"] = async p =>
    {
        var args = Deserialize<ConnectionReassignColorProfileParams>(
            p,
            ProtocolJsonContext.Default.ConnectionReassignColorProfileParams);
        var updatedCount = await connectionStore.ReassignColorProfileAsync(
            args.FromProfileId,
            args.ToProfileId);
        return JsonSerializer.SerializeToElement(
            new ConnectionReassignColorProfileResult { UpdatedCount = updatedCount },
            ProtocolJsonContext.Default.ConnectionReassignColorProfileResult);
    },

    ["connection.disconnect"] = async p =>
    {
        var args = Deserialize<ConnectionDisconnectParams>(p, ProtocolJsonContext.Default.ConnectionDisconnectParams);
        await connectionManager.DisconnectAsync(args.Id);
        await querySessionManager.CloseConnectionSessionsAsync(args.Id);
        return JsonSerializer.SerializeToElement(true, ProtocolJsonContext.Default.Boolean);
    },

    ["query.sessionClose"] = async p =>
    {
        var args = Deserialize<QuerySessionCloseParams>(p, ProtocolJsonContext.Default.QuerySessionCloseParams);
        var closed = await querySessionManager.CloseSessionAsync(args.SessionId, args.ConnectionId);
        return JsonSerializer.SerializeToElement(
            new QuerySessionCloseResult { Closed = closed },
            ProtocolJsonContext.Default.QuerySessionCloseResult);
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
    ["connection.delete"] = async (p, _) =>
    {
        var args = Deserialize<ConnectionDeleteParams>(p, ProtocolJsonContext.Default.ConnectionDeleteParams);
        return await connectionOperations.RunAsync(args.Id, async () =>
        {
            await connectionManager.DisconnectAsync(args.Id);
            await querySessionManager.CloseConnectionSessionsAsync(args.Id);
            try { await credentialStore.DeleteAsync($"ssmsx/{args.Id}"); }
            catch (Exception ex) { await Console.Error.WriteLineAsync($"Warning: Failed to delete credential for connection '{args.Id}': {ex.Message}"); }
            var deleted = await connectionStore.DeleteAsync(args.Id);
            return JsonSerializer.SerializeToElement(
                new ConnectionDeleteResult { Deleted = deleted },
                ProtocolJsonContext.Default.ConnectionDeleteResult);
        });
    },

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
        return await connectionOperations.RunAsync(args.Id, async () =>
        {
            await connectionManager.DisconnectAsync(args.Id);
            await querySessionManager.CloseConnectionSessionsAsync(args.Id);
            var connId = await connectionManager.ConnectAsync(args.Id, connectionStore, credentialStore, ct);
            return JsonSerializer.SerializeToElement(
                new ConnectionConnectResult { ConnectionId = connId },
                ProtocolJsonContext.Default.ConnectionConnectResult);
        }, ct);
    },
};

// --- Request processing ---
// A dedicated reader keeps cancellation responsive while the main loop dispatches
// query executions without waiting for other query windows to finish.
var requestQueue = new BlockingCollection<string>();

// SqlCommand.Cancel is thread-safe, so query cancellation can bypass the queue.
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
            DispatchQueryExecute(request.Id, request.Params);
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

foreach (var queryId in activeQueryTasks.Keys)
    queryCancellationManager.Cancel(queryId);
await Task.WhenAll(activeQueryTasks.Values);
await querySessionManager.DisposeAsync();

// --- query.execute handler ---
void DispatchQueryExecute(string requestId, JsonElement? p)
{
    var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    if (!activeQueryTasks.TryAdd(requestId, completion.Task))
    {
        SendError(requestId, "INVALID_REQUEST", $"A query request with ID '{requestId}' is already active");
        return;
    }

    var cts = new CancellationTokenSource();
    queryCancellationManager.Register(requestId, cts);

    _ = Task.Run(async () =>
    {
        try
        {
            await HandleQueryExecute(requestId, p, cts);
        }
        catch (Exception ex)
        {
            await Console.Error.WriteLineAsync($"Unexpected error dispatching query '{requestId}': {ex}");
            SendError(requestId, "INTERNAL_ERROR", ex.Message);
        }
        finally
        {
            queryCancellationManager.Remove(requestId);
            completion.TrySetResult();
            activeQueryTasks.TryRemove(requestId, out _);
        }
    });
}

async Task HandleQueryExecute(string requestId, JsonElement? p, CancellationTokenSource cts)
{
    var args = Deserialize<QueryExecuteParams>(p, ProtocolJsonContext.Default.QueryExecuteParams);
    var queryId = requestId;

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
            args.SessionId,
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
