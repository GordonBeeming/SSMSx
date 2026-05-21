import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import readline from "node:readline";

const server = process.env.SSMSX_SMOKE_SERVER ?? "127.0.0.1,4242";
const user = process.env.SSMSX_SMOKE_USER ?? "sa";
const password = process.env.SSMSX_SMOKE_PASSWORD ?? "Password!@2";
const database = process.env.SSMSX_SMOKE_DATABASE ?? "AdventureWorks2022";
const port = Number(process.env.SSMSX_TAURI_MCP_PORT ?? "9223");
const artifactDir = process.env.SSMSX_SMOKE_ARTIFACT_DIR;
const connectionString = [
  `Server=${server}`,
  `Database=${database}`,
  `User Id=${user}`,
  `Password=${password}`,
  "Encrypt=Optional",
  "TrustServerCertificate=True",
].join(";");

const child = spawn("npx", ["-y", "@hypothesi/tauri-mcp-server"], {
  stdio: ["pipe", "pipe", "pipe"],
});

const pending = new Map();
const stderr = [];
let seq = 0;

child.stderr.on("data", (chunk) => stderr.push(chunk.toString().trim()));

readline.createInterface({ input: child.stdout }).on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  const entry = pending.get(message.id);
  if (!entry) return;

  pending.delete(message.id);
  if (message.error) {
    entry.reject(new Error(message.error.message));
  } else {
    entry.resolve(message.result);
  }
});

function request(method, params = {}) {
  const id = ++seq;
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return promise;
}

async function tool(name, args = {}) {
  const result = await request("tools/call", { name, arguments: args });
  const text = result.content?.find((item) => item.type === "text")?.text ?? "";
  if (result.isError) {
    throw new Error(text || `${name} failed`);
  }
  return text;
}

async function screenshot(name) {
  if (!artifactDir) return null;
  const filePath = join(artifactDir, `${name}.png`);
  await tool("webview_screenshot", { format: "png", filePath });
  return filePath;
}

function parseExecutedText(text) {
  const value = text.replace(/\n\n\[Executed in window:[\s\S]*$/, "");
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function js(script) {
  return parseExecutedText(await tool("webview_execute_js", { script }));
}

async function waitFor(label, predicate, timeoutMs = 30000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await predicate();
    if (last?.ok) return last.value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(last)}`);
}

async function bodyText() {
  return js("(() => ({ text: document.body.innerText }))()");
}

async function clickVisibleButton(text, selector = "button") {
  const result = await js(`(() => {
    const buttons = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((button) => button.offsetParent !== null && !button.disabled);
    const button = buttons.find((item) => {
      const label = item.textContent.trim();
      const normalized = label.replace(/[▶|■]/g, "").trim();
      return label === ${JSON.stringify(text)} || normalized === ${JSON.stringify(text)};
    });
    if (!button) return { ok: false, buttons: buttons.map((item) => item.textContent.trim()) };
    button.click();
    return { ok: true };
  })()`);
  if (!result.ok) {
    throw new Error(`Could not click button '${text}': ${JSON.stringify(result.buttons)}`);
  }
}

async function setConnectionString() {
  const result = await js(`(() => {
    const textarea = document.querySelector("dialog[open] textarea");
    if (!textarea) return { ok: false };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, ${JSON.stringify(connectionString)});
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return { ok: true, value: textarea.value };
  })()`);
  if (!result.ok || result.value !== connectionString) {
    throw new Error("Failed to populate connection string textarea");
  }
}

async function setEditorValue(sql, lineNumber = 1) {
  const result = await js(`(() => {
    const editors = window.monaco?.editor?.getEditors?.() ?? [];
    const editor = editors[0];
    if (!editor) return { ok: false, editorCount: editors.length };
    editor.setValue(${JSON.stringify(sql)});
    editor.setPosition({ lineNumber: ${lineNumber}, column: 1 });
    editor.focus();
    return { ok: true, value: editor.getValue(), editorCount: editors.length };
  })()`);
  if (!result.ok || result.value !== sql) {
    throw new Error(`Failed to set Monaco editor value: ${JSON.stringify(result)}`);
  }
}

async function getEditorValues() {
  return js(`(() => ({
    values: (window.monaco?.editor?.getEditors?.() ?? []).map((editor) => editor.getValue())
  }))()`);
}

async function waitForVisibleEditorText(label, fragment, timeoutMs = 15000) {
  await waitFor(label, async () => {
    const result = await js(`(() => {
      const text = [...document.querySelectorAll(".monaco-editor .view-lines")]
        .map((element) => element.textContent)
        .join("\\n")
        .replace(/\\u00a0/g, " ");
      return { ok: text.includes(${JSON.stringify(fragment)}), value: text.slice(0, 500) };
    })()`);
    return result;
  }, timeoutMs);
}

async function setDiagramLayout(layoutMode) {
  const result = await js(`(() => {
    const select = document.querySelector("select[title='Auto layout']");
    if (!select) return { ok: false };
    select.value = ${JSON.stringify(layoutMode)};
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, value: select.value };
  })()`);
  if (!result.ok || result.value !== layoutMode) {
    throw new Error(`Failed to set diagram layout: ${JSON.stringify(result)}`);
  }
}

async function setDiagramName(name) {
  const result = await js(`(() => {
    const input = document.querySelector("input[aria-label='Diagram name']");
    if (!input) return { ok: false };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(name)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return { ok: true, value: input.value };
  })()`);
  if (!result.ok || result.value !== name) {
    throw new Error(`Failed to set diagram name: ${JSON.stringify(result)}`);
  }
}

async function setDiagramFilter(filter) {
  const result = await js(`(() => {
    const input = [...document.querySelectorAll("input")]
      .find((item) => item.placeholder === "Filter tables...");
    if (!input) return { ok: false };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(filter)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return { ok: true, value: input.value };
  })()`);
  if (!result.ok || result.value !== filter) {
    throw new Error(`Failed to set diagram filter: ${JSON.stringify(result)}`);
  }
}

async function selectDiagramTables(tableKeys) {
  await clickVisibleButton("Clear");
  await waitFor("clear diagram table selection", async () => {
    const text = await bodyText();
    return { ok: text.text.includes("0 selected"), value: text.text };
  }, 10000);
  const result = await js(`(() => {
    const wanted = new Set(${JSON.stringify(tableKeys)});
    const selected = [];
    for (const label of document.querySelectorAll("label[title]")) {
      const key = label.getAttribute("title");
      const checkbox = label.querySelector("input[type='checkbox']");
      if (wanted.has(key) && checkbox && !checkbox.checked) {
        checkbox.click();
      }
    }
    for (const label of document.querySelectorAll("label[title]")) {
      const key = label.getAttribute("title");
      const checkbox = label.querySelector("input[type='checkbox']");
      if (wanted.has(key) && checkbox?.checked) {
        selected.push(key);
      }
    }
    return { ok: selected.length === wanted.size, selected };
  })()`);
  if (!result.ok) {
    throw new Error(`Failed to select diagram tables: ${JSON.stringify(result)}`);
  }
}

async function connectThroughUi() {
  await js(`(() => {
    document.querySelector("dialog[open] button[aria-label='Close']")?.click();
    return { ok: true };
  })()`);

  const text = await bodyText();
  if (!text.text.includes("Not connected") && text.text.includes(server)) {
    return;
  }

  await clickVisibleButton(text.text.includes("Add Connection") ? "Add Connection" : "Connect");
  await waitFor("connection dialog", async () => {
    const text = await bodyText();
    return { ok: text.text.includes("Connect to Server"), value: text.text };
  });
  await clickVisibleButton("Connection String", "dialog[open] button");
  await setConnectionString();
  await clickVisibleButton("Connect", "dialog[open] button");
  await waitFor("connected toolbar", async () => {
    const text = await bodyText();
    return {
      ok: !text.text.includes("Connect to Server") && text.text.includes(server),
      value: text.text,
    };
  }, 45000);
}

async function getSmokeConnectionId() {
  const result = await js(`(async () => {
    const raw = await window.__TAURI__.core.invoke("connection_list");
    const connections = JSON.parse(raw);
    const matches = connections
      .filter((connection) =>
        connection.serverName === ${JSON.stringify(server)}
        && connection.database === ${JSON.stringify(database)}
        && connection.username === ${JSON.stringify(user)}
      )
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { ok: matches.length > 0, id: matches[0]?.id, count: matches.length };
  })()`);
  if (!result.ok) {
    throw new Error("Could not find the UI-created smoke connection");
  }
  return result.id;
}

async function testQueryEditor(artifacts) {
  await js('(() => { window.dispatchEvent(new Event("query:new-tab")); return { ok: true }; })()');
  await waitFor("Monaco editor", async () => {
    const result = await js("(() => ({ ok: (window.monaco?.editor?.getEditors?.().length ?? 0) > 0 }))()");
    return result;
  });

  await setEditorValue(
    "SELECT TOP (5) BusinessEntityID, FirstName, LastName FROM Person.Person ORDER BY BusinessEntityID;"
  );
  await waitForVisibleEditorText("visible SELECT query text", "SELECT TOP (5)");
  artifacts.querySql = await screenshot("01-query-sql-before-execute");
  await clickVisibleButton("Execute");
  await waitFor("five query rows", async () => {
    const result = await js(`(() => {
      const body = document.body.innerText;
      const cells = [...document.querySelectorAll("tbody td")].map((cell) => cell.textContent.trim());
      return {
        ok: (body.includes("Results  (5)") || body.includes("Results (5)")) && cells.includes("Ken"),
        value: { body: body.slice(0, 1000), cells: cells.slice(0, 20) }
      };
    })()`);
    return result;
  }, 45000);
  artifacts.queryResults = await screenshot("02-query-results");

  const multiSql = [
    "SELECT TOP (2) BusinessEntityID FROM Person.Person ORDER BY BusinessEntityID;",
    "GO",
    "SELECT TOP (3) FirstName FROM Person.Person ORDER BY BusinessEntityID;",
  ].join("\n");
  await setEditorValue(multiSql, 3);
  await waitForVisibleEditorText("visible current batch query text", "SELECT TOP (3)");
  await clickVisibleButton("Selection");
  await waitFor("current batch selection result", async () => {
    const result = await js(`(() => {
      const body = document.body.innerText;
      const cells = [...document.querySelectorAll("tbody td")].map((cell) => cell.textContent.trim());
      return {
        ok: (body.includes("Results  (3)") || body.includes("Results (3)")) && cells.includes("Ken"),
        value: { body: body.slice(0, 1000), cells: cells.slice(0, 20) }
      };
    })()`);
    return result;
  }, 45000);
  artifacts.querySelection = await screenshot("03-query-current-batch-selection");

  await setEditorValue("WAITFOR DELAY '00:00:10'; SELECT 1 AS ShouldNotFinish;");
  await waitForVisibleEditorText("visible cancellable query text", "WAITFOR DELAY");
  await clickVisibleButton("Execute");
  await waitFor("cancel enabled", async () => {
    const result = await js(`(() => {
      const button = [...document.querySelectorAll("button")]
        .find((item) => item.textContent.replace(/[■]/g, "").trim() === "Cancel");
      return { ok: Boolean(button && !button.disabled) };
    })()`);
    return result;
  }, 10000);
  await clickVisibleButton("Cancel");
  await waitFor("cancel message", async () => {
    const text = await bodyText();
    return { ok: /cancelled|canceled/i.test(text.text), value: text.text };
  }, 45000);
  artifacts.queryCancel = await screenshot("04-query-cancelled");
}

async function testDiagramWorkspace(connectionId, artifacts) {
  await js(`(() => {
    window.dispatchEvent(new CustomEvent("diagram:open", {
      detail: { connectionId: ${JSON.stringify(connectionId)}, database: ${JSON.stringify(database)} }
    }));
    return { ok: true };
  })()`);

  const loadedDiagram = await waitFor("readable database diagram loaded", async () => {
    const result = await js(`(() => ({
      ok: document.body.innerText.includes(${JSON.stringify(`${database} Database Diagram`)})
        && document.body.innerText.includes("selected. Drag tables on the canvas")
        && document.querySelectorAll(".react-flow__node").length >= 2,
      text: document.body.innerText,
      nodes: document.querySelectorAll(".react-flow__node").length,
      readableNodes: document.querySelectorAll(".react-flow__node").length
    }))()`);
    return { ok: result.ok, value: result };
  }, 60000);

  const smokeDiagramName = `Person identity map ${Date.now()}`;
  await setDiagramName(smokeDiagramName);
  await clickVisibleButton("Save*");
  await waitFor("named diagram saved", async () => {
    const result = await js(`(() => {
      const name = document.querySelector("input[aria-label='Diagram name']")?.value ?? "";
      const saved = [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Saved");
      const stored = Object.entries(localStorage)
        .filter(([key]) => key.startsWith("ssmsx.diagramViews."))
        .some(([, value]) => value.includes(${JSON.stringify(smokeDiagramName)}));
      return { ok: name === ${JSON.stringify(smokeDiagramName)} && saved && stored, name, saved, stored };
    })()`);
    return {
      ok: result.ok,
      value: result,
    };
  }, 10000);

  const emptyDiagramId = `smoke-diagram-${Date.now()}`;
  await js(`(() => {
    window.dispatchEvent(new CustomEvent("diagram:open", {
      detail: {
        connectionId: ${JSON.stringify(connectionId)},
        database: ${JSON.stringify(database)},
        diagramViewId: ${JSON.stringify(emptyDiagramId)},
        title: "Smoke empty diagram"
      }
    }));
    return { ok: true };
  })()`);
  await waitFor("new diagram starts empty", async () => {
    const result = await js(`(() => {
      const text = document.body.innerText;
      return {
        ok: text.includes("Smoke empty diagram")
          && text.includes("0 selected")
          && document.querySelectorAll(".react-flow__node").length === 0,
        text,
        nodes: document.querySelectorAll(".react-flow__node").length
      };
    })()`);
    return { ok: result.ok, value: result };
  }, 10000);

  await setDiagramFilter("Person.");
  await clickVisibleButton("Only filtered");
  const filteredSelection = await waitFor("filtered diagram table selection", async () => {
    const result = await js(`(() => {
      const text = document.body.innerText;
      const match = text.match(/(\\d+) selected/);
      const selectedCount = match ? Number(match[1]) : 0;
      return { ok: selectedCount > 2, selectedCount, text };
    })()`);
    return { ok: result.ok, value: result };
  }, 10000);

  await clickVisibleButton("Collapse");
  await waitFor("collapsed diagram table list", async () => {
    const text = await bodyText();
    return { ok: text.text.includes("Tables") && !text.text.includes("Only filtered"), value: text.text };
  }, 10000);
  await clickVisibleButton("Tables");
  await waitFor("expanded diagram table list", async () => {
    const text = await bodyText();
    return { ok: text.text.includes("Only filtered"), value: text.text };
  }, 10000);

  await selectDiagramTables(["Person.Person", "Person.EmailAddress"]);
  await setDiagramLayout("tb");
  const selectedDiagram = await waitFor("selected diagram tables", async () => {
    const result = await js(`(() => ({
      ok: document.body.innerText.includes("2 selected")
        && document.body.innerText.includes("Default:")
        && /nullable/i.test(document.body.innerText)
        && document.querySelectorAll(".react-flow__node").length === 2,
      text: document.body.innerText,
      nodes: document.querySelectorAll(".react-flow__node").length,
      draggableNodes: document.querySelectorAll(".react-flow__node-draggable").length
    }))()`);
    return { ok: result.ok, value: result };
  }, 15000);
  await clickVisibleButton("Save*");
  await waitFor("focused diagram saved", async () => {
    const text = await bodyText();
    return { ok: text.text.includes("Saved"), value: text.text };
  }, 10000);
  artifacts.diagram = await screenshot("05-database-diagram-selected-tables");

  await clickVisibleButton("SQL");
  const sqlOutput = await waitFor("SQL diagram output", async () => {
    const result = await getEditorValues();
    const value = result.values.find((editorValue) =>
      editorValue.includes("CREATE TABLE [Person].[Person]")
    );
    return { ok: Boolean(value), value: value?.slice(0, 200) ?? "" };
  });
  await waitForVisibleEditorText("visible generated SQL output", "CREATE TABLE");
  artifacts.sqlOutput = await screenshot("06-diagram-sql-output");

  await clickVisibleButton("EF Core");
  const efOutput = await waitFor("EF Core output", async () => {
    const result = await getEditorValues();
    const value = result.values.find((editorValue) =>
      editorValue.includes("public sealed class AdventureWorks2022DbContext")
        && editorValue.includes("IEntityTypeConfiguration<Person>")
    );
    return { ok: Boolean(value), value: value?.slice(0, 200) ?? "" };
  });
  await waitForVisibleEditorText("visible generated EF Core output", "public sealed class");
  artifacts.efOutput = await screenshot("07-diagram-ef-output");

  return {
    nodeCount: loadedDiagram.nodes,
    selectedNodeCount: selectedDiagram.nodes,
    filteredSelectionCount: filteredSelection.selectedCount,
    draggableNodeCount: selectedDiagram.draggableNodes,
    sqlPreview: sqlOutput,
    efPreview: efOutput,
  };
}

async function writeArtifactReport(summary, artifacts) {
  if (!artifactDir) return null;
  await mkdir(artifactDir, { recursive: true });
  const image = (path, caption) =>
    path
      ? `<figure><img src="${path.split("/").pop()}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`
      : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SSMSX Smoke Test Artifact</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8f9fa; color: #1a1a1a; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { color: #374151; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin: 24px 0; }
    .card { border: 1px solid #dee2e6; background: #fff; border-radius: 8px; padding: 16px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    figure { margin: 24px 0; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; background: #fff; }
    img { display: block; width: 100%; height: auto; }
    figcaption { padding: 10px 12px; font-size: 13px; color: #374151; border-top: 1px solid #dee2e6; background: #e9ecef; }
  </style>
</head>
<body>
  <main>
    <h1>SSMSX smoke test artifact</h1>
    <p>Generated ${new Date().toISOString()} against <code>${summary.server}</code> / <code>${summary.database}</code>.</p>
    <section class="grid">
      <div class="card"><strong>Query editor</strong><p>Executed SELECT, current GO-delimited batch, and cancellation through the Tauri UI.</p></div>
      <div class="card"><strong>Diagram</strong><p>Named and saved a diagram, selected ${summary.diagram.filteredSelectionCount} filtered tables, collapsed the table list, then focused ${summary.diagram.selectedNodeCount} tables and verified SQL plus EF Core generated output in Monaco.</p></div>
      <div class="card"><strong>Theme</strong><p>Monaco editor theme: <code>${summary.queryEditor.editorTheme}</code><br>App background: <code>${summary.queryEditor.appBackground}</code></p></div>
    </section>
    ${image(artifacts.querySql, "SQL query typed in Monaco before execution")}
    ${image(artifacts.queryResults, "Executed query showing returned rows")}
    ${image(artifacts.querySelection, "Current GO-delimited batch executed through Selection")}
    ${image(artifacts.queryCancel, "Running query cancelled from the editor")}
    ${image(artifacts.diagram, "Database diagram with selected tables, layout control, nullable and default badges")}
    ${image(artifacts.sqlOutput, "Generated SQL diagram script in Monaco")}
    ${image(artifacts.efOutput, "Generated EF Core split configuration output in Monaco")}
  </main>
</body>
</html>`;
  const reportPath = join(artifactDir, "index.html");
  await writeFile(reportPath, html);
  await writeFile(join(artifactDir, "summary.json"), JSON.stringify(summary, null, 2));
  return reportPath;
}

try {
  await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "ssmsx-tauri-smoke", version: "1.0.0" },
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  await tool("driver_session", { action: "start", host: "127.0.0.1", port });
  await tool("manage_window", { action: "resize", width: 1400, height: 900 });

  if (artifactDir) {
    await mkdir(artifactDir, { recursive: true });
  }
  const artifacts = {};

  await connectThroughUi();
  const connectionId = await getSmokeConnectionId();
  await testQueryEditor(artifacts);
  const diagram = await testDiagramWorkspace(connectionId, artifacts);

  const summary = await js(`(() => ({
    bodyIncludesDiagramCounts: /\\d+ of \\d+ tables, \\d+ relationships/.test(document.body.innerText),
    editorTheme: document.querySelector(".monaco-editor")?.className ?? "",
    editorBackground: document.querySelector(".monaco-editor") ? getComputedStyle(document.querySelector(".monaco-editor")).backgroundColor : "",
    appBackground: getComputedStyle(document.body).getPropertyValue("--color-bg-primary").trim(),
    hasSqlOutput: document.body.innerText.includes("SQL diagram output"),
    hasEfOutput: document.body.innerText.includes("EF Core split configuration output")
  }))()`);

  const output = {
    ok: true,
    server,
    database,
    connectionId,
    queryEditor: {
      executedSelect: true,
      executedCurrentBatch: true,
      cancelledRunningQuery: true,
      editorTheme: summary.editorTheme,
      editorBackground: summary.editorBackground,
      appBackground: summary.appBackground,
    },
    diagram: {
      nodeCount: diagram.nodeCount,
      selectedNodeCount: diagram.selectedNodeCount,
      filteredSelectionCount: diagram.filteredSelectionCount,
      draggableNodeCount: diagram.draggableNodeCount,
      bodyIncludesDiagramCounts: summary.bodyIncludesDiagramCounts,
      sqlPreview: diagram.sqlPreview,
      efPreview: diagram.efPreview,
    },
    stderr: stderr.filter(Boolean).slice(-5),
  };
  output.artifactReport = await writeArtifactReport(output, artifacts);
  console.log(JSON.stringify(output, null, 2));
} finally {
  await tool("driver_session", { action: "stop" }).catch(() => undefined);
  child.stdin.end();
  child.kill();
}
