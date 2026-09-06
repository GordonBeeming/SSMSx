using System.Collections.Concurrent;
using Microsoft.Data.SqlClient;
using Ssmsx.Core.Connections;

namespace Ssmsx.Core.Query;

/// <summary>
/// Owns one persistent SQL connection per query window and prevents overlapping
/// commands from sharing that session.
/// </summary>
public sealed class QuerySessionManager : IAsyncDisposable
{
    private readonly ConcurrentDictionary<string, QuerySession> _sessions =
        new(StringComparer.Ordinal);
    private readonly Func<string, CancellationToken, Task<SqlConnection>> _openConnection;
    private int _disposed;

    public QuerySessionManager(ConnectionManager connectionManager)
    {
        ArgumentNullException.ThrowIfNull(connectionManager);
        _openConnection = connectionManager.CreateQueryConnectionAsync;
    }

    internal QuerySessionManager(Func<string, CancellationToken, Task<SqlConnection>> openConnection)
    {
        _openConnection = openConnection ?? throw new ArgumentNullException(nameof(openConnection));
    }

    internal async Task<QuerySessionLease> AcquireAsync(
        string sessionId,
        string connectionId,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId);
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionId);
        ObjectDisposedException.ThrowIf(Volatile.Read(ref _disposed) != 0, this);

        var session = await GetOrReplaceSessionAsync(sessionId, connectionId);
        if (Volatile.Read(ref _disposed) != 0)
        {
            await RemoveAndDisposeAsync(sessionId, session);
            throw new ObjectDisposedException(nameof(QuerySessionManager));
        }

        if (!session.TryBeginExecution())
            throw new InvalidOperationException($"Query session '{sessionId}' is already executing a query");

        var executionCancellation = CancellationTokenSource.CreateLinkedTokenSource(
            ct,
            session.LifetimeToken);
        try
        {
            var connection = await session.GetConnectionAsync(executionCancellation.Token);
            return new QuerySessionLease(
                this,
                sessionId,
                session,
                connection,
                executionCancellation);
        }
        catch
        {
            executionCancellation.Dispose();
            session.EndExecution();
            await RemoveAndDisposeAsync(sessionId, session);
            throw;
        }
    }

    /// <summary>
    /// Closes a session only when it still belongs to the expected connection.
    /// This prevents a delayed close for an old tab target from closing its replacement.
    /// </summary>
    public Task<bool> CloseSessionAsync(string sessionId, string connectionId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionId);
        return CloseSessionCoreAsync(sessionId, connectionId);
    }

    public async Task<int> CloseConnectionSessionsAsync(string connectionId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionId);

        var removed = new List<QuerySession>();
        foreach (var entry in _sessions)
        {
            if (string.Equals(entry.Value.ConnectionId, connectionId, StringComparison.Ordinal) &&
                _sessions.TryRemove(entry))
            {
                removed.Add(entry.Value);
            }
        }

        foreach (var session in removed)
            await session.DisposeAsync();

        return removed.Count;
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
            return;

        foreach (var entry in _sessions)
        {
            if (_sessions.TryRemove(entry))
                await entry.Value.DisposeAsync();
        }
    }

    private async Task<QuerySession> GetOrReplaceSessionAsync(
        string sessionId,
        string connectionId)
    {
        while (true)
        {
            var candidate = new QuerySession(connectionId, _openConnection);
            if (_sessions.TryAdd(sessionId, candidate))
                return candidate;

            if (!_sessions.TryGetValue(sessionId, out var existing))
            {
                await candidate.DisposeAsync();
                continue;
            }

            if (string.Equals(existing.ConnectionId, connectionId, StringComparison.Ordinal))
            {
                await candidate.DisposeAsync();
                return existing;
            }

            if (_sessions.TryUpdate(sessionId, candidate, existing))
            {
                await existing.DisposeAsync();
                return candidate;
            }

            await candidate.DisposeAsync();
        }
    }

    private async Task<bool> CloseSessionCoreAsync(
        string sessionId,
        string expectedConnectionId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId);

        while (_sessions.TryGetValue(sessionId, out var session))
        {
            if (!string.Equals(session.ConnectionId, expectedConnectionId, StringComparison.Ordinal))
            {
                return false;
            }

            if (_sessions.TryRemove(new KeyValuePair<string, QuerySession>(sessionId, session)))
            {
                await session.DisposeAsync();
                return true;
            }
        }

        return false;
    }

    private async ValueTask ReleaseAsync(
        string sessionId,
        QuerySession session,
        bool broken)
    {
        session.EndExecution();
        if (broken)
            await RemoveAndDisposeAsync(sessionId, session);
    }

    private async Task RemoveAndDisposeAsync(string sessionId, QuerySession session)
    {
        if (_sessions.TryRemove(new KeyValuePair<string, QuerySession>(sessionId, session)))
            await session.DisposeAsync();
    }

    internal sealed class QuerySessionLease : IAsyncDisposable
    {
        private readonly QuerySessionManager _manager;
        private readonly string _sessionId;
        private readonly QuerySession _session;
        private readonly CancellationTokenSource _executionCancellation;
        private int _disposed;
        private int _broken;

        internal QuerySessionLease(
            QuerySessionManager manager,
            string sessionId,
            QuerySession session,
            SqlConnection connection,
            CancellationTokenSource executionCancellation)
        {
            _manager = manager;
            _sessionId = sessionId;
            _session = session;
            Connection = connection;
            _executionCancellation = executionCancellation;
        }

        internal SqlConnection Connection { get; }

        internal CancellationToken CancellationToken => _executionCancellation.Token;

        internal void MarkBroken() => Interlocked.Exchange(ref _broken, 1);

        public async ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0)
                return;

            _executionCancellation.Dispose();
            await _manager.ReleaseAsync(
                _sessionId,
                _session,
                Volatile.Read(ref _broken) != 0);
        }
    }

    internal sealed class QuerySession : IAsyncDisposable
    {
        private readonly object _connectionGate = new();
        private readonly Func<string, CancellationToken, Task<SqlConnection>> _openConnection;
        private readonly CancellationTokenSource _lifetimeCancellation = new();
        private Task<SqlConnection>? _connectionTask;
        private int _executing;
        private int _disposed;

        internal QuerySession(
            string connectionId,
            Func<string, CancellationToken, Task<SqlConnection>> openConnection)
        {
            ConnectionId = connectionId;
            _openConnection = openConnection;
        }

        internal string ConnectionId { get; }

        internal CancellationToken LifetimeToken => _lifetimeCancellation.Token;

        internal bool TryBeginExecution() =>
            Interlocked.CompareExchange(ref _executing, 1, 0) == 0;

        internal void EndExecution() => Interlocked.Exchange(ref _executing, 0);

        internal Task<SqlConnection> GetConnectionAsync(CancellationToken ct)
        {
            lock (_connectionGate)
            {
                ObjectDisposedException.ThrowIf(
                    Volatile.Read(ref _disposed) != 0,
                    nameof(QuerySession));
                return _connectionTask ??= _openConnection(ConnectionId, ct);
            }
        }

        public async ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0)
                return;

            await _lifetimeCancellation.CancelAsync();

            Task<SqlConnection>? connectionTask;
            lock (_connectionGate)
                connectionTask = _connectionTask;

            if (connectionTask is not null)
            {
                try
                {
                    var connection = await connectionTask;
                    await connection.DisposeAsync();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(
                        $"Warning: Failed to close query session for connection '{ConnectionId}': {ex.Message}");
                }
            }

            _lifetimeCancellation.Dispose();
        }
    }
}
