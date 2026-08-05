import assert from "node:assert/strict";
import test from "node:test";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, type Browser } from "@playwright/test";
import { createServer } from "vite";

function relativeLuminance(rgb: number[]): number {
  const channels = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(background: string, foreground: string): number {
  const parseRgb = (value: string) =>
    value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [];
  const backgroundLuminance = relativeLuminance(parseRgb(background));
  const foregroundLuminance = relativeLuminance(parseRgb(foreground));
  const [lighter, darker] = [backgroundLuminance, foregroundLuminance].sort(
    (left, right) => right - left
  );
  return (lighter + 0.05) / (darker + 0.05);
}

test("Object Explorer applies profile styles per subtree without tinting its shell", async () => {
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
    const page = await browser.newPage();
    await page.goto(
      `http://127.0.0.1:${address.port}/tests/frontend/fixtures/objectExplorerStyles.html`
    );

    const explorer = page.getByTestId("object-explorer");
    const production = page.getByRole("treeitem", { name: "Production" });
    const productionDatabase = page.getByRole("treeitem", { name: "master" });
    const reporting = page.getByRole("treeitem", { name: "Reporting" });
    const selectedDatabase = page.getByRole("treeitem", { name: "warehouse" });
    await selectedDatabase.waitFor();

    assert.equal(
      await explorer.evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgba(0, 0, 0, 0)"
    );

    for (const row of [production, productionDatabase]) {
      assert.equal(
        await row.evaluate((element) => getComputedStyle(element).backgroundColor),
        "rgb(0, 0, 0)"
      );
      assert.equal(
        await row.evaluate((element) => getComputedStyle(element).color),
        "rgb(255, 255, 255)"
      );
    }

    for (const row of [reporting, selectedDatabase]) {
      assert.equal(
        await row.evaluate((element) => getComputedStyle(element).backgroundColor),
        "rgb(255, 255, 255)"
      );
      assert.equal(
        await row.evaluate((element) => getComputedStyle(element).color),
        "rgb(118, 118, 118)"
      );
    }

    assert.equal(await selectedDatabase.getAttribute("aria-selected"), "true");
    assert.match(
      await selectedDatabase.evaluate((element) => getComputedStyle(element).boxShadow),
      /rgb\(118, 118, 118\).*3px.*inset|inset.*3px.*rgb\(118, 118, 118\)/
    );

    await production.hover();
    assert.match(
      await production.evaluate((element) => getComputedStyle(element).boxShadow),
      /rgb\(255, 255, 255\).*1px.*inset|inset.*1px.*rgb\(255, 255, 255\)/
    );
    assert.equal(
      await production.evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(0, 0, 0)"
    );
    assert.equal(
      await production.evaluate((element) => getComputedStyle(element).color),
      "rgb(255, 255, 255)"
    );

    const productionToggle = production.getByRole("button");
    await productionToggle.hover();
    assert.equal(
      await productionToggle.evaluate((element) => getComputedStyle(element).color),
      "rgb(255, 255, 255)"
    );
    await productionToggle.focus();
    assert.equal(
      await productionToggle.evaluate((element) => getComputedStyle(element).color),
      "rgb(255, 255, 255)"
    );

    const selectedColours = await selectedDatabase.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        foreground: style.color,
      };
    });
    assert.ok(
      contrastRatio(selectedColours.background, selectedColours.foreground) >= 4.5,
      `Selected profile contrast fell below 4.5:1: ${JSON.stringify(selectedColours)}`
    );

    await page.emulateMedia({ forcedColors: "active" });
    const forcedColourSelection = await selectedDatabase.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    assert.deepEqual(forcedColourSelection, {
      outlineStyle: "solid",
      outlineWidth: "2px",
    });
  } finally {
    await browser?.close();
    await vite.close();
  }
});
