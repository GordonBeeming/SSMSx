using System.Text.Json;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Runtime.Versioning;
using Ssmsx.Protocol;
using Ssmsx.Protocol.Models;

namespace Ssmsx.Core.Storage;

public class ConnectionStore
{
    private const string DefaultColorProfileId = "red";
    private const int FileLockRetryDelayMilliseconds = 50;
    private const int FileLockRetryCount = 300;

    private const UnixFileMode OwnerDirectoryMode =
        UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute;

    private const UnixFileMode OwnerFileMode =
        UnixFileMode.UserRead | UnixFileMode.UserWrite;

    private static readonly IReadOnlyDictionary<string, string> LegacyColorProfileIds =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["#ef4444"] = "red",
            ["#FF0000"] = "red",
            ["#991B1B"] = "red",
            ["#dc2626"] = "red",
            ["#3b82f6"] = "blue",
            ["#1D4ED8"] = "blue",
            ["#0063B2"] = "blue",
            ["#22c55e"] = "green",
            ["#166534"] = "green",
            ["#16a34a"] = "green",
            ["#eab308"] = "amber",
            ["#f97316"] = "amber",
            ["#92400E"] = "amber",
            ["#d97706"] = "amber",
            ["#a855f7"] = "violet",
            ["#6D28D9"] = "violet",
            ["#7c3aed"] = "violet",
            ["#334155"] = "slate",
            ["#555555"] = "slate"
        };

    private readonly string _filePath;
    private readonly string _lockFilePath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public ConnectionStore(string? basePath = null)
    {
        var dir = basePath ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".ssmsx");
        Directory.CreateDirectory(dir);
        EnsureOwnerOnlyDirectory(dir);
        _filePath = Path.Combine(dir, "connections.json");
        _lockFilePath = Path.Combine(dir, "connections.lock");
    }

    public async Task<List<ConnectionInfo>> ListAsync()
    {
        await _lock.WaitAsync();
        try
        {
            await using var fileLock = await AcquireFileLockAsync();
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
            await using var fileLock = await AcquireFileLockAsync();
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
            await using var fileLock = await AcquireFileLockAsync();
            var connections = Deduplicate(await ReadFileAsync());
            var index = connections.FindIndex(c => c.Id == connection.Id);
            if (index >= 0)
            {
                connection = MergeSameId(connections[index], connection);
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

                connection = Normalize(connection).Connection;
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
            await using var fileLock = await AcquireFileLockAsync();
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

    public async Task<int> ReassignColorProfileAsync(string fromProfileId, string toProfileId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fromProfileId);
        ArgumentException.ThrowIfNullOrWhiteSpace(toProfileId);

        await _lock.WaitAsync();
        try
        {
            await using var fileLock = await AcquireFileLockAsync();
            var connections = Deduplicate(await ReadFileAsync());
            var updatedCount = 0;

            for (var index = 0; index < connections.Count; index++)
            {
                var connection = connections[index];
                if (!string.Equals(connection.ColorProfileId, fromProfileId, StringComparison.Ordinal))
                    continue;

                connections[index] = connection with
                {
                    ColorProfileId = toProfileId,
                    Color = null
                };
                updatedCount++;
            }

            if (updatedCount > 0)
                await WriteFileAsync(connections);

            return updatedCount;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<bool> UpdateLastUsedAsync(string id, DateTime lastUsed)
    {
        await _lock.WaitAsync();
        try
        {
            await using var fileLock = await AcquireFileLockAsync();
            var connections = Deduplicate(await ReadFileAsync());
            var index = connections.FindIndex(connection => connection.Id == id);
            if (index < 0)
                return false;

            var existing = connections[index];
            connections[index] = existing with { LastUsed = Latest(existing.LastUsed, lastUsed) };
            await WriteFileAsync(connections);
            return true;
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

        using var document = JsonDocument.Parse(json);
        var hasLegacyColorProperty = document.RootElement.ValueKind == JsonValueKind.Array
            && document.RootElement.EnumerateArray().Any(element => element.TryGetProperty("color", out _));

        var normalized = new List<ConnectionInfo>(connections.Count);
        var normalizationChanged = hasLegacyColorProperty;
        foreach (var connection in connections)
        {
            var result = Normalize(connection);
            normalized.Add(result.Connection);
            normalizationChanged |= result.Changed;
        }

        if (normalizationChanged)
        {
            try
            {
                await WriteFileAsync(normalized);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException)
            {
                await Console.Error.WriteLineAsync(
                    $"Warning: Failed to rewrite normalized connections at {_filePath}; continuing with normalized in-memory data: {ex.Message}");
            }
        }

        return normalized;
    }

    private async Task WriteFileAsync(List<ConnectionInfo> connections)
    {
        var json = JsonSerializer.Serialize(connections, ProtocolJsonContext.Default.ListConnectionInfo);
        var tempPath = $"{_filePath}.{Guid.NewGuid():N}.tmp";
        try
        {
            await File.WriteAllTextAsync(tempPath, json);
            EnsureOwnerOnlyFile(tempPath);
            File.Move(tempPath, _filePath, overwrite: true);
            EnsureOwnerOnlyFile(_filePath);
        }
        finally
        {
            if (File.Exists(tempPath))
                File.Delete(tempPath);
        }
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
            Name = FirstNonEmpty(primary.Name, secondary.Name),
            ColorProfileId = FirstNonEmpty(ColorProfileCandidate(primary), ColorProfileCandidate(secondary))
                ?? DefaultColorProfileId,
            Color = null
        };
    }

    private static ConnectionInfo MergeSameId(ConnectionInfo existing, ConnectionInfo incoming)
    {
        var normalizedExisting = Normalize(existing).Connection;
        var normalizedIncoming = Normalize(incoming).Connection;
        var hasIncomingColorAppearance =
            incoming.HasExplicitColorProfileId || incoming.Color is not null;

        return normalizedIncoming with
        {
            Id = existing.Id,
            Name = incoming.Name ?? normalizedExisting.Name,
            ColorProfileId = hasIncomingColorAppearance
                ? normalizedIncoming.ColorProfileId
                : normalizedExisting.ColorProfileId,
            Color = null,
            CreatedAt = existing.CreatedAt <= normalizedIncoming.CreatedAt
                ? existing.CreatedAt
                : normalizedIncoming.CreatedAt,
            LastUsed = Latest(existing.LastUsed, normalizedIncoming.LastUsed)
        };
    }

    private async Task<FileStream> AcquireFileLockAsync()
    {
        IOException? lastError = null;
        for (var attempt = 0; attempt < FileLockRetryCount; attempt++)
        {
            try
            {
                var stream = new FileStream(
                    _lockFilePath,
                    FileMode.OpenOrCreate,
                    FileAccess.ReadWrite,
                    FileShare.None,
                    bufferSize: 1,
                    FileOptions.Asynchronous);
                EnsureOwnerOnlyFile(_lockFilePath);
                return stream;
            }
            catch (IOException ex)
            {
                lastError = ex;
                await Task.Delay(FileLockRetryDelayMilliseconds);
            }
        }

        throw new TimeoutException(
            $"Timed out waiting for exclusive access to {_filePath}",
            lastError);
    }

    private static void EnsureOwnerOnlyDirectory(string path)
    {
        if (OperatingSystem.IsWindows())
        {
            var owner = CurrentWindowsUser();
            var security = new DirectorySecurity();
            security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
            security.SetOwner(owner);
            AddWindowsDirectoryAccessRule(security, owner);
            AddWindowsDirectoryAccessRule(
                security,
                new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null));
            AddWindowsDirectoryAccessRule(
                security,
                new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null));
            new DirectoryInfo(path).SetAccessControl(security);
            return;
        }

        File.SetUnixFileMode(path, OwnerDirectoryMode);
    }

    private static void EnsureOwnerOnlyFile(string path)
    {
        if (OperatingSystem.IsWindows())
        {
            var owner = CurrentWindowsUser();
            var security = new FileSecurity();
            security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
            security.SetOwner(owner);
            AddWindowsFileAccessRule(security, owner);
            AddWindowsFileAccessRule(
                security,
                new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null));
            AddWindowsFileAccessRule(
                security,
                new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null));
            new FileInfo(path).SetAccessControl(security);
            return;
        }

        File.SetUnixFileMode(path, OwnerFileMode);
    }

    [SupportedOSPlatform("windows")]
    private static SecurityIdentifier CurrentWindowsUser()
    {
        return WindowsIdentity.GetCurrent().User
            ?? throw new InvalidOperationException("Could not resolve the current Windows user SID");
    }

    [SupportedOSPlatform("windows")]
    private static void AddWindowsDirectoryAccessRule(
        DirectorySecurity security,
        SecurityIdentifier identity)
    {
        security.AddAccessRule(new FileSystemAccessRule(
            identity,
            FileSystemRights.FullControl,
            InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
            PropagationFlags.None,
            AccessControlType.Allow));
    }

    [SupportedOSPlatform("windows")]
    private static void AddWindowsFileAccessRule(
        FileSecurity security,
        SecurityIdentifier identity)
    {
        security.AddAccessRule(new FileSystemAccessRule(
            identity,
            FileSystemRights.FullControl,
            AccessControlType.Allow));
    }

    private static (ConnectionInfo Connection, bool Changed) Normalize(ConnectionInfo connection)
    {
        var colorProfileId = connection.HasExplicitColorProfileId
            ? connection.ColorProfileId
            : TryMapLegacyColor(connection.Color) ?? DefaultColorProfileId;
        var changed = !connection.HasExplicitColorProfileId || connection.Color is not null;

        return (connection with { ColorProfileId = colorProfileId, Color = null }, changed);
    }

    private static string? ColorProfileCandidate(ConnectionInfo connection)
    {
        return connection.HasExplicitColorProfileId
            ? connection.ColorProfileId
            : TryMapLegacyColor(connection.Color);
    }

    private static string? TryMapLegacyColor(string? color)
    {
        if (!string.IsNullOrWhiteSpace(color)
            && LegacyColorProfileIds.TryGetValue(color.Trim(), out var colorProfileId))
        {
            return colorProfileId;
        }

        return null;
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
