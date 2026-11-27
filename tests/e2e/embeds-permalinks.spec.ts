import { test, expect } from "@playwright/test";
import {
  DESKTOP_VIEWPORT,
  expectNoMobileOverflow,
  expectNoSeriousA11yViolations,
  trackRuntimeErrors,
} from "./helpers";

test.describe("Permalinks (#state=) and Embed (/embed/[slug]) verification", () => {
  test("restores #state= permalinks cleanly across JSON, Encoding, and Security tools", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackRuntimeErrors(page);

    // 1. JSON Formatter permalink round-trip
    await page.goto("/tools/json-formatter");
    const jsonSample = '{"matrix":"e2e","permalink":true,"n":3}';
    await page.getByLabel("JSON input").fill(jsonSample);
    await page.getByRole("button", { name: "Copy Link" }).click();
    await expect(page.getByRole("button", { name: /Link copied/i })).toBeVisible();
    const jsonUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(jsonUrl).toContain("/tools/json-formatter#state=");

    const pageJson = await context.newPage();
    await pageJson.goto(jsonUrl);
    await expect(pageJson.getByLabel("JSON input")).toHaveValue(jsonSample);
    await expect(pageJson.locator('pre[aria-label="JSON output"]')).toContainText(
      '"matrix": "e2e"'
    );
    await pageJson.close();

    // 2. Base64 Encoder permalink round-trip
    await page.goto("/tools/base64-encoder");
    await page.getByLabel("UTF-8 text input").fill("Code Station Matrix");
    await page.getByRole("button", { name: /^(Copy|Share) Link$/i }).click();
    await expect(page.getByRole("button", { name: /Link copied/i })).toBeVisible();
    const b64Url = await page.evaluate(() => navigator.clipboard.readText());
    expect(b64Url).toContain("/tools/base64-encoder#state=");

    const pageB64 = await context.newPage();
    await pageB64.goto(b64Url);
    await expect(pageB64.getByLabel("UTF-8 text input")).toHaveValue("Code Station Matrix");
    await expect(pageB64.locator('pre[aria-label="Base64 output"]')).toHaveText(
      "Q29kZSBTdGF0aW9uIE1hdHJpeA=="
    );
    await pageB64.close();

    // 3. SHA-256 Generator permalink round-trip
    await page.goto("/tools/sha-256-generator");
    await page.getByLabel("Text").fill("hello");
    await page.getByRole("button", { name: /^(Copy|Share) Link$/i }).click();
    await expect(page.getByRole("button", { name: /Link copied/i })).toBeVisible();
    const shaUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(shaUrl).toContain("/tools/sha-256-generator#state=");

    const pageSha = await context.newPage();
    await pageSha.goto(shaUrl);
    await expect(pageSha.getByLabel("Text")).toHaveValue("hello");
    await expect(pageSha.locator('pre[aria-label="SHA-256 hash"]')).toContainText(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
    await pageSha.close();

    expect(errors).toEqual([]);
  });

  test("renders chromeless embed routes with framing headers, themes, axe pass, and local execution", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    const embedTools = [
      { slug: "json-formatter", title: "JSON Formatter", theme: "dark" },
      { slug: "base64-encoder", title: "Base64 Encoder", theme: "light" },
      { slug: "uuid-generator", title: "UUID Generator", theme: "dark" },
    ] as const;

    for (const item of embedTools) {
      const route = `/embed/${item.slug}?theme=${item.theme}`;
      const res = await page.request.get(route);
      expect(res.status()).toBe(200);
      expect(res.headers()["x-frame-options"]).toBeUndefined();
      expect(res.headers()["content-security-policy"]).toContain("frame-ancestors *");

      await page.setViewportSize(DESKTOP_VIEWPORT);
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(item.theme);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex,\s*follow/i
      );
      await expect(page.locator("header.header")).toHaveCount(0);
      await expect(page.locator("footer.footer")).toHaveCount(0);
      await expect(page.getByTestId("embed-footer")).toContainText(item.title);
      await expectNoSeriousA11yViolations(page, route);
      await expectNoMobileOverflow(page, route);
    }

    // Verify local execution inside embed shell
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/embed/base64-encoder?theme=light");
    await page.getByLabel("UTF-8 text input").fill("Embed Ready");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('pre[aria-label="Base64 output"]')).toHaveText("RW1iZWQgUmVhZHk=");

    expect(errors).toEqual([]);
  });
});
