"use client";

import { useActionState } from "react";
import { RecaptchaField } from "@miguelcolmenares/recaptcha/client";
import { submitAction } from "./actions";
import type { SubmitState } from "./actions";

const initial: SubmitState = { tokenReceived: false, success: null, reason: null };

export function ContactForm({ lazy = false }: { lazy?: boolean }) {
  const [state, formAction] = useActionState(submitAction, initial);
  return (
    <form action={formAction}>
      <input name="message" defaultValue="hello" />
      <RecaptchaField action="contact" lazy={lazy} />
      <button type="submit">Send</button>
      <pre data-testid="result">{JSON.stringify(state)}</pre>
    </form>
  );
}
