/** @jest-environment jsdom */
import { loadRecaptcha } from "../infrastructure/scriptLoader";
import type { Grecaptcha } from "../infrastructure/scriptLoader";

const scripts = () => document.head.querySelectorAll('script[src*="recaptcha/api.js"]');

function fakeGrecaptcha(): { api: Grecaptcha; fireReady: () => void } {
  const waiting: Array<() => void> = [];
  return {
    api: { ready: (cb) => void waiting.push(cb), execute: jest.fn().mockResolvedValue("tok") },
    fireReady: () => waiting.splice(0).forEach((cb) => cb()),
  };
}

function finishLoad(fake: ReturnType<typeof fakeGrecaptcha>) {
  window.grecaptcha = fake.api;
  scripts()[0]?.dispatchEvent(new Event("load"));
}

// The loader keeps one promise per site key for the life of the page, so every test
// uses a key of its own.
let counter = 0;
let key = "";

beforeEach(() => {
  key = `key-${++counter}`;
});

afterEach(() => {
  document.head.innerHTML = "";
  delete window.grecaptcha;
});

describe("loadRecaptcha", () => {
  it("adds one script per site key, shared by concurrent callers", () => {
    const a = loadRecaptcha(key);
    const b = loadRecaptcha(key);
    expect(scripts()).toHaveLength(1);
    expect(a).toBe(b);
    expect(scripts()[0]?.getAttribute("src")).toBe(
      `https://www.google.com/recaptcha/api.js?render=${key}`,
    );
  });

  it("does not resolve on the load event alone, it waits for grecaptcha.ready", async () => {
    const fake = fakeGrecaptcha();
    const promise = loadRecaptcha(key);
    const onResolve = jest.fn();
    void promise.then(onResolve);

    finishLoad(fake);
    await Promise.resolve();
    expect(onResolve).not.toHaveBeenCalled();

    fake.fireReady();
    await promise;
    expect(onResolve).toHaveBeenCalledWith(fake.api);
  });

  it("rejects every waiting caller when the script fails, then allows a retry", async () => {
    const a = loadRecaptcha(key);
    const b = loadRecaptcha(key);
    const results = Promise.allSettled([a, b]);

    scripts()[0]?.dispatchEvent(new Event("error"));
    const settled = await results;

    expect(settled.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect((settled[0] as PromiseRejectedResult).reason.message).toBe(
      "Failed to load reCAPTCHA script",
    );
    expect(scripts()).toHaveLength(0);

    const retry = loadRecaptcha(key);
    expect(scripts()).toHaveLength(1);
    expect(retry).not.toBe(a);
  });

  it("rejects when the script loads but grecaptcha is missing, then allows a retry", async () => {
    const promise = loadRecaptcha(key);
    scripts()[0]?.dispatchEvent(new Event("load"));
    await expect(promise).rejects.toThrow("Failed to load reCAPTCHA script");
    await Promise.resolve();
    expect(loadRecaptcha(key)).not.toBe(promise);
  });

  it("keeps the script and the promise for the life of the page", async () => {
    const fake = fakeGrecaptcha();
    const first = loadRecaptcha(key);
    finishLoad(fake);
    fake.fireReady();
    await first;

    // A later caller, for example a form that mounts after a client-side navigation.
    const second = loadRecaptcha(key);
    expect(second).toBe(first);
    expect(scripts()).toHaveLength(1);
    expect(window.grecaptcha).toBe(fake.api);
  });

  it("uses a grecaptcha that is already on the page and adds no script", async () => {
    const fake = fakeGrecaptcha();
    window.grecaptcha = fake.api;
    const promise = loadRecaptcha(key);
    fake.fireReady();
    expect(await promise).toBe(fake.api);
    expect(scripts()).toHaveLength(0);
  });

  it("keeps a separate load for each site key", () => {
    loadRecaptcha(`${key}-a`);
    loadRecaptcha(`${key}-b`);
    expect(scripts()).toHaveLength(2);
  });
});
