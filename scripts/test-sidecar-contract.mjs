import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readline from "node:readline";

const project = "sidecar/src/Ssmsx.Sidecar/Ssmsx.Sidecar.csproj";
const dataHome = await mkdtemp(join(tmpdir(), "ssmsx-sidecar-contract-"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function startSidecar() {
  const child = spawn(
    "dotnet",
    ["run", "--no-build", "--project", project],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: dataHome,
        USERPROFILE: dataHome,
        DOTNET_NOLOGO: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    }
  );
  const pending = new Map();
  const stderr = [];
  const exitPromise = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      for (const { reject, timeout } of pending.values()) {
        clearTimeout(timeout);
        reject(
          new Error(
            `Sidecar exited before responding (code=${code}, signal=${signal})`
          )
        );
      }
      pending.clear();
      resolve({ code, signal });
    });
  });

  child.once("error", (error) => {
    for (const { reject, timeout } of pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    pending.clear();
  });
  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    let response;
    try {
      response = JSON.parse(line);
    } catch {
      return;
    }

    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    clearTimeout(request.timeout);
    if (response.error) {
      request.reject(
        new Error(`${response.error.code}: ${response.error.message}`)
      );
    } else {
      request.resolve(response.result);
    }
  });

  let sequence = 0;
  function send(method, params = null) {
    const id = `contract-${++sequence}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(
          new Error(
            `Timed out waiting for ${method}; stderr=${stderr.join("").trim()}`
          )
        );
      }, 10_000);
      pending.set(id, { resolve, reject, timeout });
      child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  async function stop() {
    child.stdin.end();
    const exited = await Promise.race([
      exitPromise.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!exited) {
      child.kill();
      await exitPromise;
    }
  }

  return { send, stop };
}

function connection(id, colorProfileId) {
  return {
    id,
    name: id,
    serverName: `${id}.example.com`,
    authType: "SqlAuth",
    encrypt: "Mandatory",
    trustServerCertificate: false,
    colorProfileId,
    createdAt: "2026-07-27T00:00:00Z",
  };
}

let sidecar;
try {
  sidecar = startSidecar();
  const ping = await sidecar.send("ping");
  assert(ping.message === "pong", "Sidecar did not respond to ping");

  await sidecar.send("connection.save", {
    connection: connection("first", "custom-profile"),
    clearCredential: false,
  });
  await sidecar.send("connection.save", {
    connection: connection("second", "custom-profile"),
    clearCredential: false,
  });
  await sidecar.send("connection.save", {
    connection: connection("unchanged", "blue"),
    clearCredential: false,
  });

  const reassigned = await sidecar.send("connection.reassignColorProfile", {
    fromProfileId: "custom-profile",
    toProfileId: "red",
  });
  assert(
    reassigned.updatedCount === 2,
    `Expected updatedCount=2, received ${JSON.stringify(reassigned)}`
  );
  await sidecar.stop();
  sidecar = null;

  sidecar = startSidecar();
  const persisted = await sidecar.send("connection.list");
  assert(
    persisted.find((item) => item.id === "first")?.colorProfileId === "red",
    "First reassignment did not persist"
  );
  assert(
    persisted.find((item) => item.id === "second")?.colorProfileId === "red",
    "Second reassignment did not persist"
  );
  assert(
    persisted.find((item) => item.id === "unchanged")?.colorProfileId ===
      "blue",
    "Unrelated profile assignment changed"
  );

  console.log(
    JSON.stringify({
      ok: true,
      method: "connection.reassignColorProfile",
      updatedCount: reassigned.updatedCount,
      persistedConnections: persisted.length,
    })
  );
} finally {
  await sidecar?.stop();
  await rm(dataHome, { recursive: true, force: true });
}
