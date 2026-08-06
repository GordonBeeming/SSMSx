import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, type Browser } from "@playwright/test";
import { createServer } from "vite";

const TEMPLATE = "  BEGIN TRANSACTION;\n    {{cursor}}SELECT 1;\nCOMMIT;  \n";
const PROCESSED_TEMPLATE = "  BEGIN TRANSACTION;\n    SELECT 1;\nCOMMIT;  \n";
const CURSOR_SENTINEL = "/* here */";
const SCREENSHOT_PATH = join(tmpdir(), "ssmsx-new-query-template-browser.png");

interface FixtureWindow extends Window {
  ssmsxNewQueryTemplateFixture?: {
    addGeneratedQuery: () => void;
    getActiveTab: () => { initialSql?: string; title: string } | undefined;
    getActiveSql: () => string;
    isActiveTabDirty: () => boolean;
  };
}

test("new query templates preserve whitespace and place the Monaco cursor", async () => {
  const vite = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: "error",
    plugins: [react(), tailwindcss()],
    server: { host: "127.0.0.1", port: 0 },
  });
  await vite.listen();

  const address = vite.httpServer?.address();
  assert(address && typeof address === "object");

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
    await page.goto(
      `http://127.0.0.1:${address.port}/tests/frontend/fixtures/newQueryTemplate.html`
    );

    await page.getByRole("button", { name: "Query Editor" }).click();
    const templateControl = page.getByRole("textbox", { name: "New query template" });
    await templateControl.waitFor();
    await templateControl.fill(TEMPLATE);

    const storedTemplate = await page.evaluate(() => {
      const raw = window.localStorage.getItem("ssmsx.settings");
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return null;
      }
      const queryEditor = Reflect.get(parsed, "queryEditor");
      if (typeof queryEditor !== "object" || queryEditor === null || Array.isArray(queryEditor)) {
        return null;
      }
      const template = Reflect.get(queryEditor, "newQueryTemplate");
      return typeof template === "string" ? template : null;
    });
    assert.equal(storedTemplate, TEMPLATE);

    const dialog = page.getByRole("dialog");
    const dialogBox = await dialog.boundingBox();
    const controlBox = await templateControl.boundingBox();
    assert(dialogBox && controlBox);
    assert.ok(dialogBox.x >= 0 && dialogBox.y >= 0);
    assert.ok(dialogBox.x + dialogBox.width <= 960 && dialogBox.y + dialogBox.height <= 720);
    assert.ok(controlBox.width >= 400 && controlBox.height >= 140);
    await page.screenshot({ path: SCREENSHOT_PATH });
    assert.ok(existsSync(SCREENSHOT_PATH));

    await page.getByRole("button", { name: "Close" }).click();
    await page.getByTitle(/New Query/).click();
    const monacoEditor = page.locator(".monaco-editor");
    await monacoEditor.waitFor();
    await page.waitForFunction(() => {
      const editor = document.querySelector(".monaco-editor");
      return editor?.contains(document.activeElement) ?? false;
    });

    const blankQuery = await page.evaluate(() => {
      const fixture = (window as FixtureWindow).ssmsxNewQueryTemplateFixture;
      return fixture
        ? {
            sql: fixture.getActiveSql(),
            dirty: fixture.isActiveTabDirty(),
          }
        : null;
    });
    assert.deepEqual(blankQuery, { sql: PROCESSED_TEMPLATE, dirty: false });

    await page.keyboard.insertText(CURSOR_SENTINEL);
    const observedMonacoValue = await page.evaluate(() => {
      return (window as FixtureWindow).ssmsxNewQueryTemplateFixture?.getActiveSql() ?? null;
    });
    assert.equal(
      observedMonacoValue,
      "  BEGIN TRANSACTION;\n    /* here */SELECT 1;\nCOMMIT;  \n"
    );

    const generatedQuery = await page.evaluate(() => {
      const fixture = (window as FixtureWindow).ssmsxNewQueryTemplateFixture;
      fixture?.addGeneratedQuery();
      const activeTab = fixture?.getActiveTab();
      return {
        initialSql: activeTab?.initialSql ?? null,
        sql: fixture?.getActiveSql() ?? null,
      };
    });
    assert.deepEqual(generatedQuery, {
      initialSql: "SELECT name FROM sys.databases;\n",
      sql: "SELECT name FROM sys.databases;\n",
    });

    console.log(
      `New-query screenshot: ${SCREENSHOT_PATH} (960x720); Monaco value observed with cursor insertion at line 2, column 5.`
    );
  } finally {
    await browser?.close();
    await vite.close();
  }
});
