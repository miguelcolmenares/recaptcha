"use server";

import { getRecaptchaToken, verifyRecaptcha } from "@miguelcolmenares/recaptcha/server";

export interface SubmitState {
  tokenReceived: boolean;
  success: boolean | null;
  reason: string | null;
  score: number | null;
  hostname: string | null;
}

// minScore is 0 on purpose: headless Chrome gets low scores from Google, and these tests
// check the whole chain (browser, Server Action, Google), not Google's opinion of the visitor.
// Score rules are covered by unit tests.
export async function submitAction(
  _previous: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const token = getRecaptchaToken(formData);
  const result = await verifyRecaptcha(token, {
    expectedAction: "contact",
    expectedHostname: "localhost",
    minScore: 0,
  });
  return {
    tokenReceived: token !== null,
    success: result.success,
    reason: result.success ? null : result.reason,
    score: result.success && !result.skipped ? result.score : null,
    hostname: result.success && !result.skipped ? result.hostname : null,
  };
}
