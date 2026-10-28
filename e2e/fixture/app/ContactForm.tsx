"use client";

import { useActionState } from "react";
import { RecaptchaField } from "recaptcha-next/client";
import { submitAction } from "./actions";
import type { SubmitState } from "./actions";

export const initialState: SubmitState = {
  tokenReceived: false,
  success: null,
  reason: null,
  score: null,
  hostname: null,
};

export function ContactForm({ lazy = false }: { lazy?: boolean }) {
  const [state, formAction] = useActionState(submitAction, initialState);
  return (
    <form action={formAction}>
      <input name="message" defaultValue="hello" />
      <RecaptchaField action="contact" lazy={lazy} />
      <button type="submit">Send</button>
      <pre data-testid="result">{JSON.stringify(state)}</pre>
    </form>
  );
}
