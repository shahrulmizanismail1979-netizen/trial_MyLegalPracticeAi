import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAdminCredential,
  isAdminCredentialConfigured,
  isAdminPassword,
  isMasterAccessCode,
} from "./masterAccess";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("master access and password-admin credentials", () => {
  it("accepts the configured master code and rejects wrong or non-string candidates", () => {
    vi.stubEnv("MASTER_ACCESS_CODE", "dummy-master-access-code");

    expect(isMasterAccessCode("dummy-master-access-code")).toBe(true);
    expect(isMasterAccessCode("wrong-master-access-code")).toBe(false);
    expect(isMasterAccessCode(undefined)).toBe(false);
    expect(isMasterAccessCode({ value: "dummy-master-access-code" })).toBe(false);
  });

  it("fails closed when the master code is unset or blank", () => {
    vi.stubEnv("MASTER_ACCESS_CODE", undefined);
    expect(isMasterAccessCode("dummy-master-access-code")).toBe(false);

    vi.stubEnv("MASTER_ACCESS_CODE", "   ");
    expect(isMasterAccessCode("dummy-master-access-code")).toBe(false);
  });

  it("reads the master code from the environment on every call", () => {
    vi.stubEnv("MASTER_ACCESS_CODE", "dummy-first-master-code");
    expect(isMasterAccessCode("dummy-first-master-code")).toBe(true);

    vi.stubEnv("MASTER_ACCESS_CODE", "dummy-second-master-code");
    expect(isMasterAccessCode("dummy-first-master-code")).toBe(false);
    expect(isMasterAccessCode("dummy-second-master-code")).toBe(true);
  });

  it("retains ADMIN_PASSWORD support while accepting the master code", () => {
    vi.stubEnv("ADMIN_PASSWORD", "dummy-admin-password");
    vi.stubEnv("MASTER_ACCESS_CODE", "dummy-master-access-code");

    expect(isAdminPassword("dummy-admin-password")).toBe(true);
    expect(isAdminCredential("dummy-admin-password")).toBe(true);
    expect(isAdminCredential("dummy-master-access-code")).toBe(true);
    expect(isAdminCredential("wrong-credential")).toBe(false);
    expect(isAdminCredentialConfigured()).toBe(true);
  });

  it("fails closed for password-admin credentials when both secrets are blank", () => {
    vi.stubEnv("ADMIN_PASSWORD", " ");
    vi.stubEnv("MASTER_ACCESS_CODE", "");

    expect(isAdminPassword(" ")).toBe(false);
    expect(isAdminCredential("dummy-master-access-code")).toBe(false);
    expect(isAdminCredentialConfigured()).toBe(false);
  });
});