using System.Text.Json;
using Ssmsx.Protocol;
using Ssmsx.Protocol.Models;

namespace Ssmsx.Core.Storage;

public class ConnectionStore
{
    private readonly string _filePath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public ConnectionStore(string? basePath = null)
    {
        var dir = basePath ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".ssmsx");
        Directory.CreateDirectory(dir);
        _filePath = Path.Combine(dir, "connections.json");
    }

    public async Task<List<ConnectionInfo>> ListAsync()
    {
        await _lock.WaitAsync();
        try
        {
            var connections = await ReadFileAsync();
            return Deduplicate(connections).OrderByDescending(ActivityDate).ToList();
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<ConnectionInfo?> GetAsync(string id)
    {
        await _lock.WaitAsync();
        try
        {
            var connections = await ReadFileAsync();
            return Deduplicate(connections).FirstOrDefault(c => c.Id == id);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<ConnectionInfo> SaveAsync(ConnectionInfo connection)
    {
        await _lock.WaitAsync();
        try
        {
            var connections = Deduplicate(await ReadFileAsync());
            var index = connections.FindIndex(c => c.Id == connection.Id);
            if (index >= 0)
            {
                connections[index] = connection;
                await WriteFileAsync(connections);
                return connection;
            }
            else
            {
                var equivalentIndex = connections.FindIndex(c => AreEquivalent(c, connection));
                if (equivalentIndex >= 0)
                {
                    var merged = Merge(connections[equivalentIndex], connection);
                    connections[equivalentIndex] = merged;
                    await WriteFileAsync(connections);
                    return merged;
                }

                connections.Add(connection);
            }

            await WriteFileAsync(connections);
            return connection;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<bool> DeleteAsync(string id)
    {
        await _lock.WaitAsync();
        try
        {
            var connections = await ReadFileAsync();
            var removed = connections.RemoveAll(c => c.Id == id);
            if (removed > 0)
                await WriteFileAsync(Deduplicate(connections));
            return removed > 0;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<List<ConnectionInfo>> ReadFileAsync()
    {
        if (!File.Exists(_filePath))
            return new List<ConnectionInfo>();

        var json = await File.ReadAllTextAsync(_filePath);
        if (string.IsNullOrWhiteSpace(json))
            return new List<ConnectionInfo>();

        var connections = JsonSerializer.Deserialize(json, ProtocolJsonContext.Default.ListConnectionInfo);
        if (connections is null)
        {
            await Console.Error.WriteLineAsync($"Warning: Failed to deserialize connections from {_filePath}, returning empty list");
            return new List<ConnectionInfo>();
        }
        return connections;
    }

    private async Task WriteFileAsync(List<ConnectionInfo> connections)
    {
        var json = JsonSerializer.Serialize(connections, ProtocolJsonContext.Default.ListConnectionInfo);
        var tempPath = _filePath + ".tmp";
        await File.WriteAllTextAsync(tempPath, json);
        File.Move(tempPath, _filePath, overwrite: true);
    }

    private static List<ConnectionInfo> Deduplicate(List<ConnectionInfo> connections)
    {
        var deduped = new Dictionary<string, ConnectionInfo>(StringComparer.OrdinalIgnoreCase);
        foreach (var connection in connections)
        {
            var fingerprint = Fingerprint(connection);
            if (deduped.TryGetValue(fingerprint, out var existing))
                deduped[fingerprint] = Merge(existing, connection);
            else
                deduped[fingerprint] = connection;
        }

        return deduped.Values.ToList();
    }

    private static bool AreEquivalent(ConnectionInfo left, ConnectionInfo right)
    {
        return string.Equals(Fingerprint(left), Fingerprint(right), StringComparison.OrdinalIgnoreCase);
    }

    private static ConnectionInfo Merge(ConnectionInfo existing, ConnectionInfo incoming)
    {
        var keepIncoming = ActivityDate(incoming) >= ActivityDate(existing);
        var primary = keepIncoming ? incoming : existing;
        var secondary = keepIncoming ? existing : incoming;

        return primary with
        {
            Id = existing.Id,
            CreatedAt = existing.CreatedAt <= incoming.CreatedAt ? existing.CreatedAt : incoming.CreatedAt,
            LastUsed = Latest(existing.LastUsed, incoming.LastUsed),
            CredentialRef = FirstNonEmpty(primary.CredentialRef, secondary.CredentialRef),
            Name = FirstNonEmpty(primary.Name, secondary.Name) ?? string.Empty,
            Color = FirstNonEmpty(primary.Color, secondary.Color)
        };
    }

    private static string Fingerprint(ConnectionInfo connection)
    {
        var auth = connection.AuthType.ToString().ToLowerInvariant();
        var server = NormalizeValue(connection.ServerName);
        var database = NormalizeValue(connection.Database);
        var username = NormalizeValue(connection.Username);
        var encrypt = connection.Encrypt.ToString().ToLowerInvariant();
        var trust = connection.TrustServerCertificate ? "trust" : "verify";
        var connectionString = NormalizeConnectionString(connection.ConnectionString);
        return string.Join("|", auth, server, database, username, encrypt, trust, connectionString);
    }

    private static string NormalizeConnectionString(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return string.Empty;

        var parts = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var segment in connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var equalsIndex = segment.IndexOf('=');
            if (equalsIndex <= 0)
                continue;

            var key = NormalizeConnectionStringKey(segment[..equalsIndex]);
            if (key is "password" or "pwd")
                continue;

            parts[key] = NormalizeValue(segment[(equalsIndex + 1)..]);
        }

        return string.Join(";", parts.Select(part => $"{part.Key}={part.Value}"));
    }

    private static string NormalizeConnectionStringKey(string key)
    {
        var normalized = NormalizeValue(key).Replace(" ", string.Empty, StringComparison.Ordinal);
        return normalized switch
        {
            "addr" or "address" or "networkaddress" or "datasource" => "server",
            "initialcatalog" => "database",
            "userid" or "uid" => "user",
            "trustservercertificate" => "trustservercertificate",
            _ => normalized
        };
    }

    private static string NormalizeValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim().ToLowerInvariant();
    }

    private static DateTime ActivityDate(ConnectionInfo connection)
    {
        return connection.LastUsed ?? connection.CreatedAt;
    }

    private static DateTime? Latest(DateTime? left, DateTime? right)
    {
        if (left is null)
            return right;
        if (right is null)
            return left;
        return left > right ? left : right;
    }

    private static string? FirstNonEmpty(string? primary, string? secondary)
    {
        if (!string.IsNullOrWhiteSpace(primary))
            return primary;
        return string.IsNullOrWhiteSpace(secondary) ? null : secondary;
    }
}
