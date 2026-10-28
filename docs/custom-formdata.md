---
order: 5
---

# Custom FormData

If you build `FormData` by hand, or send a `fetch` request, the hidden input is not included, because it only travels when the browser submits the `<form>`.

Ask for a fresh token at submit time with `useRecaptcha`, and add it yourself.

```tsx
"use client";

import type { FormEvent } from "react";
import { useRecaptcha } from "recaptcha-next/client";
import { sendMessage } from "./actions";

export function ProgrammaticForm() {
  const { status, execute } = useRecaptcha({ action: "contact" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("message", "hello");
    formData.set("g-recaptcha-response", await execute());
    await sendMessage(formData);
  }

  return (
    <form onSubmit={onSubmit}>
      <button type="submit" disabled={status !== "ready"}>
        Send
      </button>
    </form>
  );
}
```

The server side is the same as for a normal form: `getRecaptchaToken(formData)` reads the `g-recaptcha-response` field. Pass a second argument to `getRecaptchaToken` if you named the field differently.

`execute()` makes a new token each time it is called, so a token is never reused between submits.
