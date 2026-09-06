using System.Text.Json;
using Ssmsx.Protocol;
using Ssmsx.Protocol.Messages;
using Xunit;

namespace Ssmsx.Protocol.Tests;

public class JsonRpcTests
{
    [Fact]
    public void DeserializeRequest_ValidJson_ReturnsRequest()
    {
        var json = """{"id":"test-1","method":"ping","params":null}""";
        var request = JsonSerializer.Deserialize(json, ProtocolJsonContext.Default.JsonRpcRequest);
        Assert.NotNull(request);
        Assert.Equal("test-1", request.Id);
        Assert.Equal("ping", request.Method);
    }

    [Fact]
    public void SerializeResponse_WithResult_CorrectJson()
    {
        var result = JsonSerializer.SerializeToElement(
            new PingResult { Message = "pong", Version = "0.1.0" },
            ProtocolJsonContext.Default.PingResult);
        var response = new JsonRpcResponse { Id = "test-1", Result = result };
        var json = JsonSerializer.Serialize(response, ProtocolJsonContext.Default.JsonRpcResponse);
        Assert.Contains("\"pong\"", json);
        Assert.Contains("\"0.1.0\"", json);
    }

    [Fact]
    public void SerializeResponse_WithError_CorrectJson()
    {
        var response = new JsonRpcResponse
        {
            Id = "test-1",
            Error = new JsonRpcError { Code = "METHOD_NOT_FOUND", Message = "Unknown" }
        };
        var json = JsonSerializer.Serialize(response, ProtocolJsonContext.Default.JsonRpcResponse);
        Assert.Contains("METHOD_NOT_FOUND", json);
        Assert.DoesNotContain("\"result\"", json);
    }

    [Fact]
    public void DeserializeRequest_WithParams_ParsesParams()
    {
        var json = """{"id":"test-2","method":"query.execute","params":{"sql":"SELECT 1"}}""";
        var request = JsonSerializer.Deserialize(json, ProtocolJsonContext.Default.JsonRpcRequest);
        Assert.NotNull(request);
        Assert.NotNull(request.Params);
        Assert.Equal("SELECT 1", request.Params.Value.GetProperty("sql").GetString());
    }

    [Fact]
    public void ReassignColorProfileMessages_RoundTripExpectedContract()
    {
        var parameters = new ConnectionReassignColorProfileParams
        {
            FromProfileId = "custom",
            ToProfileId = "red"
        };
        var result = new ConnectionReassignColorProfileResult { UpdatedCount = 3 };

        var parametersJson = JsonSerializer.Serialize(
            parameters,
            ProtocolJsonContext.Default.ConnectionReassignColorProfileParams);
        var resultJson = JsonSerializer.Serialize(
            result,
            ProtocolJsonContext.Default.ConnectionReassignColorProfileResult);

        Assert.Equal("{\"fromProfileId\":\"custom\",\"toProfileId\":\"red\"}", parametersJson);
        Assert.Equal("{\"updatedCount\":3}", resultJson);
    }

    [Fact]
    public void QueryExecuteParams_RoundTripExpectedContract()
    {
        var parameters = new QueryExecuteParams
        {
            SessionId = "query-tab-1",
            ConnectionId = "connection-1",
            Database = "AdventureWorks2022",
            Sql = "SELECT 1"
        };

        var json = JsonSerializer.Serialize(
            parameters,
            ProtocolJsonContext.Default.QueryExecuteParams);
        var roundTripped = JsonSerializer.Deserialize(
            json,
            ProtocolJsonContext.Default.QueryExecuteParams);

        Assert.Equal(
            "{\"sessionId\":\"query-tab-1\",\"connectionId\":\"connection-1\",\"database\":\"AdventureWorks2022\",\"sql\":\"SELECT 1\"}",
            json);
        Assert.NotNull(roundTripped);
        Assert.Equal(parameters, roundTripped);
    }

    [Fact]
    public void QueryExecuteParams_WithoutSessionId_IsRejected()
    {
        var json = """{"connectionId":"connection-1","database":"master","sql":"SELECT 1"}""";

        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize(
            json,
            ProtocolJsonContext.Default.QueryExecuteParams));
    }

    [Fact]
    public void QuerySessionCloseMessages_RoundTripExpectedContract()
    {
        var parameters = new QuerySessionCloseParams
        {
            SessionId = "query-tab-1",
            ConnectionId = "connection-1"
        };
        var result = new QuerySessionCloseResult { Closed = true };

        var parametersJson = JsonSerializer.Serialize(
            parameters,
            ProtocolJsonContext.Default.QuerySessionCloseParams);
        var resultJson = JsonSerializer.Serialize(
            result,
            ProtocolJsonContext.Default.QuerySessionCloseResult);

        Assert.Equal("{\"sessionId\":\"query-tab-1\",\"connectionId\":\"connection-1\"}", parametersJson);
        Assert.Equal("{\"closed\":true}", resultJson);
    }
}
