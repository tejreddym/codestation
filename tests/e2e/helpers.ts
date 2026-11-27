import fs from "node:fs";
import { expect, type Download, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;
export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

export function trackRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return errors;
}

export async function expectNoSeriousA11yViolations(page: Page, routeName: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );
  expect(
    serious,
    `Serious/critical axe violations on ${routeName}: ${JSON.stringify(
      serious.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 3).map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
      null,
      2
    )}`
  ).toEqual([]);
}

export async function expectNoMobileOverflow(page: Page, label: string) {
  await page.setViewportSize(MOBILE_VIEWPORT);
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(
    metrics.scrollWidth,
    `Horizontal overflow on ${label} at ${MOBILE_VIEWPORT.width}px: scrollWidth=${metrics.scrollWidth}, innerWidth=${metrics.innerWidth}`
  ).toBeLessThanOrEqual(metrics.innerWidth);
}

export async function setPageTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((nextTheme) => {
    try {
      window.localStorage.setItem("code-station-theme", nextTheme);
    } catch {
      // Ignore storage access failures
    }
    document.documentElement.dataset.theme = nextTheme;
  }, theme);
}

export async function readDownloadBytes(
  page: Page,
  trigger: () => Promise<void>
): Promise<{ filename: string; bytes: Buffer; download: Download }> {
  const downloadPromise = page.waitForEvent("download");
  await trigger();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath, `Expected download file path for ${download.suggestedFilename()}`).toBeTruthy();
  const bytes = fs.readFileSync(filePath!);
  expect(
    bytes.byteLength,
    `Expected non-empty download for ${download.suggestedFilename()}`
  ).toBeGreaterThan(0);
  return {
    filename: download.suggestedFilename(),
    bytes,
    download,
  };
}
