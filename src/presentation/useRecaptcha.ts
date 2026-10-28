import { useCallback, useEffect, useRef, useState } from "react";
// Deep import on purpose: the infrastructure barrel also exports the Google verify
// gateway, which must not end up in the browser bundle.
import { loadRecaptcha } from "../infrastructure/scriptLoader";
import type { Grecaptcha } from "../infrastructure/scriptLoader";
import { readSiteKey } from "./readSiteKey";

export type RecaptchaStatus = "idle" | "loading" | "ready" | "error";

export interface UseRecaptchaOptions {
  /** Action name, checked again on the server. */
  action: string;
  /** Defaults to `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`. */
  siteKey?: string;
  /** Set to false to postpone loading the script. */
  enabled?: boolean;
}

export interface UseRecaptchaResult {
  status: RecaptchaStatus;
  error: Error | null;
  /** Get a fresh token. Waits for the script when it is still loading. */
  execute: () => Promise<string>;
}

interface LoadState {
  key: string;
  status: "ready" | "error";
  error: Error | null;
}

export function useRecaptcha({
  action,
  siteKey: siteKeyOption,
  enabled = true,
}: UseRecaptchaOptions): UseRecaptchaResult {
  const siteKey = siteKeyOption ?? readSiteKey();
  const active = enabled && Boolean(siteKey);
  const [state, setState] = useState<LoadState | null>(null);
  const grecaptchaRef = useRef<Promise<Grecaptcha> | null>(null);

  useEffect(() => {
    if (!active || !siteKey) return;
    const handle = loadRecaptcha(siteKey);
    grecaptchaRef.current = handle.promise;
    let cancelled = false;
    handle.promise.then(
      () => !cancelled && setState({ key: siteKey, status: "ready", error: null }),
      (error: unknown) =>
        !cancelled &&
        setState({
          key: siteKey,
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        }),
    );
    return () => {
      cancelled = true;
      grecaptchaRef.current = null;
      handle.release();
    };
  }, [active, siteKey]);

  const execute = useCallback(async () => {
    const pending = grecaptchaRef.current;
    if (!pending || !siteKey) throw new Error("reCAPTCHA is not enabled or has no site key");
    const grecaptcha = await pending;
    return grecaptcha.execute(siteKey, { action });
  }, [siteKey, action]);

  // Status is derived, so the effect never has to set state just to say "loading".
  const current = state && state.key === siteKey ? state : null;
  const status: RecaptchaStatus = !active ? "idle" : (current?.status ?? "loading");
  return { status, error: current?.error ?? null, execute };
}
