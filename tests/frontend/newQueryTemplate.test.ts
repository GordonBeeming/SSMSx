import test from "node:test";
import assert from "node:assert/strict";
import {
  hasAtMostOneCursorMarker,
  parseNewQueryTemplate,
} from "../../src/features/query/utils/newQueryTemplate.ts";

test("preserves whitespace around a cursor marker", () => {
  const template = "  SELECT 1  \n{{cursor}}\n  ";

  assert.deepEqual(parseNewQueryTemplate(template), {
    sql: "  SELECT 1  \n\n  ",
    cursorOffset: 13,
  });
});

test("places the default template cursor on line 31", () => {
  const template = "\n".repeat(30) + "{{cursor}}";

  assert.deepEqual(parseNewQueryTemplate(template), {
    sql: "\n".repeat(30),
    cursorOffset: 30,
  });
});

test("uses a marker in the middle of a template", () => {
  assert.deepEqual(parseNewQueryTemplate("SELECT {{cursor}}FROM dbo.Users"), {
    sql: "SELECT FROM dbo.Users",
    cursorOffset: 7,
  });
});

test("uses the exact end when no marker is present, including an empty template", () => {
  assert.deepEqual(parseNewQueryTemplate("SELECT 1\n"), {
    sql: "SELECT 1\n",
    cursorOffset: 9,
  });
  assert.deepEqual(parseNewQueryTemplate(""), { sql: "", cursorOffset: 0 });
});

test("rejects templates with more than one cursor marker", () => {
  assert.equal(hasAtMostOneCursorMarker("{{cursor}} SELECT {{cursor}}"), false);
  assert.equal(hasAtMostOneCursorMarker("SELECT {{cursor}}"), true);
});
