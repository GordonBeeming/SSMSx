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
const completedResponses = new Map();
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
    completedResponses.set(message.id, entry.responses);
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

function beginSend(method, params, { streaming = false, allowError = false } = {}) {
  const id = `smoke-${++seq}`;
  const request = { id, method, params };
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, responses: [], streaming });
  });
  child.stdin.write(`${JSON.stringify(request)}\n`);
  const result = promise.then((responses) => {
    const failed = responses.find((response) => response.error);
    if (failed && !allowError) {
      throw new Error(`${method} failed: ${failed.error.code} ${failed.error.message}`);
    }
    if (allowError) {
      return responses;
    }
    return streaming ? responses.map((response) => response.result) : responses.at(-1).result;
  });
  return { id, result };
}

function send(method, params, options) {
  return beginSend(method, params, options).result;
}

function waitForQueryStart(id, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = setInterval(() => {
      const entry = pending.get(id);
      const responses = entry?.responses ?? completedResponses.get(id);
      const firstResponse = responses?.[0];
      if (firstResponse?.error) {
        clearInterval(started);
        clearTimeout(timeout);
        completedResponses.delete(id);
        reject(
          new Error(
            `query ${id} failed to start: ${firstResponse.error.code} ${firstResponse.error.message}`
          )
        );
      } else if (firstResponse?.result?.queryId) {
        clearInterval(started);
        clearTimeout(timeout);
        completedResponses.delete(id);
        resolve(firstResponse.result);
      }
    }, 25);
    const timeout = setTimeout(() => {
      clearInterval(started);
      reject(new Error(`timed out waiting for query ${id} to start`));
    }, timeoutMs);
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
  const primarySessionId = "smoke-primary-session";
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
        sessionId: primarySessionId,
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
        sessionId: primarySessionId,
        connectionId: activeConnectionId,
        database,
        sql: "PRINT 'hello from ssmsx smoke'; SELECT COUNT(*) AS PersonCount FROM Person.Person;",
      },
      { streaming: true }
    )
  );
  assert(messages.rows.length === 1, "PRINT + SELECT should return one data row");
  assert(messages.messages.some((message) => message.text.includes("hello from ssmsx smoke")), "PRINT message missing");

  const affectedRows = summarizeQueryResults(
    await send(
      "query.execute",
      {
        sessionId: primarySessionId,
        connectionId: activeConnectionId,
        database,
        sql: [
          "CREATE TABLE #SsmsxAffectedRows (Id int NOT NULL);",
          "INSERT INTO #SsmsxAffectedRows (Id) VALUES (1), (2);",
          "UPDATE #SsmsxAffectedRows SET Id = 3 WHERE Id = 1;",
          "DELETE FROM #SsmsxAffectedRows WHERE Id = 2;",
          "UPDATE #SsmsxAffectedRows SET Id = 4 WHERE Id = 999;",
        ].join("\n"),
      },
      { streaming: true }
    )
  );
  const affectedRowMessages = affectedRows.messages
    .map((message) => message.text)
    .filter((text) => /^\(\d+ rows? affected\)$/.test(text));
  assert(
    JSON.stringify(affectedRowMessages) === JSON.stringify(["(2 rows affected)", "(1 row affected)", "(1 row affected)", "(0 rows affected)"]),
    `affected-row messages should preserve DML event order: ${JSON.stringify(affectedRowMessages)}`
  );

  const interleavedMessages = summarizeQueryResults(
    await send(
      "query.execute",
      {
        sessionId: primarySessionId,
        connectionId: activeConnectionId,
        database,
        sql: [
          "CREATE TABLE #SsmsxInterleavedMessages (Id int NOT NULL);",
          "PRINT 'before affected row';",
          "INSERT INTO #SsmsxInterleavedMessages (Id) VALUES (1);",
          "PRINT 'between affected rows';",
          "UPDATE #SsmsxInterleavedMessages SET Id = 2 WHERE Id = 1;",
          "PRINT 'after affected row';",
        ].join("\n"),
      },
      { streaming: true }
    )
  ).messages
    .map((message) => message.text)
    .filter((text) => /affected row/.test(text) || /^\(\d+ rows? affected\)$/.test(text));
  assert(
    JSON.stringify(interleavedMessages) === JSON.stringify([
      "before affected row",
      "(1 row affected)",
      "between affected rows",
      "(1 row affected)",
      "after affected row",
    ]),
    `PRINT and affected-row messages should preserve wire order: ${JSON.stringify(interleavedMessages)}`
  );

  const noCount = summarizeQueryResults(
    await send(
      "query.execute",
      {
        sessionId: primarySessionId,
        connectionId: activeConnectionId,
        database,
        sql: [
          "CREATE TABLE #SsmsxNoCountRows (Id int NOT NULL);",
          "SET NOCOUNT ON;",
          "INSERT INTO #SsmsxNoCountRows (Id) VALUES (1), (2);",
          "UPDATE #SsmsxNoCountRows SET Id = 3 WHERE Id = 1;",
          "DELETE FROM #SsmsxNoCountRows WHERE Id = 2;",
          "SET NOCOUNT OFF;",
        ].join("\n"),
      },
      { streaming: true }
    )
  );
  const noCountRowMessages = noCount.messages
    .map((message) => message.text)
    .filter((text) => /^\(\d+ rows? affected\)$/.test(text));
  assert(
    noCountRowMessages.length === 0,
    `SET NOCOUNT ON should suppress affected-row messages: ${JSON.stringify(noCountRowMessages)}`
  );

  const multiResult = summarizeQueryResults(
    await send(
      "query.execute",
      {
        sessionId: primarySessionId,
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

  const invalidResponses = await send(
    "query.execute",
    {
      sessionId: primarySessionId,
      connectionId: activeConnectionId,
      database,
      sql: [
        "CREATE TABLE #SsmsxAffectedRowsBeforeError (Id int NOT NULL);",
        "INSERT INTO #SsmsxAffectedRowsBeforeError (Id) VALUES (1), (2);",
        "SELECT * FROM dbo.TableThatDoesNotExist;",
      ].join("\n"),
    },
    { streaming: true, allowError: true }
  );
  const affectedRowsBeforeErrorIndex = invalidResponses.findIndex((response) =>
    response.result?.messages?.some((message) => message.text === "(2 rows affected)")
  );
  const queryErrorIndex = invalidResponses.findIndex(
    (response) => response.error?.code === "QUERY_ERROR"
  );
  assert(
    affectedRowsBeforeErrorIndex >= 0,
    "successful DML before an invalid statement should preserve its affected-row message"
  );
  assert(queryErrorIndex >= 0, "invalid query should surface QUERY_ERROR");
  assert(
    affectedRowsBeforeErrorIndex < queryErrorIndex,
    "affected-row messages should be delivered before the later query error"
  );

  const stateSessionId = "smoke-state-session";
  await send(
    "query.execute",
    {
      sessionId: stateSessionId,
      connectionId: activeConnectionId,
      database,
      sql: "CREATE TABLE #SsmsxSessionState (Value int NOT NULL); INSERT INTO #SsmsxSessionState VALUES (42);",
    },
    { streaming: true }
  );
  const persistedState = summarizeQueryResults(
    await send(
      "query.execute",
      {
        sessionId: stateSessionId,
        connectionId: activeConnectionId,
        database,
        sql: "SELECT Value FROM #SsmsxSessionState;",
      },
      { streaming: true }
    )
  );
  assert(persistedState.rows[0]?.[0] === 42, "a query window should retain its SQL session state");

  const isolatedState = summarizeQueryResults(
    await send(
      "query.execute",
      {
        sessionId: "smoke-isolated-session",
        connectionId: activeConnectionId,
        database,
        sql: "SELECT CASE WHEN OBJECT_ID('tempdb..#SsmsxSessionState') IS NULL THEN 1 ELSE 0 END AS IsIsolated;",
      },
      { streaming: true }
    )
  );
  assert(isolatedState.rows[0]?.[0] === 1, "SQL session state should not leak between query windows");

  const sessionClosed = await send("query.sessionClose", {
    sessionId: stateSessionId,
    connectionId: activeConnectionId,
  });
  assert(sessionClosed.closed === true, "query.sessionClose should release an existing query session");

  const delayedQuery = beginSend(
    "query.execute",
    {
      sessionId: "smoke-concurrent-delayed",
      connectionId: activeConnectionId,
      database,
      sql: "WAITFOR DELAY '00:00:03'; SELECT 1 AS DelayedResult;",
    },
    { streaming: true }
  );
  await waitForQueryStart(delayedQuery.id);
  const fastQuery = beginSend(
    "query.execute",
    {
      sessionId: "smoke-concurrent-fast",
      connectionId: activeConnectionId,
      database,
      sql: "SELECT 1 AS FastResult;",
    },
    { streaming: true }
  );
  const firstCompleted = await Promise.race([
    delayedQuery.result.then(() => "delayed"),
    fastQuery.result.then(() => "fast"),
  ]);
  assert(firstCompleted === "fast", "a fast query window should not wait behind another window on the same connection");
  const fastResult = summarizeQueryResults(await fastQuery.result);
  const delayedResult = summarizeQueryResults(await delayedQuery.result);
  assert(fastResult.rows[0]?.[0] === 1, "concurrent fast query should return its result");
  assert(delayedResult.rows[0]?.[0] === 1, "concurrent delayed query should finish normally");

  const firstCancellationQuery = beginSend(
    "query.execute",
    {
      sessionId: "smoke-cancel-first",
      connectionId: activeConnectionId,
      database,
      sql: "WAITFOR DELAY '00:00:10'; SELECT 1 AS FirstCancellationResult;",
    },
    { streaming: true }
  );
  const secondCancellationQuery = beginSend(
    "query.execute",
    {
      sessionId: "smoke-cancel-second",
      connectionId: activeConnectionId,
      database,
      sql: "WAITFOR DELAY '00:00:10'; SELECT 1 AS SecondCancellationResult;",
    },
    { streaming: true }
  );
  const [firstCancellationStart, secondCancellationStart] = await Promise.all([
    waitForQueryStart(firstCancellationQuery.id),
    waitForQueryStart(secondCancellationQuery.id),
  ]);
  const firstCancelResult = await send("query.cancel", { queryId: firstCancellationStart.queryId });
  assert(firstCancelResult.cancelled === true, "query.cancel should cancel the selected query window");
  const firstCancelled = summarizeQueryResults(await firstCancellationQuery.result);
  assert(
    firstCancelled.messages.some((message) => /cancelled|canceled/i.test(message.text)),
    "the selected query window should return a cancellation message"
  );
  const secondQueryState = await Promise.race([
    secondCancellationQuery.result.then(() => "finished"),
    new Promise((resolve) => setTimeout(() => resolve("running"), 250)),
  ]);
  assert(secondQueryState === "running", "cancelling one query window should not cancel another");
  const secondCancelResult = await send("query.cancel", { queryId: secondCancellationStart.queryId });
  assert(secondCancelResult.cancelled === true, "the second query window should be independently cancellable");
  const secondCancelled = summarizeQueryResults(await secondCancellationQuery.result);
  assert(
    secondCancelled.messages.some((message) => /cancelled|canceled/i.test(message.text)),
    "the second query window should return its own cancellation message"
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
  assert(errors.length === 0, `sidecar protocol errors: ${errors.join("; ")}`);

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
        concurrentQueryOrder: firstCompleted,
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
