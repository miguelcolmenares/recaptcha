import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createVerifyRecaptcha } from "../../application/verifyRecaptcha";
import { createGoogleVerifyGateway } from "../../infrastructure/googleVerifyGateway";

// Real use case + real gateway + real HTTP, against a local stand-in for Google.
let server: Server;
let url: string;
let lastBody = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      lastBody = raw;
      const params = new URLSearchParams(raw);
      res.setHeader("Content-Type", "application/json");
      if (params.get("response") === "boom") {
        res.statusCode = 500;
        res.end("{}");
        return;
      }
      const good = params.get("response") === "good-token";
      res.end(
        JSON.stringify(
          good
            ? { success: true, score: 0.9, action: "login", hostname: "localhost" }
            : { success: false, "error-codes": ["invalid-input-response"] },
        ),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/siteverify`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function verifier() {
  return createVerifyRecaptcha({
    gateway: createGoogleVerifyGateway({ url }),
    getSecret: () => "integration-secret",
    isProduction: () => true,
    warn: () => undefined,
  });
}

describe("verify flow over HTTP", () => {
  it("accepts a good token and sends a form-encoded body", async () => {
    const result = await verifier()("good-token", { expectedAction: "login" });
    expect(result).toMatchObject({ success: true, skipped: false, score: 0.9 });
    expect(new URLSearchParams(lastBody).get("secret")).toBe("integration-secret");
  });

  it("surfaces Google error codes for a bad token", async () => {
    expect(await verifier()("bad-token")).toEqual({
      success: false,
      reason: "rejected-by-google",
      errorCodes: ["invalid-input-response"],
    });
  });

  it("reports request-failed when the endpoint errors", async () => {
    expect(await verifier()("boom")).toEqual({ success: false, reason: "request-failed" });
  });
});
