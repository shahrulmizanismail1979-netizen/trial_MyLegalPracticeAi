import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
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
