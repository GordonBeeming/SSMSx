import assert from "node:assert/strict";
import test from "node:test";
import type { QueryTab } from "../../src/features/query/types.ts";
import {
  normalizeRestoredQueryTab,
  partitionQueryTabs,
} from "../../src/features/query/utils/queryTabs.ts";
import {
  MAX_RESULT_COLUMN_WIDTH,
  MIN_RESULT_COLUMN_WIDTH,
  clampResultColumnWidth,
  estimateResultColumnWidths,
} from "../../src/features/query/utils/resultColumnSizing.ts";

const tab = (id: string, pinned = false): QueryTab => ({
  id,
  connectionId: "connection",
  database: "master",
  title: id,
  pinned,
});

test("query tabs partition into stable pinned and unpinned bands", () => {
  const bands = partitionQueryTabs([
    tab("one"),
    tab("two", true),
    tab("three"),
    tab("four", true),
  ]);

  assert.deepEqual(bands.pinned.map((item) => item.id), ["two", "four"]);
  assert.deepEqual(bands.unpinned.map((item) => item.id), ["one", "three"]);
});

test("restored query tabs preserve only a valid boolean pinned state", () => {
  assert.equal(normalizeRestoredQueryTab(tab("pinned", true))?.pinned, true);
  assert.equal(normalizeRestoredQueryTab({ ...tab("legacy"), pinned: undefined })?.pinned, false);
  assert.equal(normalizeRestoredQueryTab({ ...tab("invalid"), pinned: "yes" })?.pinned, false);
  assert.equal(normalizeRestoredQueryTab({ title: "missing fields" }), null);
});

test("result column widths are capped for auto sizing and drag resizing", () => {
  const [autoWidth] = estimateResultColumnWidths(
    [{ name: "Payload" }],
    [["x".repeat(1000)]]
  );

  assert.equal(autoWidth, MAX_RESULT_COLUMN_WIDTH);
  assert.equal(clampResultColumnWidth(10), MIN_RESULT_COLUMN_WIDTH);
  assert.equal(clampResultColumnWidth(1000), MAX_RESULT_COLUMN_WIDTH);
});
