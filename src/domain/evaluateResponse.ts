import { DEFAULT_MIN_SCORE } from "./constants";
import type { RecaptchaVerifyResponse, VerificationResult, VerificationRules } from "./types";

/**
 * Pure rule: decide if a Google response is good enough.
 * Order matters: Google rejection first, then action, hostname and score.
 */
export function evaluateResponse(
  response: RecaptchaVerifyResponse,
  rules: VerificationRules = {},
): VerificationResult {
  if (!response.success) {
    return { success: false, reason: "rejected-by-google", errorCodes: response["error-codes"] };
  }

  const score = response.score ?? 0;
  const action = response.action ?? "";
  const hostname = response.hostname ?? "";

  if (rules.expectedAction !== undefined && action !== rules.expectedAction) {
    return { success: false, reason: "action-mismatch", score };
  }
  if (rules.expectedHostname !== undefined && hostname !== rules.expectedHostname) {
    return { success: false, reason: "hostname-mismatch", score };
  }
  if (score < (rules.minScore ?? DEFAULT_MIN_SCORE)) {
    return { success: false, reason: "low-score", score };
  }

  return { success: true, skipped: false, score, action, hostname };
}
