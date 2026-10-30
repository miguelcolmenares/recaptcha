# recaptcha-next

Google reCAPTCHA v3 for React and Next.js. A client field that keeps a fresh token in a hidden input,
and a server function that checks the token with Google.

- Server Actions friendly: read the token from `FormData`, verify it, get a typed result.
- One shared script per site key, loaded once and kept for the life of the page, also across client-side navigation.
- Lazy loading: the Google script can wait until the form is near the viewport.
- Fails closed in production when the secret key is missing.
- ESM and CommonJS, full types, MIT license.

Documentation: <https://miguelcolmenares.com/recaptcha-next/>

## Install

```bash
npm install recaptcha-next
```

Requires React 19 and Node 22 or newer. Create a reCAPTCHA **v3** key pair in the
[admin console](https://www.google.com/recaptcha/admin) and add your domains (and `localhost` for development).

```bash
# .env.local
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-site-key
RECAPTCHA_SECRET_KEY=your-secret-key
```

## Use

Add the field to a form. It renders a hidden input named `g-recaptcha-response`.

```tsx
// app/ContactForm.tsx
"use client";

import { RecaptchaField } from "recaptcha-next/client";
import { sendMessage } from "./actions";

export function ContactForm() {
  return (
    <form action={sendMessage}>
      <input name="message" />
      <RecaptchaField action="contact" />
      <button type="submit">Send</button>
    </form>
  );
}
```

Verify the token in the Server Action, with the same `action` name.

```ts
// app/actions.ts
"use server";

import { getRecaptchaToken, verifyRecaptcha } from "recaptcha-next/server";

export async function sendMessage(formData: FormData) {
  const result = await verifyRecaptcha(getRecaptchaToken(formData), { expectedAction: "contact" });
  if (!result.success) {
    return { error: result.reason }; // "low-score", "action-mismatch", "missing-token", ...
  }
  // ...handle the message
}
```

## API

### `recaptcha-next/client`

`<RecaptchaField />` props:

| Prop                | Default                          | Description                                                     |
| ------------------- | -------------------------------- | --------------------------------------------------------------- |
| `action`            | required                         | Action name. Check the same name on the server.                 |
| `siteKey`           | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Public site key. Without a key the field renders nothing.       |
| `name`              | `g-recaptcha-response`           | Name of the hidden input.                                       |
| `lazy`              | `false`                          | Load Google's script only when the form is near the viewport.   |
| `lazyRootMargin`    | `200px`                          | How early lazy loading starts.                                  |
| `refreshIntervalMs` | `90000`                          | Time between token refreshes. Google tokens last two minutes.   |
| `onTokenGenerated`  |                                  | Called with each new token. Inline functions are safe.          |
| `onError`           |                                  | Called when the script fails to load or a token cannot be made. |

`useRecaptcha({ action, siteKey?, enabled? })` returns `{ status, error, execute }`.
Use it to get a fresh token at submit time instead of keeping a hidden input.

### `recaptcha-next/server`

- `verifyRecaptcha(token, options?)` returns a `VerificationResult`, it does not throw.
  Options: `minScore` (default `0.5`), `expectedAction`, `expectedHostname`, `secret`, `remoteIp`.
- `getRecaptchaToken(formData, field?)` returns the token or `null`.
- `isRecaptchaEnabled()` is `true` when `RECAPTCHA_SECRET_KEY` is set.
- `createVerifyRecaptcha(deps)` and `createGoogleVerifyGateway(options)` build a custom verifier, for tests or other runtimes.

The result is one of:

```ts
{ success: true, skipped: false, score, action, hostname }
{ success: true, skipped: true, reason: "missing-secret-in-development" }
{ success: false, reason, score?, errorCodes? }
```

Failure reasons: `missing-secret`, `missing-token`, `request-failed`, `rejected-by-google`,
`low-score`, `action-mismatch`, `hostname-mismatch`.

**Missing secret.** In production a missing `RECAPTCHA_SECRET_KEY` fails with `missing-secret`.
Outside production verification is skipped, with a clear warning in the logs, so local work does not need keys.

### Root entry

`recaptcha-next` exports the constants, the result types and the pure `evaluateResponse` rule.
It has no React and no browser code, so it is safe in Server Components.

## Script lifetime

The Google script is loaded the first time a field needs it and is **not** removed when the field unmounts.
Google keeps its own state (the badge, iframes and extra scripts), and removing the tag does not reset it.
Loading it again after a client-side navigation left duplicate badges, so it is loaded once per page.
The badge therefore stays visible on pages that have no form after the first visit to one that does.
If you want the badge hidden, follow Google's rules for showing the reCAPTCHA branding text instead.

## Custom `FormData`

If you build `FormData` by hand instead of passing the `<form>`, the hidden input is not included.
Read the token with `useRecaptcha().execute()` and append it yourself:

```ts
formData.set("g-recaptcha-response", await execute());
```

## Development

```bash
cp .env.example .env.local   # add a real v3 key pair, with "localhost" in its domains
npm test                     # unit and integration tests
npm run test:e2e             # packs the package, builds a Next.js app with it, runs Playwright
```

Tests that need a real key skip themselves when the keys are not set. In CI the keys come from the
repository secrets `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY`. Fork and Dependabot pull requests have no secrets,
so those tests skip there and everything else still runs.

## License

[MIT](LICENSE)
