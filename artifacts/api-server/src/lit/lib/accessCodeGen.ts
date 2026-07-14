import { db } from "@workspace/db";
import { litAccessCodes } from "@workspace/db";
import { eq } from "drizzle-orm";

/** Generates a human-friendly access code, e.g. MLT-AB12-CD34. */
export function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `MLT-${segment(4)}-${segment(4)}`;
}

/** Generates an access code guaranteed not to collide with an existing one. */
export async function generateUniqueAccessCode(): Promise<string> {
  for (let attempts = 0; attempts < 25; attempts++) {
    const code = generateAccessCode();
    const [existing] = await db
      .select({ id: litAccessCodes.id })
      .from(litAccessCodes)
      .where(eq(litAccessCodes.code, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique access code");
}
