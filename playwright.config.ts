import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT || 3100);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

const includeCrossBrowserProjects =
  process.env.PLAYWRIGHT_ALL_BROWSERS === "1" ||
  process.env.PLAYWRIGHT_MEDIA_BROWSERS === "1" ||
  process.argv.some((arg) => arg.includes("firefox") || arg.includes("webkit"));

const projects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
  ...(includeCrossBrowserProjects
    ? [
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
      ]
    : []),
];

export default defineConfig({
  testDir: "./tests",
  testMatch: ["playwright/**/*.spec.ts", "e2e/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects,
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
