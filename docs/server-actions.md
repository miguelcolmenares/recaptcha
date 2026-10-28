---
order: 2
---

# Server Actions

The token travels in the form data, so a Server Action can verify it without any extra request from the browser.

## The flow

1. `RecaptchaField` loads Google's script and writes a token into a hidden input.
2. The form is submitted to a Server Action, and the input is part of the `FormData`.
3. The action reads the token with `getRecaptchaToken` and checks it with `verifyRecaptcha`.

## A form with state

This is the pattern the package itself is tested with, using `useActionState` to show the result.

```tsx
// app/ContactForm.tsx
"use client";

import { useActionState } from "react";
import { RecaptchaField } from "recaptcha-next/client";
import { submitAction } from "./actions";

export function ContactForm() {
  const [state, formAction] = useActionState(submitAction, { success: null, reason: null });
  return (
    <form action={formAction}>
      <input name="message" />
      <RecaptchaField action="contact" />
      <button type="submit">Send</button>
      {state.success === false && <p role="alert">Could not verify you: {state.reason}</p>}
    </form>
  );
}
```

```ts
// app/actions.ts
"use server";

import { getRecaptchaToken, verifyRecaptcha } from "recaptcha-next/server";

export async function submitAction(_previous: unknown, formData: FormData) {
  const result = await verifyRecaptcha(getRecaptchaToken(formData), {
    expectedAction: "contact",
    expectedHostname: "example.com",
  });
  return { success: result.success, reason: result.success ? null : result.reason };
}
```

## Check the action and the hostname

Google returns the action and the hostname the token was made for. Pass `expectedAction` and `expectedHostname` so a token made for another form or another site is refused, with `action-mismatch` or `hostname-mismatch`.

## Scores

Google scores each visit from 0 to 1. `verifyRecaptcha` rejects a score below `minScore`, which is `0.5` by default, with `low-score`. Raise it for sensitive forms and lower it if real visitors are refused. Decide on what you see in your own traffic.

## When the secret is missing

In production a missing `RECAPTCHA_SECRET_KEY` fails with `missing-secret`, so a misconfigured deploy refuses everyone instead of letting everyone in. Outside production the check is skipped with a warning in the logs, so local work does not need keys.
