"use server";

import { getRecaptchaToken, verifyRecaptcha } from "@miguelcolmenares/recaptcha/server";

export interface SubmitState {
  tokenReceived: boolean;
  success: boolean | null;
  reason: string | null;
}

export async function submitAction(
  _previous: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const token = getRecaptchaToken(formData);
  const result = await verifyRecaptcha(token, { expectedAction: "contact" });
  return {
    tokenReceived: token !== null,
    success: result.success,
    reason: result.success ? null : result.reason,
  };
}
