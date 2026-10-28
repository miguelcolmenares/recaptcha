import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  badgeCount,
  hasGlobal,
  hasRealKeys,
  result,
  scriptCount,
  stubGoogle,
  tokenInput,
  watchErrors,
} from "./support";

// Real Google can take a few seconds to answer.
const TOKEN_TIMEOUT = 20_000;

const link = (page: Page, name: string) => page.getByRole("link", { name, exact: true });
const expectToken = (page: Page) =>
  expect(tokenInput(page)).not.toHaveValue("", { timeout: TOKEN_TIMEOUT });

/** Marks the document, so a later check can prove the navigation did not reload the page. */
const markDocument = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __spa: boolean }).__spa = true;
  });
const documentSurvived = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spa?: boolean }).__spa === true);

for (const mode of ["stubbed", "real"] as const) {
  test.describe(`client-side navigation with ${mode} Google`, () => {
    test.skip(
      mode === "real" && !hasRealKeys,
      "Set NEXT_PUBLIC_RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY to run.",
    );

    test.beforeEach(async ({ page }) => {
      if (mode === "stubbed") await stubGoogle(page);
    });

    test("the script survives leaving the form and is not loaded twice on return", async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await page.goto("/");
      await expectToken(page);
      expect(await scriptCount(page)).toBe(1);
      await markDocument(page);

      await link(page, "Plain page").click();
      await expect(page.getByTestId("plain")).toBeVisible();
      // Nothing is unloaded: Google keeps state of its own that a removed tag does not reset.
      expect(await scriptCount(page)).toBe(1);
      expect(await hasGlobal(page)).toBe(true);

      await link(page, "Home").click();
      await expectToken(page);
      expect(await scriptCount(page)).toBe(1);
      if (mode === "real") expect(await badgeCount(page)).toBe(1);

      expect(await documentSurvived(page)).toBe(true); // it was a soft navigation
      expect(errors).toEqual([]);
    });

    test("a lazy form after a soft navigation waits for the viewport, then works", async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await page.goto("/");
      await expectToken(page);
      await markDocument(page);

      await link(page, "Lazy page").click();
      await expect(page.getByText("Scroll down")).toBeVisible();
      // The script is still there from the first page, but this form has no token until it is seen.
      await expect(tokenInput(page)).toHaveValue("");

      await page.locator("form").scrollIntoViewIfNeeded();
      await expectToken(page);
      expect(await scriptCount(page)).toBe(1);
      if (mode === "real") expect(await badgeCount(page)).toBe(1);

      expect(await documentSurvived(page)).toBe(true);
      expect(errors).toEqual([]);
    });

    test("back and forward buttons keep the form working", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/");
      await expectToken(page);

      await link(page, "Plain page").click();
      await expect(page.getByTestId("plain")).toBeVisible();

      await page.goBack();
      await expectToken(page);
      expect(await scriptCount(page)).toBe(1);

      await page.goForward();
      await expect(page.getByTestId("plain")).toBeVisible();
      await page.goBack();
      await expectToken(page);
      expect(await scriptCount(page)).toBe(1);

      expect(errors).toEqual([]);
    });

    test("fast navigation never leaves two scripts on the page", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/");
      await markDocument(page);

      for (const name of ["Lazy page", "Plain page", "Home", "Plain page", "Home"]) {
        await link(page, name).click();
      }

      await expectToken(page);
      expect(await scriptCount(page)).toBe(1);
      if (mode === "real") expect(await badgeCount(page)).toBe(1);
      expect(await documentSurvived(page)).toBe(true);
      expect(errors).toEqual([]);
    });

    test("a lazy form that is the first page also loads cleanly on direct load", async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await page.goto("/lazy");
      await expect.poll(() => scriptCount(page)).toBe(0);
      await page.locator("form").scrollIntoViewIfNeeded();
      await expectToken(page);
      expect(await scriptCount(page)).toBe(1);
      if (mode === "real") expect(await badgeCount(page)).toBe(1);
      expect(errors).toEqual([]);
    });

    test("a form submitted after navigating still reaches the server with its token", async ({
      page,
    }) => {
      await page.goto("/");
      await expectToken(page);
      await link(page, "Plain page").click();
      await expect(page.getByTestId("plain")).toBeVisible();
      await link(page, "Home").click();
      await expectToken(page);

      await page.getByRole("button", { name: "Send" }).click();
      await expect(result(page)).toContainText('"tokenReceived":true');

      const text = (await result(page).textContent()) ?? "";
      if (mode === "stubbed") {
        expect(text).toContain('"success":false'); // a made-up token is never valid
      } else {
        expect(text).toContain('"success":true');
      }
    });
  });
}
