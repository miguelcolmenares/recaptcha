import { evaluateResponse } from "../domain/evaluateResponse";

const good = { success: true, score: 0.9, action: "login", hostname: "example.com" };

describe("evaluateResponse", () => {
  it("accepts a good response", () => {
    expect(evaluateResponse(good)).toEqual({
      success: true,
      skipped: false,
      score: 0.9,
      action: "login",
      hostname: "example.com",
    });
  });

  it("returns Google error codes when Google rejects the token", () => {
    const result = evaluateResponse({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(result).toEqual({
      success: false,
      reason: "rejected-by-google",
      errorCodes: ["timeout-or-duplicate"],
    });
  });

  it("rejects a score below the default threshold of 0.5", () => {
    expect(evaluateResponse({ ...good, score: 0.4 })).toMatchObject({
      success: false,
      reason: "low-score",
      score: 0.4,
    });
  });

  it("accepts a score equal to the threshold", () => {
    expect(evaluateResponse({ ...good, score: 0.5 }).success).toBe(true);
  });

  it("uses a custom threshold", () => {
    expect(evaluateResponse(good, { minScore: 0.95 })).toMatchObject({ reason: "low-score" });
  });

  it("rejects a token made for another action", () => {
    expect(evaluateResponse(good, { expectedAction: "signup" })).toMatchObject({
      success: false,
      reason: "action-mismatch",
    });
  });

  it("rejects a token from another hostname, only when a hostname is expected", () => {
    expect(evaluateResponse(good, { expectedHostname: "other.com" })).toMatchObject({
      reason: "hostname-mismatch",
    });
    expect(evaluateResponse(good, { expectedHostname: "example.com" }).success).toBe(true);
  });

  it("treats a missing score as 0", () => {
    expect(evaluateResponse({ success: true })).toMatchObject({ reason: "low-score", score: 0 });
  });
});
