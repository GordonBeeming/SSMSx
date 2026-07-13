using Ssmsx.Core.Query;
using Xunit;

namespace Ssmsx.Core.Tests.Query;

public class QueryExecutorTests
{
    [Fact]
    public void SplitBatches_RecognizesStandaloneCaseInsensitiveSeparators()
    {
        const string sql = "SELECT '\nGO\n' AS Value\nGO\n/*\nGO\n*/\nSELECT 2\n go -- next batch\nSELECT 3\nGO 2";

        var batches = QueryExecutor.SplitBatches(sql).Select(batch => batch.Trim()).ToArray();

        Assert.Equal(["SELECT '\nGO\n' AS Value", "/*\nGO\n*/\nSELECT 2", "SELECT 3", "SELECT 3"], batches);
    }
}
