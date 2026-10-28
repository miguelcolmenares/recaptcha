---
order: 8
---

# Server API

Everything in `recaptcha-next/server`, plus the pure rule exported by the root entry. None of it ships to the browser.

## `verifyRecaptcha(token, options?)`

Checks a token with Google and returns a result. It does not throw.

| Option             | Default                | Description                                    |
| ------------------ | ---------------------- | ---------------------------------------------- |
| `minScore`         | `0.5`                  | Scores below this are refused.                 |
| `expectedAction`   |                        | The action the token must have been made for   |
| `expectedHostname` |                        | The hostname the token must have been made for |
| `secret`           | `RECAPTCHA_SECRET_KEY` | The secret key, if you do not use the env var  |
| `remoteIp`         |                        | The visitor's IP, passed on to Google          |

## The result

```ts
{ success: true, skipped: false, score, action, hostname }
{ success: true, skipped: true, reason: "missing-secret-in-development" }
{ success: false, reason, score?, errorCodes? }
```

Failure reasons:

| Reason               | Meaning                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `missing-secret`     | No secret key in production.                                         |
| `missing-token`      | The form data had no token.                                          |
| `request-failed`     | The request to Google failed.                                        |
| `rejected-by-google` | Google said the token is not valid. `errorCodes` has the details.    |
| `action-mismatch`    | The token was made for a different action than `expectedAction`.     |
| `hostname-mismatch`  | The token was made for a different hostname than `expectedHostname`. |
| `low-score`          | The score is below `minScore`.                                       |

## Other functions

- `getRecaptchaToken(formData, field?)` returns the token or `null`, also when the field is empty.
- `isRecaptchaEnabled()` is `true` when `RECAPTCHA_SECRET_KEY` is set.
- `createVerifyRecaptcha(deps)` and `createGoogleVerifyGateway(options)` build a custom verifier. See [Testing](testing.md).

## Root entry

`recaptcha-next` exports the constants, the result types and the pure `evaluateResponse` rule. It has no React and no browser code, so it is safe in Server Components.
