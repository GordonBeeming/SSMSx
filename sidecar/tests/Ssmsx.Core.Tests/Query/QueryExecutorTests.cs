using Ssmsx.Core.Query;
using Xunit;

namespace Ssmsx.Core.Tests.Query;

public class QueryExecutorTests
{
    [Fact]
    public void SplitBatches_RecognizesStandaloneCaseInsensitiveSeparators()
    {
        const string sql = "SELECT 1\nGO\nSELECT 'GO'\n go -- next batch\nSELECT 3";

        var batches = QueryExecutor.SplitBatches(sql).Select(batch => batch.Trim()).ToArray();

        Assert.Equal(["SELECT 1", "SELECT 'GO'", "SELECT 3"], batches);
    }
}
