import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import {
  DESKTOP_VIEWPORT,
  expectNoMobileOverflow,
  readDownloadBytes,
  setPageTheme,
  trackRuntimeErrors,
} from "./helpers";

// Valid 1x1 transparent PNG
const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function createSamplePdfBuffer(title: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.addPage([200, 200]);
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

test.describe("Top ~30 tools coverage matrix across categories", () => {
  test("JSON & Data tools (json-formatter, json-validator, json-to-yaml, jsonpath-tester) with theme, mobile, clipboard, and downloads", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackRuntimeErrors(page);

    // 1. json-formatter (light + dark theme, mobile overflow, clipboard, .json download)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/json-formatter");
    await page.getByLabel("JSON input").fill('{"b":2,"a":1}');
    await page.getByRole("button", { name: "Format JSON" }).click();
    await expect(page.locator('pre[aria-label="JSON output"]')).toContainText('"b": 2');

    await page.getByRole("button", { name: "Copy", exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('"a": 1');

    const jsonDl = await readDownloadBytes(page, () =>
      page.getByRole("button", { name: /Download \.json/i }).click()
    );
    expect(jsonDl.bytes.toString("utf-8")).toContain('"b": 2');

    await setPageTheme(page, "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await setPageTheme(page, "light");
    await expectNoMobileOverflow(page, "/tools/json-formatter");

    // 2. json-validator
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/json-validator");
    await page.getByLabel("JSON input").fill('{"valid":true}');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('pre[aria-label="Validation result"]')).toContainText('"valid": true');
    await expectNoMobileOverflow(page, "/tools/json-validator");

    // 3. json-to-yaml (+ .yaml download bytes)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/json-to-yaml");
    await page.getByLabel("JSON input").fill('{"service":"codestation","local":true}');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('pre[aria-label="YAML output"]')).toContainText("service: codestation");
    const yamlDl = await readDownloadBytes(page, () =>
      page.getByRole("button", { name: /Download \.yaml/i }).click()
    );
    expect(yamlDl.bytes.toString("utf-8")).toContain("service: codestation");
    await expectNoMobileOverflow(page, "/tools/json-to-yaml");

    // 4. jsonpath-tester
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/jsonpath-tester");
    await page.getByLabel("JSON input").fill('{"users":[{"name":"Ada"},{"name":"Lin"}]}');
    await page.getByLabel("JSONPath expression").fill("$.users[*].name");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('pre[aria-label="Matched values"]')).toContainText("Ada");
    await expectNoMobileOverflow(page, "/tools/jsonpath-tester");

    expect(errors).toEqual([]);
  });

  test("Encoding & Security/JWT tools (base64-encoder, base64-decoder, url-encoder, jwt-decoder, uuid-generator, sha-256-generator)", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackRuntimeErrors(page);

    // 5. base64-encoder
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/base64-encoder");
    await page.getByLabel("UTF-8 text input").fill("Code Station");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('pre[aria-label="Base64 output"]')).toHaveText("Q29kZSBTdGF0aW9u");
    await expectNoMobileOverflow(page, "/tools/base64-encoder");

    // 6. base64-decoder
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/base64-decoder");
    await page.getByLabel("Base64 input").fill("Q29kZSBTdGF0aW9u");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('pre[aria-label="UTF-8 text output"]')).toHaveText("Code Station");
    await expectNoMobileOverflow(page, "/tools/base64-decoder");

    // 7. url-encoder
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/url-encoder");
    await page.getByLabel("Complete URL input").fill("https://codestation.in/tools?q=hello world");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('pre[aria-label="Encoded URL output"]')).toContainText("hello%20world");
    await expectNoMobileOverflow(page, "/tools/url-encoder");

    // 8. jwt-decoder (+ clipboard copy; valid 12-char Base64URL signature)
    const sampleJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzAxIiwicm9sZSI6ImRldiJ9.c2lnbmF0dXJl";
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/jwt-decoder");
    await page.getByLabel("Three-part JWT input").fill(sampleJwt);
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("main")).toContainText("user_01");
    await page.getByRole("button", { name: /Copy Payload/i }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('"sub"');
    await expectNoMobileOverflow(page, "/tools/jwt-decoder");

    // 9. uuid-generator (+ dark theme + clipboard)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/uuid-generator");
    await page.locator('form button[type="submit"]').click();
    const uuidOut = page.locator('pre[aria-label="UUID"]');
    await expect(uuidOut).toHaveText(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/i
    );
    await setPageTheme(page, "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await setPageTheme(page, "light");
    await expectNoMobileOverflow(page, "/tools/uuid-generator");

    // 10. sha-256-generator
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/sha-256-generator");
    await page.getByLabel("Text").fill("hello");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('pre[aria-label="SHA-256 hash"]')).toContainText(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
    await expectNoMobileOverflow(page, "/tools/sha-256-generator");

    expect(errors).toEqual([]);
  });

  test("Regex, Cron, SQL & Text tools (regex-tester, regex-replace-tester, cron-explainer, cron-validator, sql-formatter, text-counter, case-converter, text-diff)", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackRuntimeErrors(page);

    // 11. regex-tester
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/regex-tester");
    await page.getByLabel("Regex Pattern").fill("dev-[0-9]+");
    await page.getByLabel("Test text").fill("box dev-42 and dev-99");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("main")).toContainText("dev-42");
    await expectNoMobileOverflow(page, "/tools/regex-tester");

    // 12. regex-replace-tester
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/regex-replace-tester");
    await page.getByLabel("Regex Pattern").fill("foo");
    await page.getByLabel("Test text").fill("foo bar foo");
    await page.getByLabel(/g · Global/i).check();
    await page.getByLabel("Replacement text").fill("baz");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("main")).toContainText("baz bar baz");
    await expectNoMobileOverflow(page, "/tools/regex-replace-tester");

    // 13. cron-explainer
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/cron-explainer");
    await page.getByLabel("Cron expression").fill("*/15 * * * *");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("main")).toContainText("15");
    await expectNoMobileOverflow(page, "/tools/cron-explainer");

    // 14. cron-validator
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/cron-validator");
    await page.getByLabel("Cron expression").fill("0 9 * * 1-5");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("main")).toContainText(/valid/i);
    await expectNoMobileOverflow(page, "/tools/cron-validator");

    // 15. sql-formatter (+ copy + dark theme)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/sql-formatter");
    await page.getByLabel("SQL text").fill("select id,name from users where active=1");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole("region", { name: "Formatted SQL" })).toContainText(
      "active = 1"
    );
    await page.getByRole("button", { name: "Copy Formatted SQL" }).click();
    expect((await page.evaluate(() => navigator.clipboard.readText())).toLowerCase()).toContain(
      "active = 1"
    );
    await setPageTheme(page, "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await setPageTheme(page, "light");
    await expectNoMobileOverflow(page, "/tools/sql-formatter");

    // 16. text-counter
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/text-counter");
    await page.getByRole("textbox", { name: "Text", exact: true }).fill("Code Station");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole("region", { name: "Character count" })).toContainText("12");
    await expectNoMobileOverflow(page, "/tools/text-counter");

    // 17. case-converter
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/case-converter");
    await page.getByRole("textbox", { name: "Text", exact: true }).fill("hello world");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole("region", { name: "Transformed text" })).toContainText(
      /hello|HELLO/i
    );
    await expectNoMobileOverflow(page, "/tools/case-converter");

    // 18. text-diff
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/text-diff");
    await page.getByRole("textbox", { name: "Text A", exact: true }).fill("alpha\nbeta");
    await page.getByRole("textbox", { name: "Text B", exact: true }).fill("alpha\ngamma");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole("region", { name: "Diff result" })).toContainText("gamma");
    await expectNoMobileOverflow(page, "/tools/text-diff");

    expect(errors).toEqual([]);
  });

  test("Color, Markdown & Code Generation tools (color-converter, contrast-checker, markdown-to-html, markdown-table-generator, json-to-typescript, json-to-zod)", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackRuntimeErrors(page);

    // 19. color-converter
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/color-converter");
    await page.getByRole("textbox", { name: "Color", exact: true }).fill("#d9f975");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("main")).toContainText(/217|rgb/i);
    await expectNoMobileOverflow(page, "/tools/color-converter");

    // 20. contrast-checker
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/contrast-checker");
    await page.getByLabel("Foreground color").fill("#151713");
    await page.getByLabel("Background color").fill("#ffffff");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("main")).toContainText(/AAA|AA/i);
    await expectNoMobileOverflow(page, "/tools/contrast-checker");

    // 21. markdown-to-html
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/markdown-to-html");
    await page.getByLabel("Markdown text").fill("# Hello Station\n\nLocal **bold** text.");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("main")).toContainText("<h1>Hello Station</h1>");
    await expectNoMobileOverflow(page, "/tools/markdown-to-html");

    // 22. markdown-table-generator
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/markdown-table-generator");
    await page.getByLabel("Column names").fill("Name, Role");
    await page.getByLabel("Rows").fill("Ada, Engineer\nLin, Designer");
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator("main")).toContainText("| Name | Role |");
    await expectNoMobileOverflow(page, "/tools/markdown-table-generator");

    // 23. json-to-typescript (+ copy + .ts download bytes + dark theme)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/json-to-typescript");
    await page.getByLabel("Source code input").fill('{"id":1,"name":"Ada"}');
    await page.getByRole("button", { name: "Generate Code" }).click();
    await expect(page.locator('pre[aria-label="Generated output"]')).toContainText("id: number;");

    await page.getByRole("button", { name: "Copy", exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("interface");

    const tsDl = await readDownloadBytes(page, () =>
      page.getByRole("button", { name: "Download", exact: true }).click()
    );
    expect(tsDl.bytes.toString("utf-8")).toContain("id: number");

    await setPageTheme(page, "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await setPageTheme(page, "light");
    await expectNoMobileOverflow(page, "/tools/json-to-typescript");

    // 24. json-to-zod
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/json-to-zod");
    await page.getByLabel("Source code input").fill('{"enabled":true}');
    await page.getByRole("button", { name: "Generate Code" }).click();
    await expect(page.locator('pre[aria-label="Generated output"]')).toContainText("z.boolean()");
    await expectNoMobileOverflow(page, "/tools/json-to-zod");

    expect(errors).toEqual([]);
  });

  test("Network, AI/Tokens, QR & Finance tools (cidr-calculator, dockerfile-generator, ai-token-counter, json-repair, emi-calculator, gst-calculator, qr-code-generator)", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    // 25. cidr-calculator
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/cidr-calculator");
    await expect(page.locator("main")).toContainText("255.255.255.0");
    await expectNoMobileOverflow(page, "/tools/cidr-calculator");

    // 26. dockerfile-generator
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/dockerfile-generator");
    await expect(page.locator("main")).toContainText("FROM");
    await expectNoMobileOverflow(page, "/tools/dockerfile-generator");

    // 27. ai-token-counter (+ dark mode)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/ai-token-counter");
    await expect(page.locator("main")).toContainText(/token/i);
    await setPageTheme(page, "dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await setPageTheme(page, "light");
    await expectNoMobileOverflow(page, "/tools/ai-token-counter");

    // 28. json-repair
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/json-repair");
    await expect(page.locator("main")).toContainText('"code-station-agent"');
    await expectNoMobileOverflow(page, "/tools/json-repair");

    // 29. emi-calculator
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/emi-calculator");
    await page.getByRole("button", { name: "Calculate EMI" }).click();
    await expect(page.locator("main")).toContainText(/₹/);
    await expectNoMobileOverflow(page, "/tools/emi-calculator");

    // 30. gst-calculator
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/gst-calculator");
    await page.getByRole("button", { name: "Calculate GST" }).click();
    await expect(page.locator("main")).toContainText(/CGST|IGST|GST/i);
    await expectNoMobileOverflow(page, "/tools/gst-calculator");

    // 31. qr-code-generator (+ real PNG download bytes)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/qr-code-generator");
    await page.getByLabel("URL or Text Content").fill("https://codestation.in");
    const pngDownloadBtn = page.getByRole("button", { name: "Download PNG" });
    await expect(pngDownloadBtn).toBeEnabled();
    const qrDl = await readDownloadBytes(page, () => pngDownloadBtn.click());
    // Valid PNG magic header: 89 50 4E 47
    expect(qrDl.bytes.subarray(0, 4).toString("hex")).toBe("89504e47");
    await expectNoMobileOverflow(page, "/tools/qr-code-generator");

    expect(errors).toEqual([]);
  });

  test("Image & PDF file-processing tools (png-to-webp, image-resizer, pdf-merge) produce real non-empty download bytes", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    // 32. png-to-webp (upload real 1x1 PNG -> convert to WebP -> download non-empty WEBP bytes)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/png-to-webp");
    await page.locator('input[type="file"]').setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64"),
    });
    await page.locator('form button[type="submit"]').click();
    const webpBtn = page.getByRole("button", { name: /Download WEBP/i });
    await expect(webpBtn).toBeVisible();
    const webpDl = await readDownloadBytes(page, () => webpBtn.click());
    expect(webpDl.bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    await expectNoMobileOverflow(page, "/tools/png-to-webp");

    // 33. image-resizer (upload real 1x1 PNG -> resize -> download non-empty PNG)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/image-resizer");
    await page.locator('input[type="file"]').setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: Buffer.from(ONE_BY_ONE_PNG_BASE64, "base64"),
    });
    await page.getByLabel("Width").fill("8");
    await page.getByLabel("Height").fill("8");
    await page.locator('form button[type="submit"]').click();
    const resizedBtn = page.getByRole("button", { name: /Download PNG/i });
    await expect(resizedBtn).toBeVisible();
    const resizedDl = await readDownloadBytes(page, () => resizedBtn.click());
    expect(resizedDl.bytes.subarray(0, 4).toString("hex")).toBe("89504e47");
    await expectNoMobileOverflow(page, "/tools/image-resizer");

    // 34. pdf-merge (merge 2 generated PDFs -> verify %PDF- header + non-empty bytes)
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/tools/pdf-merge");
    const [pdf1, pdf2] = await Promise.all([
      createSamplePdfBuffer("Doc 1"),
      createSamplePdfBuffer("Doc 2"),
    ]);
    await page.locator('input[type="file"]').setInputFiles([
      { name: "first.pdf", mimeType: "application/pdf", buffer: pdf1 },
      { name: "second.pdf", mimeType: "application/pdf", buffer: pdf2 },
    ]);
    const mergedDl = await readDownloadBytes(page, () =>
      page.getByRole("button", { name: /Merge & Download PDF/i }).click()
    );
    expect(mergedDl.filename).toContain(".pdf");
    expect(mergedDl.bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    await expectNoMobileOverflow(page, "/tools/pdf-merge");

    expect(errors).toEqual([]);
  });
});
