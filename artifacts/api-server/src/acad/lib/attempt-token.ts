import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  return process.env["SESSION_SECRET"] ?? "dev-secret-change-me";
}

export function generateAttemptToken(attemptId: string): string {
  return createHmac("sha256", getSecret()).update(attemptId).digest("hex");
}

export function verifyAttemptToken(attemptId: string, token: string): boolean {
  const expected = generateAttemptToken(attemptId);
  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const candidateBuf = Buffer.from(token, "hex");
    if (expectedBuf.length !== candidateBuf.length) return false;
    return timingSafeEqual(expectedBuf, candidateBuf);
  } catch {
    return false;
  }
}
