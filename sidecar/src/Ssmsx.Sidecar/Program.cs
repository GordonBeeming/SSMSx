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
        // Store password in keychain if provided
        ConnectionInfo saved;
        if (!string.IsNullOrEmpty(args.Password))
        {
            var credKey = $"ssmsx/{args.Connection.Id}";
            await credentialStore.StoreAsync(credKey, args.Password);
            // Save connection with credential reference
            saved = args.Connection with { CredentialRef = credKey };
            await connectionStore.SaveAsync(saved);
        }
        else if (args.ClearCredential)
        {
            // Explicitly clear stored credential
            var existing = await connectionStore.GetAsync(args.Connection.Id);
            if (existing?.CredentialRef != null)
            {
                try
                {
                    await credentialStore.DeleteAsync(existing.CredentialRef);
                }
                catch (Exception ex)
                {
                    await Console.Error.WriteLineAsync($"Warning: Failed to delete credential '{existing.CredentialRef}' for connection '{args.Connection.Id}': {ex.Message}");
                }
            }
            saved = args.Connection with { CredentialRef = null };
            await connectionStore.SaveAsync(saved);
        }
        else
        {
            // No new password and no clear request — preserve existing credential
            var existing = await connectionStore.GetAsync(args.Connection.Id);
            if (existing?.CredentialRef != null)
            {
                saved = args.Connection with { CredentialRef = existing.CredentialRef };
            }
            else
            {
                saved = args.Connection;
            }
            await connectionStore.SaveAsync(saved);
        }
        return JsonSerializer.SerializeToElement(saved, ProtocolJsonContext.Default.ConnectionInfo);
    },

    ["connection.delete"] = async p =>
    {
        var args = Deserialize<ConnectionDeleteParams>(p, ProtocolJsonContext.Default.ConnectionDeleteParams);
        // Try to delete credential from keychain
        try
        {
            await credentialStore.DeleteAsync($"ssmsx/{args.Id}");
        }
        catch (Exception ex)
        {
            await Console.Error.WriteLineAsync($"Warning: Failed to delete credential for connection '{args.Id}': {ex.Message}");
        }
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

    // Explorer methods
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

    // IntelliSense methods
    ["intellisense.getMetadata"] = async p =>
    {
        var args = Deserialize<IntelliSenseGetMetadataParams>(p, ProtocolJsonContext.Default.IntelliSenseGetMetadataParams);
        var result = await intelliSenseService.GetMetadataAsync(args.ConnectionId, args.Database);
        return JsonSerializer.SerializeToElement(result, ProtocolJsonContext.Default.IntelliSenseMetadata);
    },

    // Query methods
    ["query.cancel"] = async p =>
    {
        var args = Deserialize<QueryCancelParams>(p, ProtocolJsonContext.Default.QueryCancelParams);
        var cancelled = queryCancellationManager.Cancel(args.QueryId);
        return JsonSerializer.SerializeToElement(
            new QueryCancelResult { Cancelled = cancelled },
            ProtocolJsonContext.Default.QueryCancelResult);
    }
};

// Lock object to prevent interleaving of JSON-RPC responses on stdout
var writerLock = new object();

// Streaming handlers: these write multiple JSON-RPC responses for a single request
var streamingHandlers = new Dictionary<string, Func<string, JsonElement?, StreamWriter, Task>>
{
    ["query.execute"] = async (requestId, p, w) =>
    {
        var args = Deserialize<QueryExecuteParams>(p, ProtocolJsonContext.Default.QueryExecuteParams);
        var queryId = Guid.NewGuid().ToString();
        using var cts = new CancellationTokenSource();
        queryCancellationManager.Register(queryId, cts);

        try
        {
            await queryExecutor.ExecuteAsync(
                args.ConnectionId,
                args.Database,
                args.Sql,
                queryId,
                async batch =>
                {
                    var resultElement = JsonSerializer.SerializeToElement(batch, ProtocolJsonContext.Default.QueryExecuteResult);
                    var response = new JsonRpcResponse { Id = requestId, Result = resultElement };
                    var json = JsonSerializer.Serialize(response, ProtocolJsonContext.Default.JsonRpcResponse);
                    lock (writerLock)
                    {
                        w.WriteLine(json);
                    }
                },
                cts.Token);
        }
        catch (Exception ex)
        {
            await Console.Error.WriteLineAsync($"Error executing query '{queryId}': {ex.Message}");
            var errorResponse = new JsonRpcResponse
            {
                Id = requestId,
                Error = new JsonRpcError { Code = "QUERY_ERROR", Message = ex.Message }
            };
            var errorJson = JsonSerializer.Serialize(errorResponse, ProtocolJsonContext.Default.JsonRpcResponse);
            lock (writerLock)
            {
                w.WriteLine(errorJson);
            }
        }
    }
};

await using var stdout = Console.OpenStandardOutput();
using var writer = new StreamWriter(stdout) { AutoFlush = true };

string? line;
while ((line = Console.ReadLine()) is not null)
{
    if (string.IsNullOrWhiteSpace(line))
        continue;

    JsonRpcResponse response;
    string requestId = "unknown";
    try
    {
        var request = JsonSerializer.Deserialize(line, ProtocolJsonContext.Default.JsonRpcRequest);
        if (request is null)
        {
            response = new JsonRpcResponse
            {
                Id = "unknown",
                Error = new JsonRpcError { Code = "INVALID_REQUEST", Message = "Deserialized request was null" }
            };
            var nullJson = JsonSerializer.Serialize(response, ProtocolJsonContext.Default.JsonRpcResponse);
            await writer.WriteLineAsync(nullJson);
            continue;
        }

        requestId = request.Id;

        // Check streaming handlers first — they write their own responses
        if (streamingHandlers.TryGetValue(request.Method, out var streamHandler))
        {
            await streamHandler(request.Id, request.Params, writer);
            continue;
        }

        if (handlers.TryGetValue(request.Method, out var handler))
        {
            var result = await handler(request.Params);
            response = new JsonRpcResponse { Id = request.Id, Result = result };
        }
        else
        {
            response = new JsonRpcResponse
            {
                Id = request.Id,
                Error = new JsonRpcError { Code = "METHOD_NOT_FOUND", Message = $"Unknown method: {request.Method}" }
            };
        }
    }
    catch (JsonException ex)
    {
        response = new JsonRpcResponse
        {
            Id = "unknown",
            Error = new JsonRpcError { Code = "PARSE_ERROR", Message = ex.Message }
        };
    }
    catch (Exception ex)
    {
        response = new JsonRpcResponse
        {
            Id = requestId,
            Error = new JsonRpcError { Code = "INTERNAL_ERROR", Message = ex.Message }
        };
    }

    var json = JsonSerializer.Serialize(response, ProtocolJsonContext.Default.JsonRpcResponse);
    await writer.WriteLineAsync(json);
}

// Helper to deserialize params with proper error handling
static T Deserialize<T>(JsonElement? element, System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> typeInfo)
{
    if (element is null)
        throw new ArgumentException($"Missing params for {typeof(T).Name}");
    return JsonSerializer.Deserialize(element.Value, typeInfo)
        ?? throw new ArgumentException($"Failed to deserialize params for {typeof(T).Name}");
}
