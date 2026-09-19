import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import {
  MANAGER_COOKIE,
  STAFF_COOKIE,
  hasMixedTenantCookies,
  requestFirmWorkspaceId,
  signLegacySession,
  signSession,
  verifySessionIdentity,
} from "./managerSession";

const requestWith = (cookies: Record<string, string>) =>
  ({ cookies }) as unknown as Request;

afterEach(() => vi.useRealTimers());

describe("tenant-bound firm session cookies", () => {
  it("binds non-owner identities to their subscriber workspace", () => {
    expect(verifySessionIdentity(signSession(41, 27, 3))).toEqual({
      userId: 41,
      workspaceId: 27,
      credentialVersion: 3,
    });
  });

  it("maps a legacy manager token only to owner workspace zero", () => {
    expect(verifySessionIdentity(signLegacySession(9))).toEqual({
      userId: 9,
      workspaceId: 0,
      credentialVersion: undefined,
    });
  });

  it("keeps new master sessions in owner workspace zero", () => {
    expect(verifySessionIdentity(signSession(0, 0))?.workspaceId).toBe(0);
  });

  it("rejects expired manager identity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = signSession(4, 2, 1);
    vi.setSystemTime(new Date("2026-01-01T13:00:00Z"));
    expect(verifySessionIdentity(token)).toBeNull();
  });

  it("rejects mixed firm cookies instead of choosing a tenant", () => {
    const req = requestWith({
      [STAFF_COOKIE]: signSession(12, 12),
      [MANAGER_COOKIE]: signSession(90, 13, 1),
    });
    expect(hasMixedTenantCookies(req)).toBe(true);
    expect(requestFirmWorkspaceId(req)).toBeNull();
  });
});