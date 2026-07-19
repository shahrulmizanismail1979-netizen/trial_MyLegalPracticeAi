import crypto from "node:crypto";

/**
 * The owner's master access code (MASTER_ACCESS_CODE) unlocks manager mode in
 * MyLawFirmAi, consistent with every other portal. Fails closed when unset.
 */
export function isMasterCode(candidate: string): boolean {
  const secret = process.env.MASTER_ACCESS_CODE;
  if (!secret || !candidate) return false;
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}
