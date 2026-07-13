import { db, crimAccessCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars[bytes[i] % chars.length];
    if (i === 3 || i === 7) code += "-";
  }
  return code;
}

export function isSessionStale(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return true;
  return Date.now() - new Date(lastSeenAt).getTime() > SESSION_IDLE_TIMEOUT_MS;
}

export async function findActiveCode(code: string) {
  const [row] = await db
    .select()
    .from(crimAccessCodesTable)
    .where(eq(crimAccessCodesTable.code, code));
  return row ?? null;
}

export async function claimCode(codeId: number, sessionId: string) {
  await db
    .update(crimAccessCodesTable)
    .set({
      currentSessionId: sessionId,
      sessionStartedAt: new Date(),
      lastSeenAt: new Date(),
    })
    .where(eq(crimAccessCodesTable.id, codeId));
}

export async function releaseCode(codeId: number) {
  await db
    .update(crimAccessCodesTable)
    .set({
      currentSessionId: null,
      sessionStartedAt: null,
      lastSeenAt: null,
    })
    .where(eq(crimAccessCodesTable.id, codeId));
}

export async function touchCode(codeId: number) {
  await db
    .update(crimAccessCodesTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(crimAccessCodesTable.id, codeId));
}
