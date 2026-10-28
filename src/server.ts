import { createVerifyRecaptcha } from "./application/verifyRecaptcha";
import { ENV_SECRET_KEY } from "./domain/constants";
import { createGoogleVerifyGateway } from "./infrastructure/googleVerifyGateway";

export { getRecaptchaToken } from "./application/getRecaptchaToken";
export type { VerifyGateway, VerifyRecaptcha } from "./application/verifyRecaptcha";
export { createVerifyRecaptcha } from "./application/verifyRecaptcha";
export { createGoogleVerifyGateway } from "./infrastructure/googleVerifyGateway";
export type * from "./domain/types";

/** Verify a token with Google. Reads `RECAPTCHA_SECRET_KEY` unless `options.secret` is given. */
export const verifyRecaptcha = createVerifyRecaptcha({
  gateway: createGoogleVerifyGateway(),
  getSecret: () => process.env[ENV_SECRET_KEY],
  isProduction: () => process.env.NODE_ENV === "production",
  warn: (message) => console.warn(message),
});

/** True when a secret key is configured. */
export function isRecaptchaEnabled(): boolean {
  return Boolean(process.env[ENV_SECRET_KEY]);
}
