import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

function trackRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return errors;
}

async function expectNoSeriousA11yViolations(page: Page, routeName: string) {
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

test.describe("Code Station production smoke & accessibility suite", () => {
  test("homepage loads with zero runtime errors and passes axe checks", async ({ page }) => {
    const errors = trackRuntimeErrors(page);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "/");
    expect(errors).toEqual([]);
  });

  test("command palette opens, searches, and navigates to a tool", async ({ page }) => {
    const errors = trackRuntimeErrors(page);
    await page.goto("/");

    const trigger = page.getByRole("button", { name: /Open command palette/i });
    await trigger.click();

    const searchInput = page.getByPlaceholder("Search tools, stations, and actions…");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("json formatter");

    const option = page.getByRole("option", { name: /JSON Formatter/i }).first();
    await expect(option).toBeVisible();
    await option.click();

    await expect(page).toHaveURL(/\/tools\/json-formatter$/);
    await expect(page.getByRole("heading", { level: 1, name: /JSON Formatter/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("executes JSON Formatter, Base64 Encoder, and UUID Generator client-side", async ({ page }) => {
    const errors = trackRuntimeErrors(page);

    // 1. JSON Formatter
    await page.goto("/tools/json-formatter");
    await page.getByLabel("JSON input").fill('{"b":2,"a":1}');
    await page.getByRole("button", { name: "Format JSON" }).click();
    const jsonOutput = page.locator('pre[aria-label="JSON output"]');
    await expect(jsonOutput).toContainText('"b": 2');
    await expect(jsonOutput).toContainText('"a": 1');

    // 2. Base64 Encoder
    await page.goto("/tools/base64-encoder");
    await page.getByLabel("UTF-8 text").fill("Code Station");
    await page.getByRole("button", { name: "Encode Base64" }).click();
    await expect(page.locator('pre[aria-label="Base64 output"]')).toHaveText("Q29kZSBTdGF0aW9u");

    // 3. UUID Generator
    await page.goto("/tools/uuid-generator");
    await page.getByRole("button", { name: "Generate UUID" }).click();
    const uuidOutput = page.locator('pre[aria-label="UUID"]');
    await expect(uuidOutput).toHaveText(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    expect(errors).toEqual([]);
  });

  test("renders informational routes cleanly and passes axe checks", async ({ page }) => {
    const errors = trackRuntimeErrors(page);
    const routes = [
      ["/privacy", /Privacy Notice/i],
      ["/terms", /Terms of Use/i],
      ["/contact", /Contact & Support/i],
      ["/accessibility", /Accessibility Statement/i],
      ["/licenses", /Licenses and Notices/i],
    ] as const;

    for (const [path, heading] of routes) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoSeriousA11yViolations(page, path);
    }

    expect(errors).toEqual([]);
  });

  test("custom 404 route renders helpful navigation links", async ({ page }) => {
    const errors = trackRuntimeErrors(page);
    const res = await page.goto("/non-existent-station-route-404");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: /could not find/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse all tools" })).toHaveAttribute("href", "/tools");
    await expect(page.getByRole("link", { name: "View all stations" })).toHaveAttribute("href", "/#categories");
    const unexpectedErrors = errors.filter(
      (entry) => !entry.includes("status of 404 (Not Found)")
    );
    expect(unexpectedErrors).toEqual([]);
  });

  test("shares tool state via #state= permalink and restores input + output in a fresh page", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackRuntimeErrors(page);

    await page.goto("/tools/json-formatter");
    const sampleJson = '{"station":"Code Station","mode":"permalink","count":2}';
    await page.getByLabel("JSON input").fill(sampleJson);
    await page.getByRole("button", { name: "Copy Link" }).click();
    await expect(page.getByRole("button", { name: /Link copied/i })).toBeVisible();

    const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiedUrl).toContain("/tools/json-formatter#state=");

    const sharedPage = await context.newPage();
    const sharedErrors = trackRuntimeErrors(sharedPage);
    await sharedPage.goto(copiedUrl);

    await expect(sharedPage.getByLabel("JSON input")).toHaveValue(sampleJson);
    const restoredOutput = sharedPage.locator('pre[aria-label="JSON output"]');
    await expect(restoredOutput).toContainText('"station": "Code Station"');
    await expect(restoredOutput).toContainText('"mode": "permalink"');
    await expect(restoredOutput).toContainText('"count": 2');

    await sharedPage.close();
    expect(errors).toEqual([]);
    expect(sharedErrors).toEqual([]);
  });

  test("command palette quick actions toggle theme and ? opens keyboard shortcuts overlay", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);
    await page.goto("/");

    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme || "light");

    await page.getByRole("button", { name: /Open command palette/i }).click();
    const searchInput = page.getByPlaceholder("Search tools, stations, and actions…");
    await searchInput.fill("toggle theme");
    await page.getByRole("option", { name: /Toggle theme/i }).click();

    const toggledTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(toggledTheme).toBe(initialTheme === "dark" ? "light" : "dark");

    // Pressing '?' while not typing in an editable control opens shortcuts overlay
    await page.keyboard.press("?");
    const shortcutsDialog = page.getByRole("dialog", { name: /Keyboard shortcuts/i });
    await expect(shortcutsDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(shortcutsDialog).toBeHidden();

    expect(errors).toEqual([]);
  });

  test("embed route renders chromeless, sets noindex + framing headers, applies theme, and executes locally", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackRuntimeErrors(page);

    // 1. Verify framing security headers across routes
    const homeRes = await page.request.get("/");
    expect(homeRes.headers()["x-frame-options"]).toBe("DENY");
    expect(homeRes.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");

    const proRes = await page.request.get("/pro");
    expect(proRes.headers()["x-frame-options"]).toBe("DENY");
    expect(proRes.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");

    const embedRes = await page.request.get("/embed/json-formatter?theme=dark");
    expect(embedRes.status()).toBe(200);
    expect(embedRes.headers()["x-frame-options"]).toBeUndefined();
    expect(embedRes.headers()["content-security-policy"]).toContain("frame-ancestors *");

    // 1b. Verify dynamic OG image PNG generation and meta tags
    for (const ogPath of [
      "/og",
      "/og?type=tool&slug=json-formatter",
      "/og?type=station&slug=json-data",
    ]) {
      const ogRes = await page.request.get(ogPath);
      expect(ogRes.status()).toBe(200);
      expect(ogRes.headers()["content-type"]).toContain("image/png");
    }

    await page.goto("/tools/json-formatter");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/og\?type=tool&slug=json-formatter/
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      /\/og\?type=tool&slug=json-formatter/
    );

    // 2. Verify /tools/[slug] Embed modal generates snippet
    await page.goto("/tools/json-formatter");
    await page.getByRole("button", { name: "Embed" }).click();
    const embedModal = page.getByTestId("embed-modal");
    await expect(embedModal).toBeVisible();
    await page.getByTestId("embed-theme-select").selectOption("dark");
    await page.getByTestId("embed-height-select").selectOption("640");
    await expect(page.getByTestId("embed-snippet-textarea")).toHaveValue(
      /<iframe src="https:\/\/codestation\.in\/embed\/json-formatter\?theme=dark".*height="640"/
    );
    await page.getByTestId("btn-copy-embed-code").click();
    await expect(page.getByTestId("btn-copy-embed-code")).toHaveText("Embed Code Copied!");

    // 3. Verify /embed/[slug] renders chromeless + noindex + powered-by bar + executes tool
    await page.goto("/embed/json-formatter?theme=dark");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex,\s*follow/i);
    await expect(page.locator("header.header")).toHaveCount(0);
    await expect(page.locator("footer.footer")).toHaveCount(0);

    const footerBar = page.getByTestId("embed-footer");
    await expect(footerBar).toContainText("JSON Formatter");
    await expect(footerBar.getByRole("link", { name: /Powered by Code Station/i })).toHaveAttribute(
      "href",
      "https://codestation.in/tools/json-formatter"
    );

    await page.getByLabel("JSON input").fill('{"widget":"embed","ok":true}');
    await page.getByRole("button", { name: "Format JSON" }).click();
    await expect(page.locator('pre[aria-label="JSON output"]')).toContainText('"widget": "embed"');

    expect(errors).toEqual([]);
  });

  test("registers PWA service worker, supports dismissible install prompt, and runs tool offline", async ({
    context,
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto("/");
    // Confirm SW registers, finishes activating, and claims client control
    const swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sw = reg.active;
      if (sw && sw.state !== "activated") {
        await new Promise<void>((resolve) => {
          const onChange = () => {
            if (sw.state === "activated") {
              sw.removeEventListener("statechange", onChange);
              resolve();
            }
          };
          sw.addEventListener("statechange", onChange);
        });
      }
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
            once: true,
          });
        });
      }
      return {
        scriptURL: sw?.scriptURL ?? "",
        state: sw?.state ?? "",
        controlled: Boolean(navigator.serviceWorker.controller),
      };
    });
    expect(swState.scriptURL).toContain("/code-station-sw.js");
    expect(swState.state).toBe("activated");
    expect(swState.controlled).toBe(true);

    // Verify subtle Install App banner shows on beforeinstallprompt and persists dismissal
    await page.evaluate(() => {
      const evt = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(evt);
    });
    const installBanner = page.getByTestId("pwa-install-banner");
    await expect(installBanner).toBeVisible();
    await page.getByRole("button", { name: "Dismiss install prompt" }).click();
    await expect(installBanner).toBeHidden();

    // Load tool once online while controlled by SW so page + chunk assets populate caches
    await page.goto("/tools/json-formatter");
    await page.getByLabel("JSON input").fill('{"online":true}');
    await page.getByRole("button", { name: "Format JSON" }).click();
    await expect(page.locator('pre[aria-label="JSON output"]')).toContainText('"online": true');
    await page.waitForLoadState("networkidle");

    // Clear pre-offline errors, switch offline, and verify zero runtime/pageerror crashes
    expect(errors).toEqual([]);

    // Switch context completely offline and verify cached tool reloads and runs locally
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /JSON Formatter/i })).toBeVisible();

    await page.getByLabel("JSON input").fill('{"offline":true,"pwa":"ready"}');
    await page.getByRole("button", { name: "Format JSON" }).click();
    const offlineOutput = page.locator('pre[aria-label="JSON output"]');
    await expect(offlineOutput).toContainText('"offline": true');
    await expect(offlineOutput).toContainText('"pwa": "ready"');

    // Verify offline fallback route also loads offline
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /Offline starter pack/i })).toBeVisible();

    await context.setOffline(false);
    const unexpectedOfflineErrors = errors.filter(
      (entry) =>
        !entry.includes("ERR_INTERNET_DISCONNECTED") &&
        !entry.includes("Failed to fetch RSC payload")
    );
    expect(unexpectedOfflineErrors).toEqual([]);
  });

  test("comparison hub and versus pages return 200 cleanly without runtime errors", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);
    const compareRoutes = [
      ["/compare", /How Code Station compares/i],
      ["/compare/it-tools", /Code Station vs IT-Tools/i],
      ["/compare/cyberchef", /Code Station vs CyberChef/i],
      ["/compare/devtoys", /Code Station vs DevToys/i],
    ] as const;

    for (const [path, heading] of compareRoutes) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoSeriousA11yViolations(page, path);
    }

    expect(errors).toEqual([]);
  });

  test("WCAG 2.1 A/AA axe audit passes across core routes in light and dark themes", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const coreRoutes = [
      "/",
      "/tools/json-formatter",
      "/stations/json-data",
      "/pro",
      "/contact",
      "/accessibility",
      "/embed/json-formatter",
    ] as const;

    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext();
      await context.addInitScript((selectedTheme: string) => {
        localStorage.setItem("code-station-theme", selectedTheme);
      }, theme);
      const page = await context.newPage();
      const errors = trackRuntimeErrors(page);

      for (const route of coreRoutes) {
        const targetUrl =
          theme === "dark" && route.startsWith("/embed/") ? `${route}?theme=dark` : route;
        const res = await page.goto(targetUrl);
        expect(res?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoSeriousA11yViolations(page, `${route} (${theme})`);
      }

      expect(errors).toEqual([]);
      await context.close();
    }
  });

  test("modals trap Tab focus, pass axe checks, and restore focus on Escape", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);
    await page.goto("/tools/json-formatter");

    // 1. Command Palette modal (⌘K trigger button)
    const paletteTrigger = page.getByRole("button", { name: /Open command palette/i });
    await paletteTrigger.click();
    const paletteDialog = page.getByRole("dialog", { name: /Command palette/i });
    await expect(paletteDialog).toBeVisible();
    await expectNoSeriousA11yViolations(page, "CommandPalette modal");

    const searchInput = page.getByPlaceholder("Search tools, stations, and actions…");
    const paletteClose = page.getByRole("button", { name: "Close command palette" });
    await expect(searchInput).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(paletteClose).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(searchInput).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(paletteDialog).toBeHidden();
    await expect(paletteTrigger).toBeFocused();

    // 2. Keyboard Shortcuts modal (?)
    await paletteTrigger.focus();
    await page.keyboard.press("?");
    const shortcutsDialog = page.getByRole("dialog", { name: /Keyboard shortcuts/i });
    await expect(shortcutsDialog).toBeVisible();
    await expectNoSeriousA11yViolations(page, "KeyboardShortcuts modal");
    const shortcutsClose = page.getByRole("button", { name: "Close keyboard shortcuts" });
    const shortcutsRegion = page.getByRole("region", { name: "Keyboard shortcut list" });
    await expect(shortcutsClose).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(shortcutsRegion).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(shortcutsClose).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(shortcutsRegion).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(shortcutsDialog).toBeHidden();
    await expect(paletteTrigger).toBeFocused();

    // 3. Embed modal
    const embedTrigger = page.getByRole("button", { name: "Embed" });
    await embedTrigger.click();
    const embedDialog = page.getByTestId("embed-modal");
    await expect(embedDialog).toBeVisible();
    await expectNoSeriousA11yViolations(page, "Embed modal");
    const embedClose = page.getByRole("button", { name: "Close embed dialog" });
    const copyEmbedBtn = page.getByTestId("btn-copy-embed-code");
    await expect(embedClose).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(copyEmbedBtn).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(embedClose).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(embedDialog).toBeHidden();
    await expect(embedTrigger).toBeFocused();

    expect(errors).toEqual([]);
  });

  test("settings displays local engine diagnostics section cleanly", async ({ page }) => {
    const errors = trackRuntimeErrors(page);
    const res = await page.goto("/settings");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 2, name: /Local Engine Diagnostics/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy bug report" })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "/settings");
    expect(errors).toEqual([]);
  });

  test("Pro page displays Team tier card, seat selector, and license management UI", async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);
    const res = await page.goto("/pro");
    expect(res?.status()).toBe(200);

    const teamCard = page.getByTestId("team-plan-card");
    await expect(teamCard).toBeVisible();
    await teamCard.getByRole("button", { name: /10 seats/i }).click();
    await expect(
      page.getByRole("button", { name: /Pay ₹1499 with Razorpay \(Team · 10 seats\)/i })
    ).toBeVisible();
    await expect(page.getByLabel("Organization / Team Name (optional)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify & Manage" })).toBeVisible();
    await expectNoSeriousA11yViolations(page, "/pro (team selected)");

    expect(errors).toEqual([]);
  });
});
