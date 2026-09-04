import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
};

function encryptionKey(): Buffer {
  const secret = process.env.GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("Google OAuth token encryption is not configured");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptGoogleTokens(tokens: GoogleTokens, binding: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(binding));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptGoogleTokens(payload: string, binding: string): GoogleTokens {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted token payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(binding));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8")) as GoogleTokens;
}
