import jwt from "jsonwebtoken";

// Fail closed in production: a predictable JWT signing secret would let
// anyone forge tokens. The dev fallback only exists for local development.
const SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-secret-change-me";
})();
const TOKEN_TTL = "30d";

export function signToken(userId: number): string {
  return jwt.sign({ uid: userId }, SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): number | null {
  try {
    const decoded = jwt.verify(token, SECRET) as { uid?: number };
    return typeof decoded.uid === "number" ? decoded.uid : null;
  } catch {
    return null;
  }
}
