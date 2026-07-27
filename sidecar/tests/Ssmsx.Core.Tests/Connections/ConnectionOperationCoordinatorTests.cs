using Ssmsx.Core.Connections;
using Xunit;

namespace Ssmsx.Core.Tests.Connections;

public class ConnectionOperationCoordinatorTests
{
    [Fact]
    public async Task RunAsync_SerializesOperationsForSameConnection()
    {
        var coordinator = new ConnectionOperationCoordinator();
        var firstEntered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseFirst = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var secondEntered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        var first = coordinator.RunAsync("connection", async () =>
        {
            firstEntered.SetResult();
            await releaseFirst.Task;
            return 1;
        });
        await firstEntered.Task;

        var second = coordinator.RunAsync("connection", () =>
        {
            secondEntered.SetResult();
            return Task.FromResult(2);
        });

        Assert.False(secondEntered.Task.IsCompleted);
        Assert.False(second.IsCompleted);

        releaseFirst.SetResult();

        Assert.Equal(1, await first);
        Assert.Equal(2, await second);
        Assert.True(secondEntered.Task.IsCompletedSuccessfully);
    }

    [Fact]
    public async Task RunAsync_AllowsDifferentConnectionsToProceedIndependently()
    {
        var coordinator = new ConnectionOperationCoordinator();
        var firstEntered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseFirst = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        var first = coordinator.RunAsync("first", async () =>
        {
            firstEntered.SetResult();
            await releaseFirst.Task;
            return 1;
        });
        await firstEntered.Task;

        var second = await coordinator.RunAsync("second", () => Task.FromResult(2));

        Assert.Equal(2, second);
        releaseFirst.SetResult();
        Assert.Equal(1, await first);
    }
}
