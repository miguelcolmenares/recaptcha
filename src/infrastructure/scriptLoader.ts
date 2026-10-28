import { RECAPTCHA_SCRIPT_URL } from "../domain/constants";

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

export interface ScriptHandle {
  /** Resolves when `grecaptcha.ready` has fired, not only when the script tag has loaded. */
  promise: Promise<Grecaptcha>;
  /** Give back this handle. The script is removed after the last handle is released. */
  release: () => void;
}

interface Entry {
  promise: Promise<Grecaptcha>;
  refs: number;
  script: HTMLScriptElement | null;
}

const entries = new Map<string, Entry>();

const LOAD_ERROR_MESSAGE = "Failed to load reCAPTCHA script";

function whenReady(grecaptcha: Grecaptcha): Promise<Grecaptcha> {
  return new Promise((resolve) => grecaptcha.ready(() => resolve(grecaptcha)));
}

function removeBadge(): void {
  document.querySelectorAll(".grecaptcha-badge").forEach((badge) => badge.parentElement?.remove());
}

function teardown(siteKey: string, entry: Entry): void {
  // A new handle may have been taken while the teardown was waiting.
  if (entry.refs > 0 || entries.get(siteKey) !== entry) return;
  entries.delete(siteKey);
  if (entry.script) {
    entry.script.remove();
    // window.grecaptcha is shared by every site key, so only clear it when no other
    // key still owns a script.
    const othersLoaded = [...entries.values()].some((other) => other.script);
    if (!othersLoaded) {
      delete window.grecaptcha;
      removeBadge();
    }
  }
}

function createEntry(siteKey: string): Entry {
  // The page already has reCAPTCHA (loaded by someone else): use it and own nothing.
  if (window.grecaptcha?.ready) {
    return { promise: whenReady(window.grecaptcha), refs: 0, script: null };
  }

  const script = document.createElement("script");
  script.src = `${RECAPTCHA_SCRIPT_URL}?render=${encodeURIComponent(siteKey)}`;
  script.async = true;

  const promise = new Promise<Grecaptcha>((resolve, reject) => {
    script.addEventListener("load", () => {
      if (window.grecaptcha?.ready) resolve(whenReady(window.grecaptcha));
      else reject(new Error(LOAD_ERROR_MESSAGE));
    });
    script.addEventListener("error", () => reject(new Error(LOAD_ERROR_MESSAGE)));
  });

  const entry: Entry = { promise, refs: 0, script };
  // On failure drop the entry, so the next caller can try again. Every caller that is
  // already waiting holds the same promise, so all of them see the rejection.
  promise.catch(() => {
    script.remove();
    if (entries.get(siteKey) === entry) entries.delete(siteKey);
  });

  document.head.appendChild(script);
  return entry;
}

/** Load reCAPTCHA once per site key, shared by every caller. Browser only. */
export function loadRecaptcha(siteKey: string): ScriptHandle {
  let entry = entries.get(siteKey);
  if (!entry) {
    entry = createEntry(siteKey);
    entries.set(siteKey, entry);
  }
  entry.refs += 1;

  const owned = entry;
  let released = false;
  return {
    promise: owned.promise,
    release() {
      if (released) return;
      released = true;
      owned.refs -= 1;
      // React Strict Mode unmounts and mounts again right away. Wait one tick before
      // removing the script, so that sequence does not download it twice.
      if (owned.refs === 0) setTimeout(() => teardown(siteKey, owned), 0);
    },
  };
}
