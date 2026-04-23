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

        _activeQueries[queryId] = new QueryState(cts);
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

        if (_activeQueries.TryGetValue(queryId, out var entry))
        {
            entry.Cmd = cmd;

            // If Cancel() was called before the command was registered, we stored
            // the intent in Cancelled — apply it now so the query is interrupted
            // immediately rather than silently running to completion.
            if (entry.Cancelled)
            {
                try
                {
                    cmd.Cancel();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Warning: Failed to cancel late-registered SqlCommand for query '{queryId}': {ex.Message}");
                }
            }
        }
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

        // Don't remove the entry — SetCommand may still be racing to register the
        // command. Mark Cancelled so a late SetCommand cancels immediately. The
        // entry is cleaned up by Remove() when the query actually finishes.
        if (!_activeQueries.TryGetValue(queryId, out var entry))
            return false;

        entry.Cancelled = true;

        try
        {
            entry.Cts.Cancel();
        }
        catch (ObjectDisposedException ex)
        {
            Console.Error.WriteLine($"Warning: CancellationTokenSource for query '{queryId}' was already disposed: {ex.Message}");
        }

        try
        {
            entry.Cmd?.Cancel();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Warning: Failed to cancel SqlCommand for query '{queryId}': {ex.Message}");
        }

        return true;
    }

    /// <summary>
    /// Removes a query from tracking after it has completed (successfully or otherwise).
    /// Disposes the CancellationTokenSource.
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

    private sealed class QueryState
    {
        public CancellationTokenSource Cts { get; }
        public SqlCommand? Cmd { get; set; }

        /// <summary>
        /// Set to true when Cancel() was called. If the SqlCommand arrives
        /// after this, SetCommand will cancel it immediately.
        /// </summary>
        public bool Cancelled { get; set; }

        public QueryState(CancellationTokenSource cts)
        {
            Cts = cts;
        }
    }
}
