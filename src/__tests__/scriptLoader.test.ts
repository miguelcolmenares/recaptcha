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

afterEach(async () => {
  jest.useRealTimers();
  await new Promise((resolve) => setTimeout(resolve, 0)); // let pending teardowns run
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  delete window.grecaptcha;
});

describe("loadRecaptcha", () => {
  it("adds one script per site key, shared by concurrent callers", () => {
    const a = loadRecaptcha("key-1");
    const b = loadRecaptcha("key-1");
    expect(scripts()).toHaveLength(1);
    expect(a.promise).toBe(b.promise);
    expect(scripts()[0]?.getAttribute("src")).toBe(
      "https://www.google.com/recaptcha/api.js?render=key-1",
    );
    a.release();
    b.release();
  });

  it("does not resolve on the load event alone, it waits for grecaptcha.ready", async () => {
    const fake = fakeGrecaptcha();
    const handle = loadRecaptcha("key-ready");
    const onResolve = jest.fn();
    void handle.promise.then(onResolve);

    finishLoad(fake);
    await Promise.resolve();
    expect(onResolve).not.toHaveBeenCalled();

    fake.fireReady();
    await handle.promise;
    expect(onResolve).toHaveBeenCalledWith(fake.api);
    handle.release();
  });

  it("rejects every waiting caller when the script fails, then allows a retry", async () => {
    const a = loadRecaptcha("key-fail");
    const b = loadRecaptcha("key-fail");
    const results = Promise.allSettled([a.promise, b.promise]);

    scripts()[0]?.dispatchEvent(new Event("error"));
    const settled = await results;

    expect(settled.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect((settled[0] as PromiseRejectedResult).reason.message).toBe(
      "Failed to load reCAPTCHA script",
    );
    expect(scripts()).toHaveLength(0);

    const retry = loadRecaptcha("key-fail");
    expect(scripts()).toHaveLength(1);
    expect(retry.promise).not.toBe(a.promise);
    retry.release();
  });

  it("rejects when the script loads but grecaptcha is missing", async () => {
    const handle = loadRecaptcha("key-empty");
    scripts()[0]?.dispatchEvent(new Event("load"));
    await expect(handle.promise).rejects.toThrow("Failed to load reCAPTCHA script");
  });

  it("removes the script only after the last handle is released", async () => {
    jest.useFakeTimers();
    const fake = fakeGrecaptcha();
    const a = loadRecaptcha("key-refs");
    const b = loadRecaptcha("key-refs");
    finishLoad(fake);
    fake.fireReady();

    a.release();
    jest.runAllTimers();
    expect(scripts()).toHaveLength(1);

    b.release();
    b.release(); // releasing twice must not count twice
    jest.runAllTimers();
    expect(scripts()).toHaveLength(0);
    expect(window.grecaptcha).toBeUndefined();
  });

  it("keeps the script when a new handle arrives right after the last release", () => {
    jest.useFakeTimers();
    const first = loadRecaptcha("key-strict");
    first.release();
    const second = loadRecaptcha("key-strict"); // Strict Mode style remount
    jest.runAllTimers();
    expect(scripts()).toHaveLength(1);
    second.release();
    jest.runAllTimers(); // leave no pending teardown behind for the next test
  });

  it("uses a grecaptcha that is already on the page and adds no script", async () => {
    const fake = fakeGrecaptcha();
    window.grecaptcha = fake.api;
    const handle = loadRecaptcha("key-existing");
    fake.fireReady();
    expect(await handle.promise).toBe(fake.api);
    expect(scripts()).toHaveLength(0);
    handle.release();
  });
});

describe("loadRecaptcha with two site keys", () => {
  it("keeps window.grecaptcha while another key still owns a script", () => {
    jest.useFakeTimers();
    const a = loadRecaptcha("multi-a");
    const b = loadRecaptcha("multi-b");
    const fake = fakeGrecaptcha();
    window.grecaptcha = fake.api;

    a.release();
    jest.runAllTimers();

    expect(window.grecaptcha).toBe(fake.api);
    b.release();
    jest.runAllTimers();
    expect(window.grecaptcha).toBeUndefined();
  });
});
