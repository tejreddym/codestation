import { test, expect } from "@playwright/test";
import mcpCatalog from "../../config/mcp-docs-catalog.json";
import {
  DESKTOP_VIEWPORT,
  expectNoMobileOverflow,
  expectNoSeriousA11yViolations,
  trackRuntimeErrors,
} from "./helpers";

test.describe("Code Station Pro (/pro) Checkout, Seat Management & Plan Matrix", () => {
  test("displays plan cards, 3-tier comparison matrix, guarantee block, Manage License error/active states, 0 axe violations, and 0 mobile overflow", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = trackRuntimeErrors(page);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    const res = await page.goto("/pro");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Code Station Pro");

    // Verify accurate live counts & plan cards (Monthly Pro, Lifetime Access, Team Multi-Seat)
    await expect(page.locator("body")).toContainText(
      `${mcpCatalog.counts.executableTotal} Local MCP & CLI Tools`
    );
    await expect(page.getByRole("heading", { name: "Monthly Pro" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lifetime Access" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team Multi-Seat" })).toBeVisible();

    // Select Team 10 seats and verify currency & org input update
    const teamCard = page.getByTestId("team-plan-card");
    await teamCard.getByRole("button", { name: /10 seats/i }).click();
    await expect(page.getByPlaceholder("e.g. Acme Platform Engineering")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pay ₹1499 with Razorpay/i })).toBeVisible();

    // Verify Guarantee & Privacy box and 3-tier comparison matrix
    const guaranteeBox = page.getByTestId("pro-guarantee-box");
    await expect(guaranteeBox).toContainText("7-Day Guarantee");
    await expect(guaranteeBox).toContainText("hello@codestation.in");
    await expect(guaranteeBox).toContainText("Zero-Account Privacy");

    await expect(page.getByRole("columnheader", { name: "Free Tier" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Pro Individual/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Team Seats/i })).toBeVisible();

    // Verify Manage License error state on empty submit
    const manageSection = page.locator("#manage");
    await manageSection.getByRole("button", { name: "Verify & Manage" }).click();
    await expect(manageSection.getByRole("alert")).toContainText("Enter your license key");

    // Verify zero console/page errors before deliberate HTTP 403 invalid-key check
    expect(errors).toEqual([]);

    // Verify Manage License error state on unknown key (deliberately triggers HTTP 403)
    await manageSection.getByLabel("Code Station Pro license key").fill("CS-PRO-NOTFOUND-9999");
    await manageSection.getByRole("button", { name: "Verify & Manage" }).click();
    await expect(manageSection.getByRole("alert")).toContainText("hello@codestation.in");

    // Verify active key inspection UI via CS-PRO-DEV
    await manageSection.getByLabel("Code Station Pro license key").fill("CS-PRO-DEV");
    await manageSection.getByRole("button", { name: "Verify & Manage" }).click();
    await expect(manageSection.getByRole("status")).toContainText("Active Pro License");
    await expect(manageSection.getByRole("status")).toContainText("Active seats (1 / 3)");

    // Accessibility + 390px mobile overflow audit
    await expectNoSeriousA11yViolations(page, "/pro");
    await expectNoMobileOverflow(page, "/pro");

    const unexpectedErrors = errors.filter(
      (msg) => !msg.includes("status of 403 (Forbidden)")
    );
    expect(unexpectedErrors).toEqual([]);
  });
});
