import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "test/browser", timeout: 60_000, expect: { timeout: 15_000 }, workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: { command: "pnpm dev", url: "http://127.0.0.1:5173", reuseExistingServer: true, timeout: 30_000 },
});
