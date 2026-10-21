import { defineConfig, devices } from "@playwright/test";

// Browser tests for NexusCX AI.
//   npm run test:e2e              -> starts the built app (npm run start) and runs every test
//   E2E_BASE_URL=http://localhost:3000 npm run test:e2e   -> uses an app that is already running
// Tests tagged @public need no accounts. The journey tests need test accounts in environment
// variables (see tests/e2e/README.md) and are skipped when those are missing.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "npm run start -- -p 3100",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
