import { expect, test } from "@playwright/test";
import { hasRealKeys, result, stubGoogle, tokenInput } from "./support";

// The stub echoes the site key the fixture was built with, so match the shape, not the key.
const STUB_TOKEN = /^stub-token:.+:contact$/;

test.describe("with a stubbed Google script", () => {
  test("a Server Component can import the root entry", async ({ page }) => {
    await stubGoogle(page);
    await page.goto("/");
    await expect(page.getByTestId("min-score")).toHaveText("0.5");
  });

  test("the token reaches the hidden input and then the Server Action", async ({ page }) => {
    await stubGoogle(page);
    await page.goto("/");

    await expect(tokenInput(page)).toHaveValue(STUB_TOKEN);
    await page.getByRole("button", { name: "Send" }).click();

    // A made-up token is never valid, but the server must have received it.
    await expect(result(page)).toContainText('"tokenReceived":true');
    await expect(result(page)).toContainText('"success":false');
  });

  test("lazy mode loads Google only after the form scrolls into view", async ({ page }) => {
    const requests = await stubGoogle(page);
    await page.goto("/lazy");
    await page.waitForLoadState("networkidle");
    expect(requests).toHaveLength(0);
    await expect(tokenInput(page)).toHaveValue("");

    await page.locator("form").scrollIntoViewIfNeeded();

    await expect.poll(() => requests.length).toBe(1);
    await expect(tokenInput(page)).toHaveValue(STUB_TOKEN);
  });
});

test.describe("with real Google keys", () => {
  test.skip(!hasRealKeys, "Set NEXT_PUBLIC_RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY to run.");

  test("Google issues a token and the server accepts the exchange", async ({ page }) => {
    await page.goto("/");
    await expect(tokenInput(page)).not.toHaveValue("", { timeout: 20_000 });

    await page.getByRole("button", { name: "Send" }).click();
    await expect(result(page)).toContainText('"tokenReceived":true');

    // The fixture accepts any score, so a real token must verify. Server Action coverage is in
    // serverAction.spec.ts; this only checks that nothing failed.
    await expect(result(page)).toContainText('"success":true');
  });
});
