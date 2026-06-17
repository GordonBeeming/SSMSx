import type { languages, editor, Position, CancellationToken } from "monaco-editor";
import type { IntelliSenseMetadata } from "../../api/queryApi";

/** T-SQL keywords for autocomplete */
const TSQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "UPDATE", "DELETE",
  "SET", "VALUES", "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "CROSS",
  "ON", "AND", "OR", "NOT", "IN", "EXISTS", "BETWEEN", "LIKE",
  "IS", "NULL", "AS", "ORDER", "BY", "GROUP", "HAVING",
  "DISTINCT", "TOP", "WITH", "UNION", "ALL", "EXCEPT", "INTERSECT",
  "CREATE", "ALTER", "DROP", "TABLE", "VIEW", "INDEX", "PROCEDURE",
  "FUNCTION", "TRIGGER", "DATABASE", "SCHEMA",
  "BEGIN", "END", "IF", "ELSE", "WHILE", "RETURN", "DECLARE",
  "EXEC", "EXECUTE", "PRINT", "RAISERROR", "THROW",
  "TRY", "CATCH", "TRANSACTION", "COMMIT", "ROLLBACK", "SAVE",
  "GO", "USE", "GRANT", "REVOKE", "DENY",
  "ASC", "DESC", "CASE", "WHEN", "THEN", "CAST", "CONVERT",
  "COALESCE", "ISNULL", "NULLIF", "COUNT", "SUM", "AVG", "MIN", "MAX",
  "LEN", "SUBSTRING", "REPLACE", "TRIM", "LTRIM", "RTRIM",
  "GETDATE", "DATEADD", "DATEDIFF", "YEAR", "MONTH", "DAY",
  "IDENTITY", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT",
  "DEFAULT", "CHECK", "UNIQUE", "CLUSTERED", "NONCLUSTERED",
  "WAITFOR", "DELAY", "OPENQUERY", "OPENROWSET",
];

/** Common T-SQL snippets */
const TSQL_SNIPPETS: Array<{
  label: string;
  insertText: string;
  detail: string;
}> = [
  {
    label: "SELECT TOP",
    insertText: "SELECT TOP ${1:100} *\nFROM ${2:tableName}",
    detail: "SELECT TOP N * FROM table",
  },
  {
    label: "INSERT INTO",
    insertText: "INSERT INTO ${1:tableName} (${2:columns})\nVALUES (${3:values})",
    detail: "INSERT INTO table (cols) VALUES (vals)",
  },
  {
    label: "UPDATE SET",
    insertText: "UPDATE ${1:tableName}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition}",
    detail: "UPDATE table SET col = val WHERE ...",
  },
  {
    label: "DELETE FROM",
    insertText: "DELETE FROM ${1:tableName}\nWHERE ${2:condition}",
    detail: "DELETE FROM table WHERE ...",
  },
  {
    label: "BEGIN TRAN",
    insertText: "BEGIN TRANSACTION\n\t${1:-- statements}\nCOMMIT TRANSACTION",
    detail: "BEGIN TRANSACTION ... COMMIT",
  },
  {
    label: "IF EXISTS DROP",
    insertText:
      "IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'${1:objectName}'))\n\tDROP ${2:TABLE} ${1:objectName}",
    detail: "IF EXISTS ... DROP object",
  },
  {
    label: "TRY CATCH",
    insertText:
      "BEGIN TRY\n\t${1:-- statements}\nEND TRY\nBEGIN CATCH\n\tSELECT ERROR_MESSAGE() AS ErrorMessage\nEND CATCH",
    detail: "BEGIN TRY ... END CATCH",
  },
  {
    label: "CTE",
    insertText:
      ";WITH ${1:cteName} AS (\n\t${2:SELECT 1}\n)\nSELECT *\nFROM ${1:cteName}",
    detail: "Common Table Expression",
  },
];

/** Context keywords that suggest table completions follow */
const TABLE_CONTEXT_KEYWORDS = /\b(FROM|JOIN|INTO|UPDATE|TABLE|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|CROSS\s+JOIN|LEFT\s+OUTER\s+JOIN|RIGHT\s+OUTER\s+JOIN|FULL\s+OUTER\s+JOIN)\s+$/i;

/** Context keywords that suggest column completions follow */
const COLUMN_CONTEXT_KEYWORDS = /\b(SELECT|WHERE|ON|SET|BY|HAVING|AND|OR)\s+$/i;

/** Clause starters where a partially typed token should still suggest columns. */
const COLUMN_CONTEXT_CLAUSE_KEYWORDS =
  /\b(SELECT|WHERE|ON|SET|ORDER\s+BY|GROUP\s+BY|HAVING|AND|OR)\b/i;

/** Context keywords that suggest procedure completions follow */
const PROC_CONTEXT_KEYWORDS = /\b(EXEC|EXECUTE)\s+$/i;

export class SqlCompletionProvider
  implements languages.CompletionItemProvider
{
  triggerCharacters = [".", " "];

  private metadata: IntelliSenseMetadata | null = null;

  setMetadata(metadata: IntelliSenseMetadata | null): void {
    this.metadata = metadata;
  }

  provideCompletionItems(
    model: editor.ITextModel,
    position: Position,
    _context: languages.CompletionContext,
    _token: CancellationToken
  ): languages.ProviderResult<languages.CompletionList> {
    // Read line-level text for immediate context (what keyword preceded the cursor)
    const textUntilPosition = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    // Read the full statement (up to cursor) so we can scope columns to
    // tables actually referenced in this query's FROM/JOIN/UPDATE/INTO clauses.
    const fullTextUntilCursor = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endLineNumber: position.lineNumber,
      endColumn: word.endColumn,
    };

    const suggestions: languages.CompletionItem[] = [];

    // Check context for smart completions
    const textBefore = textUntilPosition.substring(
      0,
      textUntilPosition.length - word.word.length
    );

    const isTableContext = TABLE_CONTEXT_KEYWORDS.test(textBefore);
    const isColumnContext =
      COLUMN_CONTEXT_KEYWORDS.test(textBefore) ||
      isColumnClauseContext(textBefore, word.word);
    const isProcContext = PROC_CONTEXT_KEYWORDS.test(textBefore);

    // After a dot — could be schema.table or table.column
    if (textBefore.endsWith(".")) {
      const dotParts = textBefore.trimEnd().split(/\s+/).pop() ?? "";
      const prefix = dotParts.replace(/\.$/, "");

      if (this.metadata) {
        // Check if prefix is a schema name → suggest tables in that schema
        const schemaTables = this.metadata.tables.filter(
          (t) => t.schema.toLowerCase() === prefix.toLowerCase()
        );
        if (schemaTables.length > 0) {
          for (const t of schemaTables) {
            suggestions.push({
              label: t.name,
              kind: t.type === "view" ? 1 : 2, // Module=1 for views, Struct=2 for tables
              detail: `${t.schema}.${t.name} (${t.type})`,
              insertText: t.name,
              range,
            });
          }
        }

        // Check if prefix is a table name → suggest columns for that table
        // (already scoped to one table, but dedupe defensively in case the
        // same column name appears across its history/versioned copies)
        const tableColumns = this.metadata.columns.filter(
          (c) => c.tableName.toLowerCase() === prefix.toLowerCase()
        );
        for (const col of dedupeColumns(tableColumns)) {
          suggestions.push({
            label: col.name,
            kind: 4, // Field
            detail: `${col.dataType} — ${col.tableName}`,
            insertText: col.name,
            range,
          });
        }
      }

      return { suggestions };
    }

    // Table context: suggest tables and views (schema-qualified only — the
    // unqualified variant just doubled every entry in the popup without
    // adding real value).
    if (isTableContext && this.metadata) {
      for (const t of this.metadata.tables) {
        suggestions.push({
          label: `${t.schema}.${t.name}`,
          kind: t.type === "view" ? 1 : 2,
          detail: t.type,
          insertText: `[${t.schema}].[${t.name}]`,
          range,
        });
      }
    }

    // Column context: suggest columns ONLY from tables referenced in
    // this query's FROM/JOIN/UPDATE/INTO clauses. If the parser can't
    // find any referenced tables (e.g. cursor is before FROM), we fall
    // back to showing all columns deduped by name.
    if (isColumnContext && this.metadata) {
      const referencedTables = extractReferencedTables(fullTextUntilCursor);
      const scopedColumns =
        referencedTables.size > 0
          ? this.metadata.columns.filter((c) =>
              referencedTables.has(c.tableName.toLowerCase())
            )
          : this.metadata.columns;

      for (const col of dedupeColumns(scopedColumns)) {
        suggestions.push({
          label: col.name,
          kind: 4, // Field
          detail: col.detail,
          insertText: col.name,
          range,
          sortText: `0_${col.name}`,
        });
      }
    }

    // Procedure context
    if (isProcContext && this.metadata) {
      for (const p of this.metadata.procedures) {
        suggestions.push({
          label: `${p.schema}.${p.name}`,
          kind: 1, // Function
          detail: "stored procedure",
          insertText: `[${p.schema}].[${p.name}]`,
          range,
        });
      }
    }

    // Functions (always available)
    if (this.metadata) {
      for (const f of this.metadata.functions) {
        suggestions.push({
          label: `${f.schema}.${f.name}`,
          kind: 1, // Function
          detail: `${f.type} function`,
          insertText: `[${f.schema}].[${f.name}]()`,
          range,
          sortText: `3_${f.name}`,
        });
      }
    }

    // T-SQL keywords (always available, lower priority)
    for (const kw of TSQL_KEYWORDS) {
      suggestions.push({
        label: kw,
        kind: 13, // Keyword
        detail: "keyword",
        insertText: kw,
        range,
        sortText: `9_${kw}`,
      });
    }

    // Snippets (always available)
    for (const snippet of TSQL_SNIPPETS) {
      suggestions.push({
        label: snippet.label,
        kind: 24, // Snippet
        detail: snippet.detail,
        insertText: snippet.insertText,
        insertTextRules: 4, // InsertAsSnippet
        range,
        sortText: `8_${snippet.label}`,
      });
    }

    return { suggestions };
  }
}

/**
 * Parse SQL text and return the set of table names referenced in
 * FROM, JOIN, UPDATE, and INTO clauses. Table names are returned lowercased.
 *
 * Handles:
 *   - FROM [schema].[table]           → table
 *   - FROM schema.table               → table
 *   - FROM [table]                    → table
 *   - FROM table                      → table
 *   - FROM [db].[schema].[table]      → table
 *   - Multiple tables separated by commas
 *   - JOIN (all variants: INNER, LEFT, RIGHT, CROSS, FULL, OUTER)
 *
 * This is intentionally a regex, not a real parser — it's good enough for
 * scoping completion suggestions, not SQL validation.
 */
function extractReferencedTables(sql: string): Set<string> {
  const tables = new Set<string>();

  // Strip line comments and block comments so we don't match keywords inside them
  const clean = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");

  // Match: (FROM | JOIN | UPDATE | INTO) followed by one or more table refs.
  // A table ref can be [bracketed] or bare, optionally prefixed with
  // schema/database qualifiers. Capture everything until we hit whitespace,
  // a comma, an open paren, or another keyword.
  const keywordPattern =
    /\b(?:FROM|JOIN|UPDATE|INTO)\s+([\s\S]*?)(?=\b(?:WHERE|GROUP|ORDER|HAVING|ON|SET|VALUES|SELECT|UNION|EXCEPT|INTERSECT|WITH|OPTION|FOR|GO|;)\b|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = keywordPattern.exec(clean)) !== null) {
    const clause = match[1];
    // Within a FROM/JOIN clause, tables may be comma-separated. Split on commas
    // at the top level (ignoring brackets).
    for (const ref of splitTableRefs(clause)) {
      const tableName = extractTableName(ref);
      if (tableName) {
        tables.add(tableName.toLowerCase());
      }
    }
  }

  return tables;
}

/** Split a FROM/JOIN clause body on top-level commas. */
function splitTableRefs(clause: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of clause) {
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * Extract just the table name from a reference like:
 *   "[WideWorldImporters].[Application].[Cities] c"  → "Cities"
 *   "dbo.Orders AS o"                                → "Orders"
 *   "Customers"                                      → "Customers"
 * Returns null if the reference is a subquery or otherwise can't be parsed.
 */
function extractTableName(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed || trimmed.startsWith("(")) return null;

  // Take the first token (before any whitespace — skips aliases, AS keyword, etc.)
  const firstToken = trimmed.split(/\s+/)[0];

  // Split on dots to handle [db].[schema].[table] or schema.table
  // Strip brackets from each part.
  const parts = firstToken
    .split(".")
    .map((p) => p.replace(/^\[|\]$/g, ""))
    .filter((p) => p.length > 0);

  if (parts.length === 0) return null;
  return parts[parts.length - 1];
}

/**
 * Monaco removes the currently typed word from `textBefore`. That means
 * `WHERE F|` becomes `WHERE ` + word `F`, but more complex expressions can
 * leave text after the clause keyword. Treat those locations as column context
 * until the user has clearly moved into another table/procedure clause.
 */
function isColumnClauseContext(textBefore: string, currentWord: string): boolean {
  if (!currentWord) return false;

  const text = textBefore.trimEnd();
  if (!COLUMN_CONTEXT_CLAUSE_KEYWORDS.test(text)) return false;

  const lastColumnClause = findLastMatchIndex(text, COLUMN_CONTEXT_CLAUSE_KEYWORDS);
  const lastTableClause = findLastMatchIndex(
    text,
    /\b(FROM|JOIN|INTO|UPDATE|EXEC|EXECUTE)\b/i
  );

  return lastColumnClause > lastTableClause;
}

function findLastMatchIndex(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  let lastIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = globalPattern.exec(text)) !== null) {
    lastIndex = match.index;
  }
  return lastIndex;
}

interface DedupedColumn {
  name: string;
  detail: string;
  tableName: string;
  dataType: string;
}

/**
 * Collapse columns that share a name (e.g. `CityName` exists in `Cities`,
 * `Cities_Archive`, views, etc.) into a single completion entry. The detail
 * string surfaces the first table and, when relevant, how many others also
 * have the column so the popup isn't flooded with near-identical rows.
 */
function dedupeColumns(
  columns: Array<{ name: string; tableName: string; dataType: string }>
): DedupedColumn[] {
  const byName = new Map<string, { dataType: string; tables: string[] }>();
  for (const col of columns) {
    const existing = byName.get(col.name);
    if (existing) {
      if (!existing.tables.includes(col.tableName)) {
        existing.tables.push(col.tableName);
      }
    } else {
      byName.set(col.name, { dataType: col.dataType, tables: [col.tableName] });
    }
  }

  const result: DedupedColumn[] = [];
  for (const [name, info] of byName) {
    const first = info.tables[0];
    const extra = info.tables.length - 1;
    const detail =
      extra > 0
        ? `${info.dataType} — ${first} (+${extra} more)`
        : `${info.dataType} — ${first}`;
    result.push({ name, detail, tableName: first, dataType: info.dataType });
  }
  return result;
}
