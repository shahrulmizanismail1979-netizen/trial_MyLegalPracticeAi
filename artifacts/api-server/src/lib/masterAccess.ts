import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Compare an untrusted candidate with a configured secret without exposing
 * either value to callers. Hashing first keeps the buffers a fixed length for
 * timingSafeEqual, while the per-call environment lookup allows secret
 * rotation and keeps unset/blank configuration fail closed.
 */
function matchesConfiguredSecret(candidate: unknown, configured: string | undefined): boolean {
  if (typeof candidate !== "string") return false;

  const secret = configured?.trim() ?? "";
  if (!secret) return false;

  const candidateDigest = createHash("sha256").update(candidate).digest();
  const secretDigest = createHash("sha256").update(secret).digest();
  return timingSafeEqual(candidateDigest, secretDigest);
}

/** Check the owner-controlled MASTER_ACCESS_CODE on every invocation. */
export function isMasterAccessCode(candidate: unknown): boolean {
  return matchesConfiguredSecret(candidate, process.env.MASTER_ACCESS_CODE);
}

/** Report whether a non-blank MASTER_ACCESS_CODE is configured. */
export function isMasterAccessCodeConfigured(): boolean {
  return Boolean(process.env.MASTER_ACCESS_CODE?.trim());
}

/**
 * Opaque, non-reversible identity for the currently configured owner code.
 * Token/session issuers can bind a credential-derived session to the current
 * configuration without ever embedding the credential itself.
 */
export function getMasterAccessFingerprint(): string | null {
  const secret = process.env.MASTER_ACCESS_CODE?.trim() ?? "";
  const key =
    process.env.MASTER_ACCESS_FINGERPRINT_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "dev-secret-change-me");
  if (!secret || !key) return null;
  return createHmac("sha256", key)
    .update(`master-access-fingerprint:${secret}`)
    .digest("hex");
}

/** Check the legacy ADMIN_PASSWORD on every invocation. */
export function isAdminPassword(candidate: unknown): boolean {
  return matchesConfiguredSecret(candidate, process.env.ADMIN_PASSWORD);
}

/**
 * Password-admin surfaces accept either the legacy administrator password or
 * the owner-controlled master access code. Both checks remain fail closed.
 */
export function isAdminCredential(candidate: unknown): boolean {
  return isAdminPassword(candidate) || isMasterAccessCode(candidate);
}

/** Whether at least one password-admin credential is configured. */
export function isAdminCredentialConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_PASSWORD?.trim() || process.env.MASTER_ACCESS_CODE?.trim(),
  );
}