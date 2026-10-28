import type { Page } from "@playwright/test";

export const hasRealKeys = Boolean(
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY,
);

export const GOOGLE_SCRIPT = "https://www.google.com/recaptcha/api.js*";

/** Our own script tag only. Google adds more scripts of its own after it loads. */
export const OUR_SCRIPT_SELECTOR = 'script[src*="recaptcha/api.js"]';

export const tokenInput = (page: Page) => page.locator('input[name="g-recaptcha-response"]');
export const result = (page: Page) => page.getByTestId("result");

/** Replace Google's script with a small stand-in, so a test needs no key and no network. */
export async function stubGoogle(page: Page) {
  const requests: string[] = [];
  await page.route(GOOGLE_SCRIPT, async (route) => {
    requests.push(route.request().url());
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.grecaptcha = {
        ready: function (cb) { cb(); },
        execute: function (key, options) { return Promise.resolve("stub-token:" + key + ":" + options.action); }
      };`,
    });
  });
  return requests;
}

const GOOGLE_ORIGIN = /^https:\/\/(www\.)?(google|gstatic)\.com\//;
// The browser reports this one against our page, not against Google's frame, so the origin
// check above cannot see it. It is only a report-only CSP notice about Google framing itself.
const GOOGLE_FRAMING_NOTICE =
  /^Framing 'https:\/\/(www\.)?google\.com\/' violates the following report-only/;

/**
 * Collect uncaught exceptions and console errors, to assert that navigation stays quiet.
 * Errors logged from Google's own frames are not ours (headless Chrome makes its iframe log
 * "requestStorageAccess: Permission denied"), so they are left out.
 */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (GOOGLE_ORIGIN.test(message.location().url)) return;
    if (GOOGLE_FRAMING_NOTICE.test(message.text())) return;
    errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

export const scriptCount = (page: Page) =>
  page.evaluate((selector) => document.querySelectorAll(selector).length, OUR_SCRIPT_SELECTOR);

export const hasGlobal = (page: Page) => page.evaluate(() => "grecaptcha" in window);

/** Badges Google draws. Loading the script twice would leave more than one. */
export const badgeCount = (page: Page) =>
  page.evaluate(() => document.querySelectorAll(".grecaptcha-badge").length);
