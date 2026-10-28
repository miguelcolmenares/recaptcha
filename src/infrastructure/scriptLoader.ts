import { RECAPTCHA_SCRIPT_URL } from "../domain";

/** The part of `window.grecaptcha` this package uses. */
export interface Grecaptcha {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const LOAD_ERROR_MESSAGE = "Failed to load reCAPTCHA script";

// One promise per site key, kept for the life of the page.
//
// The script is never removed. Google's script keeps state of its own (badge, iframes, extra
// scripts), and removing our tag does not reset it. Tested against real Google: loading it again
// after a client-side navigation left duplicate badges and extra scripts, and sometimes a global
// with no script tag. Loading once, as a plain <script> in a layout would, avoids all of that.
const loads = new Map<string, Promise<Grecaptcha>>();

function whenReady(grecaptcha: Grecaptcha): Promise<Grecaptcha> {
  return new Promise((resolve) => grecaptcha.ready(() => resolve(grecaptcha)));
}

function start(siteKey: string): Promise<Grecaptcha> {
  // The page already has reCAPTCHA (loaded by someone else): use it.
  if (window.grecaptcha?.ready) return whenReady(window.grecaptcha);

  return new Promise<Grecaptcha>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${RECAPTCHA_SCRIPT_URL}?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.addEventListener("load", () => {
      // The load event only says the file ran. `ready` says Google can answer.
      if (window.grecaptcha?.ready) resolve(whenReady(window.grecaptcha));
      else reject(new Error(LOAD_ERROR_MESSAGE));
    });
    script.addEventListener("error", () => {
      script.remove();
      reject(new Error(LOAD_ERROR_MESSAGE));
    });
    document.head.appendChild(script);
  });
}

/**
 * Load reCAPTCHA once per site key. Every caller gets the same promise, so concurrent callers
 * share one script and all of them see the same failure. A failed load is forgotten, so the
 * next call tries again. Browser only.
 */
export function loadRecaptcha(siteKey: string): Promise<Grecaptcha> {
  const existing = loads.get(siteKey);
  if (existing) return existing;

  const promise = start(siteKey);
  loads.set(siteKey, promise);
  promise.catch(() => {
    if (loads.get(siteKey) === promise) loads.delete(siteKey);
  });
  return promise;
}
