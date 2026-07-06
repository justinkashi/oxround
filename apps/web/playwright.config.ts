// Playwright e2e config (VERSION 2 TDD). Runs the app in DEMO MODE (no Supabase
// env), so tests exercise the real UI + in-memory data layer and never touch
// production. Run: pnpm test:e2e   (first time: pnpm exec playwright install chromium)
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false, // demo state is per-page-load; serial keeps runs deterministic
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "next dev -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Force demo mode even if a .env with real keys exists.
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
});
