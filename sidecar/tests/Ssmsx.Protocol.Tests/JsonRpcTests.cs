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
}
