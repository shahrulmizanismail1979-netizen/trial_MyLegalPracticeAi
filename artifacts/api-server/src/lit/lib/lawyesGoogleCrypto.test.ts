import { afterEach, describe, expect, it } from "vitest";
import { decryptGoogleTokens, encryptGoogleTokens } from "./lawyesGoogleCrypto";

const previousKey = process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY;
  else process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY = previousKey;
});

describe("LAWYes Google token encryption", () => {
  it("round-trips tokens only for their tenant, lawyer, and Google subject binding", () => {
    process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY = "test-only-key-with-at-least-thirty-two-characters";
    const binding = "lawyes:12:lawyer-seat:google-subject";
    const encrypted = encryptGoogleTokens({
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      expiresAt: 123456,
      tokenType: "Bearer",
    }, binding);

    expect(encrypted).not.toContain("access-secret");
    expect(encrypted).not.toContain("refresh-secret");
    expect(decryptGoogleTokens(encrypted, binding)).toEqual({
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      expiresAt: 123456,
      tokenType: "Bearer",
    });
    expect(() => decryptGoogleTokens(encrypted, "lawyes:99:other:subject")).toThrow();
  });

  it("fails closed when the encryption key is not configured", () => {
    delete process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptGoogleTokens({
      accessToken: "a",
      refreshToken: "b",
      expiresAt: 1,
      tokenType: "Bearer",
    }, "binding")).toThrow("not configured");
  });
});