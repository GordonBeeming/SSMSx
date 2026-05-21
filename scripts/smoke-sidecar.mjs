import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readline from "node:readline";

const server = process.env.SSMSX_SMOKE_SERVER ?? "127.0.0.1,4242";
const user = process.env.SSMSX_SMOKE_USER ?? "sa";
const password = process.env.SSMSX_SMOKE_PASSWORD ?? "Password!@2";
const database = process.env.SSMSX_SMOKE_DATABASE ?? "AdventureWorks2022";
const sidecarBin = process.env.SSMSX_SMOKE_SIDECAR_BIN;
const sidecarArgs = process.env.SSMSX_SMOKE_SIDECAR_ARGS
  ? JSON.parse(process.env.SSMSX_SMOKE_SIDECAR_ARGS)
  : null;

const home = await mkdtemp(join(tmpdir(), "ssmsx-smoke-home-"));
const child = spawn(
  sidecarBin ?? "dotnet",
  sidecarArgs ?? (sidecarBin ? [] : ["run", "--project", "sidecar/src/Ssmsx.Sidecar/Ssmsx.Sidecar.csproj"]),
  {
    cwd: process.cwd(),
    env: { ...process.env, HOME: home, DOTNET_NOLOGO: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  }
);

const pending = new Map();
const events = [];
const errors = [];

const stdout = readline.createInterface({ input: child.stdout });
stdout.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    errors.push(`Non-JSON stdout: ${line}`);
    return;
  }

  const entry = pending.get(message.id);
  if (!entry) {
    errors.push(`Unexpected response id: ${message.id}`);
    return;
  }

  entry.responses.push(message);
  if (message.error || !entry.streaming || message.result?.done === true) {
    pending.delete(message.id);
    entry.resolve(entry.responses);
  }
});

child.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  if (!text.includes("Building...")) {
    events.push(text.trim());
  }
});

child.on("exit", (code) => {
  for (const entry of pending.values()) {
    entry.reject(new Error(`sidecar exited before response; code=${code}`));
  }
  pending.clear();
});

let seq = 0;

function send(method, params, { streaming = false } = {}) {
  const id = `smoke-${++seq}`;
  const request = { id, method, params };
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, responses: [], streaming });
  });
  child.stdin.write(`${JSON.stringify(request)}\n`);
  return promise.then((responses) => {
    const failed = responses.find((response) => response.error);
    if (failed) {
      throw new Error(`${method} failed: ${failed.error.code} ${failed.error.message}`);
    }
    return streaming ? responses.map((response) => response.result) : responses.at(-1).result;
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function summarizeQueryResults(batches) {
  const resultBatches = batches.filter((batch) => batch.rows || batch.columns);
  const columns = resultBatches.find((batch) => batch.columns)?.columns ?? [];
  const rows = resultBatches.flatMap((batch) => batch.rows ?? []);
  const messages = batches.flatMap((batch) => batch.messages ?? []);
  const resultSets = new Map();
  for (const batch of resultBatches) {
    const index = batch.resultSetIndex ?? 0;
    const existing = resultSets.get(index) ?? { columns: [], rows: [] };
    if (batch.columns?.length) {
      existing.columns = batch.columns;
    }
    if (batch.rows?.length) {
      existing.rows.push(...batch.rows);
    }
    resultSets.set(index, existing);
  }
  const final = batches.at(-1);
  return { columns, rows, messages, resultSets: [...resultSets.values()], final };
}

try {
  const ping = await send("ping");
  assert(ping.message === "pong", "ping should return pong");

  const connectionId = `smoke-${Date.now()}`;
  const connectionString = [
    `Server=${server}`,
    `Database=${database}`,
    `User Id=${user}`,
    `Password=${password}`,
    "Encrypt=Optional",
    "TrustServerCertificate=True",
  ].join(";");

  const connection = {
    id: connectionId,
    name: "SSMSX smoke database",
    serverName: server,
    authType: "ConnectionString",
    username: user,
    database,
    encrypt: "Optional",
    trustServerCertificate: true,
    connectionString,
    color: "#0063B2",
    createdAt: new Date().toISOString(),
  };

  const testResult = await send("connection.test", { connection });
  assert(testResult.success === true, `connection.test failed: ${testResult.error ?? "unknown"}`);

  const saved = await send("connection.save", { connection, clearCredential: false });
  assert(saved.id === connectionId, "connection.save should return saved connection");

  const duplicateConnection = {
    ...connection,
    id: `${connectionId}-duplicate`,
    name: "SSMSX smoke database duplicate",
    connectionString: [
      `Data Source=${server}`,
      `Initial Catalog=${database}`,
      `UID=${user}`,
      `PWD=${password}`,
      "Trust Server Certificate=True",
      "Encrypt=Optional",
    ].join(";"),
    createdAt: new Date().toISOString(),
  };
  const duplicateSaved = await send("connection.save", { connection: duplicateConnection, clearCredential: false });
  assert(duplicateSaved.id === connectionId, "duplicate connection.save should reuse the existing connection id");
  const savedConnections = await send("connection.list");
  assert(savedConnections.length === 1, "duplicate connection.save should not add another recent connection");

  const activeConnectionId = duplicateSaved.id;
  const connected = await send("connection.connect", { id: activeConnectionId });
  assert(connected.connectionId === activeConnectionId, "connection.connect should activate connection");

  const databases = await send("explorer.databases", { connectionId: activeConnectionId });
  for (const expected of ["AdventureWorks2022", "AdventureWorksDW2022", "WideWorldImporters"]) {
    assert(databases.some((db) => db.name === expected), `missing database ${expected}`);
  }

  const tables = await send("explorer.tables", { connectionId: activeConnectionId, database });
  assert(tables.some((table) => table.schema === "Person" && table.name === "Person"), "Person.Person table missing");

  const columns = await send("explorer.columns", {
    connectionId: activeConnectionId,
    database,
    schema: "Person",
    objectName: "Person",
  });
  assert(columns.some((column) => column.name === "FirstName"), "Person.Person FirstName column missing");

  const createScript = await send("explorer.objectDefinition", {
    connectionId: activeConnectionId,
    database,
    schema: "Person",
    objectName: "Person",
    objectType: "table",
  });
  assert(createScript.definition?.includes("CREATE TABLE [Person].[Person]"), "CREATE script should target Person.Person");
  assert(createScript.definition?.includes("[FirstName]"), "CREATE script should include FirstName");

  const select = summarizeQueryResults(
    await send(
      "query.execute",
      {
        connectionId: activeConnectionId,
        database,
        sql: "SELECT TOP (5) BusinessEntityID, FirstName, LastName FROM Person.Person ORDER BY BusinessEntityID;",
      },
      { streaming: true }
    )
  );
  assert(select.columns.length === 3, "SELECT should return three columns");
  assert(select.rows.length === 5, "SELECT TOP (5) should return five rows");
  assert(select.final.totalRows === 5, "SELECT final totalRows should be 5");

  const messages = summarizeQueryResults(
    await send(
      "query.execute",
      {
        connectionId: activeConnectionId,
        database,
        sql: "PRINT 'hello from ssmsx smoke'; SELECT COUNT(*) AS PersonCount FROM Person.Person;",
      },
      { streaming: true }
    )
  );
  assert(messages.rows.length === 1, "PRINT + SELECT should return one data row");
  assert(messages.messages.some((message) => message.text.includes("hello from ssmsx smoke")), "PRINT message missing");

  const multiResult = summarizeQueryResults(
    await send(
      "query.execute",
      {
        connectionId: activeConnectionId,
        database,
        sql: [
          "SELECT TOP (2) BusinessEntityID FROM Person.Person ORDER BY BusinessEntityID;",
          "SELECT TOP (3) FirstName FROM Person.Person ORDER BY BusinessEntityID;",
        ].join("\n"),
      },
      { streaming: true }
    )
  );
  assert(multiResult.resultSets.length === 2, "multi-result query should return two result sets");
  assert(multiResult.resultSets[0].rows.length === 2, "first result set should return two rows");
  assert(multiResult.resultSets[1].rows.length === 3, "second result set should return three rows");

  const invalid = await send(
    "query.execute",
    {
      connectionId: activeConnectionId,
      database,
      sql: "SELECT * FROM dbo.TableThatDoesNotExist;",
    },
    { streaming: true }
  ).then(
    () => null,
    (error) => error
  );
  assert(invalid?.message.includes("QUERY_ERROR"), "invalid query should surface QUERY_ERROR");

  const cancelId = `smoke-${++seq}`;
  const cancelPromise = new Promise((resolve, reject) => {
    pending.set(cancelId, { resolve, reject, responses: [], streaming: true });
  });
  child.stdin.write(
    `${JSON.stringify({
      id: cancelId,
      method: "query.execute",
      params: {
        connectionId: activeConnectionId,
        database,
        sql: "WAITFOR DELAY '00:00:10'; SELECT 1 AS ShouldNotNeedToFinish;",
      },
    })}\n`
  );
  const firstBatch = await new Promise((resolve, reject) => {
    const started = setInterval(() => {
      const entry = pending.get(cancelId);
      if (entry?.responses[0]?.result?.queryId) {
        clearInterval(started);
        resolve(entry.responses[0].result);
      }
    }, 25);
    setTimeout(() => {
      clearInterval(started);
      reject(new Error("timed out waiting for cancellable queryId"));
    }, 5000);
  });
  const cancelResult = await send("query.cancel", { queryId: firstBatch.queryId });
  assert(cancelResult.cancelled === true, "query.cancel should cancel the running query");
  const cancelled = summarizeQueryResults(await cancelPromise.then((responses) => responses.map((response) => response.result)));
  assert(
    cancelled.messages.some((message) => /cancelled|canceled/i.test(message.text)),
    "cancelled query should return a cancellation message"
  );

  const diagram = await send("explorer.databaseDiagram", { connectionId: activeConnectionId, database });
  assert(diagram.database === database, "diagram should report requested database");
  assert(diagram.tables.length > 0, "diagram should include tables");
  assert(diagram.relationships.length > 0, "diagram should include relationships");
  assert(
    diagram.tables.some((table) => table.schema === "Person" && table.name === "Person" && table.primaryKey.length > 0),
    "diagram should include Person.Person primary key"
  );

  await send("connection.disconnect", { id: activeConnectionId });

  console.log(
    JSON.stringify(
      {
        ok: true,
        server,
        database,
        tableCount: tables.length,
        diagramTables: diagram.tables.length,
        diagramRelationships: diagram.relationships.length,
        selectRows: select.rows.length,
        multiResultSets: multiResult.resultSets.map((set) => set.rows.length),
        printMessages: messages.messages.length,
        stderr: events.filter(Boolean).slice(-5),
      },
      null,
      2
    )
  );
} finally {
  child.stdin.end();
  child.kill();
  await rm(home, { recursive: true, force: true });
}
