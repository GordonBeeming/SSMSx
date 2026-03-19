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
    const textUntilPosition = model.getValueInRange({
      startLineNumber: position.lineNumber,
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
    const isColumnContext = COLUMN_CONTEXT_KEYWORDS.test(textBefore);
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
        const tableColumns = this.metadata.columns.filter(
          (c) => c.tableName.toLowerCase() === prefix.toLowerCase()
        );
        for (const col of tableColumns) {
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

    // Table context: suggest tables and views
    if (isTableContext && this.metadata) {
      for (const t of this.metadata.tables) {
        suggestions.push({
          label: `${t.schema}.${t.name}`,
          kind: t.type === "view" ? 1 : 2,
          detail: t.type,
          insertText: `[${t.schema}].[${t.name}]`,
          range,
        });
        // Also suggest without schema for convenience
        suggestions.push({
          label: t.name,
          kind: t.type === "view" ? 1 : 2,
          detail: `${t.schema} · ${t.type}`,
          insertText: t.name,
          range,
          sortText: `1_${t.name}`,
        });
      }
    }

    // Column context: suggest all columns
    if (isColumnContext && this.metadata) {
      for (const col of this.metadata.columns) {
        suggestions.push({
          label: col.name,
          kind: 4, // Field
          detail: `${col.dataType} — ${col.tableName}`,
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
