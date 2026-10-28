/** Google endpoint that validates a token on the server. */
export const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/** Google script that exposes `window.grecaptcha`. The site key goes in the `render` query param. */
export const RECAPTCHA_SCRIPT_URL = "https://www.google.com/recaptcha/api.js";

/** Name of the hidden form field that carries the token. */
export const RECAPTCHA_TOKEN_FIELD = "g-recaptcha-response";

/** A score below this value is treated as a bot. Google suggests 0.5 as the default. */
export const DEFAULT_MIN_SCORE = 0.5;

/** Google tokens expire after two minutes. */
export const TOKEN_TTL_MS = 120_000;

/** Refresh a token this long before it expires. */
export const TOKEN_REFRESH_MARGIN_MS = 30_000;

export const ENV_SITE_KEY = "NEXT_PUBLIC_RECAPTCHA_SITE_KEY";
export const ENV_SECRET_KEY = "RECAPTCHA_SECRET_KEY";
