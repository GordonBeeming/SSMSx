using Ssmsx.Core.Query;
using Xunit;

namespace Ssmsx.Core.Tests.Query;

public class QueryExecutorTests
{
    [Fact]
    public void SplitBatches_RecognizesStandaloneCaseInsensitiveSeparators()
    {
        const string sql = "SELECT '\nGO\n' AS Value\nGO\n/*\nGO\n*/\nSELECT 2\n go -- next batch\nSELECT 3\nGO 2";

        var batches = QueryExecutor.SplitBatches(sql)
            .Select(batch => batch.Trim().ReplaceLineEndings("\n"))
            .ToArray();

        Assert.Equal(["SELECT '\nGO\n' AS Value", "/*\nGO\n*/\nSELECT 2", "SELECT 3", "SELECT 3"], batches);
    }

    [Fact]
    public void SplitBatches_PreservesLineFeeds()
    {
        const string sql = "SELECT 'first\nsecond'\nGO\nSELECT 2";

        var batches = QueryExecutor.SplitBatches(sql).ToArray();

        Assert.Equal(["SELECT 'first\nsecond'", "SELECT 2"], batches);
    }

    [Fact]
    public void SplitBatches_RejectsRepeatCountsAboveIntMaxValue()
    {
        const string sql = "SELECT 1\nGO 2147483648";

        var exception = Assert.Throws<InvalidOperationException>(() => QueryExecutor.SplitBatches(sql).ToArray());

        Assert.Contains("exceeds the supported maximum", exception.Message);
    }
}
