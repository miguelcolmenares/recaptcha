import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

try {
  // Local runs: keys come from .env.local. In CI they come from repository secrets.
  process.loadEnvFile(join(import.meta.dirname, "..", ".env.local"));
} catch {
  // No .env.local, so the tests that need a real key skip themselves.
}

const PORT = 3111;

export default defineConfig({
  testDir: join(import.meta.dirname, "specs"),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Serves the fixture that `npm run verify:package` built from the packed tarball.
  webServer: {
    command: `npx next start -p ${PORT}`,
    cwd: join(import.meta.dirname, "fixture", ".build"),
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: process.env.RECAPTCHA_SECRET_KEY
      ? { RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY }
      : {},
  },
});
