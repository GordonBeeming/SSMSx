import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
const MESSAGES_SCREENSHOT_PATH = join(tmpdir(), "ssmsx-query-messages-select-all.png");
const VITE_CACHE_DIR = mkdtempSync(join(tmpdir(), "ssmsx-new-query-template-vite-"));

interface FixtureWindow extends Window {
  ssmsxNewQueryTemplateFixture?: {
    addGeneratedQuery: () => void;
    getActiveTab: () => { initialSql?: string; title: string } | undefined;
    getActiveSql: () => string;
    isActiveTabDirty: () => boolean;
    showMessages: () => void;
  };
}

test("query acceptance preserves template whitespace and scopes message selection", async () => {
  const vite = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: "error",
    plugins: [react(), tailwindcss()],
    cacheDir: VITE_CACHE_DIR,
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

    assert.equal(await templateControl.inputValue(), "\n{{cursor}}\n");
    const lineNumbers = page.getByTestId("new-query-template-line-numbers");
    assert.equal(await lineNumbers.innerText(), "1\n2\n3");

    const dialog = page.getByRole("dialog");
    const dialogBox = await dialog.boundingBox();
    const controlBox = await templateControl.boundingBox();
    assert(dialogBox && controlBox);
    assert.ok(dialogBox.x >= 0 && dialogBox.y >= 0);
    assert.ok(dialogBox.x + dialogBox.width <= 960 && dialogBox.y + dialogBox.height <= 720);
    assert.ok(controlBox.width >= 350 && controlBox.height >= 140);
    await page.screenshot({ path: SCREENSHOT_PATH });
    assert.ok(existsSync(SCREENSHOT_PATH));

    await templateControl.fill(TEMPLATE);
    assert.equal(await lineNumbers.innerText(), "1\n2\n3\n4");

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

    await page.evaluate(() => {
      (window as FixtureWindow).ssmsxNewQueryTemplateFixture?.showMessages();
    });
    const messages = page.getByRole("region", { name: "Query messages" });
    await messages.focus();
    await page.keyboard.press("Meta+a");
    const selectedText = await page.evaluate(() => window.getSelection()?.toString());
    assert.equal(selectedText, "Only this query message should be selected.\n");
    assert.doesNotMatch(selectedText ?? "", /New query template acceptance/);
    await page.keyboard.press("Control+a");
    const controlSelectedText = await page.evaluate(() => window.getSelection()?.toString());
    assert.equal(controlSelectedText, "Only this query message should be selected.\n");
    assert.doesNotMatch(controlSelectedText ?? "", /New query template acceptance/);
    await page.screenshot({ path: MESSAGES_SCREENSHOT_PATH });
    assert.ok(existsSync(MESSAGES_SCREENSHOT_PATH));
  } finally {
    await browser?.close();
    await vite.close();
    rmSync(VITE_CACHE_DIR, { recursive: true, force: true });
  }
});
