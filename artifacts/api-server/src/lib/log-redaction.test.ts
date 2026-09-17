import { describe, expect, it } from "vitest";
import pino from "pino";
import { logRedactionPaths } from "./log-redaction";

describe("authentication log redaction", () => {
  it("preserves diagnostic context without exposing access credentials", () => {
    let output = "";
    const logger = pino({ redact: [...logRedactionPaths] }, {
      write(chunk: string) { output += chunk; },
    });
    logger.info({
      accessCode: "fixture-private-code",
      user: { access_code: "fixture-nested-code" },
      req: {
        headers: { authorization: "fixture-bearer", cookie: "fixture-cookie" },
        body: { password: "fixture-password", legalFacts: "fixture-confidential" },
      },
      portal: "lit",
      operation: "sync",
    }, "Provisioning completed");
    for (const value of [
      "fixture-private-code", "fixture-nested-code", "fixture-bearer",
      "fixture-cookie", "fixture-password", "fixture-confidential",
    ]) expect(output).not.toContain(value);
    expect(JSON.parse(output)).toMatchObject({
      portal: "lit", operation: "sync", accessCode: "[Redacted]",
    });
  });
});