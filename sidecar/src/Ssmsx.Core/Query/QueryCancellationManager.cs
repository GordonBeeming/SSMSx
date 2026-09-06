using System.Collections.Concurrent;
using Microsoft.Data.SqlClient;

namespace Ssmsx.Core.Query;

/// <summary>
/// Manages cancellation tokens and SQL commands for active queries,
/// enabling cooperative cancellation of in-flight query executions.
/// </summary>
public class QueryCancellationManager
{
    private readonly ConcurrentDictionary<string, QueryState> _activeQueries = new();

    /// <summary>
    /// Registers a new query with its cancellation token source.
    /// </summary>
    /// <param name="queryId">The unique identifier for the query.</param>
    /// <param name="cts">The cancellation token source to associate with this query.</param>
    /// <exception cref="ArgumentException">Thrown when queryId is null or empty.</exception>
    public void Register(string queryId, CancellationTokenSource cts)
    {
        if (string.IsNullOrWhiteSpace(queryId))
            throw new ArgumentException("Query ID cannot be null or empty.", nameof(queryId));
        ArgumentNullException.ThrowIfNull(cts);

        if (!_activeQueries.TryAdd(queryId, new QueryState(cts)))
            throw new InvalidOperationException($"Query '{queryId}' is already registered");
    }

    /// <summary>
    /// Associates a SqlCommand with an already-registered query,
    /// enabling SqlCommand.Cancel() for immediate server-side cancellation.
    /// If a cancel was requested before this command was registered, cancels
    /// the command immediately so the caller's blocking read is interrupted.
    /// </summary>
    /// <param name="queryId">The unique identifier for the query.</param>
    /// <param name="cmd">The SqlCommand to associate.</param>
    public void SetCommand(string queryId, SqlCommand cmd)
    {
        if (string.IsNullOrWhiteSpace(queryId))
            throw new ArgumentException("Query ID cannot be null or empty.", nameof(queryId));
        ArgumentNullException.ThrowIfNull(cmd);

        if (_activeQueries.TryGetValue(queryId, out var entry) && entry.SetCommand(cmd))
            CancelCommand(queryId, cmd, "late-registered");
    }

    /// <summary>
    /// Cancels an active query by triggering the CancellationTokenSource
    /// and calling SqlCommand.Cancel() if a command is associated.
    /// If the command hasn't been registered yet, marks the entry so
    /// SetCommand will cancel the command as soon as it arrives.
    /// Returns true if the query was found and cancellation was initiated.
    /// </summary>
    /// <param name="queryId">The unique identifier for the query to cancel.</param>
    /// <returns>True if cancellation was initiated; false if the query was not found.</returns>
    public bool Cancel(string queryId)
    {
        if (string.IsNullOrWhiteSpace(queryId))
            return false;

        // Don't remove the entry: SetCommand may still be racing to register the
        // command. The entry is cleaned up when the query finishes.
        if (!_activeQueries.TryGetValue(queryId, out var entry))
            return false;

        var command = entry.MarkCancelled();

        try
        {
            entry.Cts.Cancel();
        }
        catch (ObjectDisposedException ex)
        {
            Console.Error.WriteLine($"Warning: CancellationTokenSource for query '{queryId}' was already disposed: {ex.Message}");
        }

        if (command is not null)
            CancelCommand(queryId, command, "active");

        return true;
    }

    /// <summary>
    /// Removes a query from tracking after it has completed and disposes its
    /// cancellation token source.
    /// </summary>
    /// <param name="queryId">The unique identifier for the query to remove.</param>
    public void Remove(string queryId)
    {
        if (string.IsNullOrWhiteSpace(queryId))
            return;

        if (_activeQueries.TryRemove(queryId, out var entry))
        {
            try
            {
                entry.Cts.Dispose();
            }
            catch (ObjectDisposedException ex)
            {
                Console.Error.WriteLine($"Warning: CancellationTokenSource for query '{queryId}' was already disposed during cleanup: {ex.Message}");
            }
        }
    }

    private static void CancelCommand(string queryId, SqlCommand command, string context)
    {
        try
        {
            command.Cancel();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(
                $"Warning: Failed to cancel {context} SqlCommand for query '{queryId}': {ex.Message}");
        }
    }

    private sealed class QueryState
    {
        private readonly object _gate = new();
        private SqlCommand? _command;
        private bool _cancelled;

        public QueryState(CancellationTokenSource cts)
        {
            Cts = cts;
        }

        public CancellationTokenSource Cts { get; }

        public bool SetCommand(SqlCommand command)
        {
            lock (_gate)
            {
                _command = command;
                return _cancelled;
            }
        }

        public SqlCommand? MarkCancelled()
        {
            lock (_gate)
            {
                _cancelled = true;
                return _command;
            }
        }
    }
}
