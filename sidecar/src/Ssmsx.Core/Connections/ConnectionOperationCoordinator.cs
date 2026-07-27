using System.Collections.Concurrent;

namespace Ssmsx.Core.Connections;

/// <summary>
/// Serializes lifecycle operations for the same saved connection while allowing
/// unrelated connections to proceed independently.
/// </summary>
public sealed class ConnectionOperationCoordinator
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks =
        new(StringComparer.Ordinal);

    public async Task<T> RunAsync<T>(
        string connectionId,
        Func<Task<T>> operation,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionId);
        ArgumentNullException.ThrowIfNull(operation);

        var connectionLock = _locks.GetOrAdd(connectionId, _ => new SemaphoreSlim(1, 1));
        await connectionLock.WaitAsync(cancellationToken);
        try
        {
            return await operation();
        }
        finally
        {
            connectionLock.Release();
        }
    }
}
