import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalPortalRedirect, PORTAL_APP_BY_URL, PORTAL_DESTINATIONS, portalLoginPaths } from "@workspace/entitlements";
import { portalLoginHtml, portalLoginLinks } from "./portal-delivery";
import { accessCodeSmsBody } from "./sms";
import { portalRowAccessible } from "./portal-access-check";
import { readFileSync } from "node:fs";

afterEach(() => vi.unstubAllEnvs());

describe("trusted integrated destinations", () => {
  it("preserves the full existing purchase allowlist and historical entitlement names", () => {
    expect(PORTAL_APP_BY_URL).toEqual({
      "https://mylitai.life": "MyLitAI", "/mylitai/": "MyLitAI",
      "https://mylitai.life/irac/": "MyLitAI (Versi 2)", "/mylitai-irac/": "MyLitAI (Versi 2)",
      "https://mysyalitai.life": "MySyalitAI", "/mysyariahai/": "MySyalitAI",
      "https://mycorpai.life": "MyCorpAI", "/mycorplegalai/": "MyCorpAI",
      "https://myconveyai.life": "MyConveyAI", "/myconveylitai/": "MyConveyAI",
      "https://mycrimai.life/": "MyCrimAI", "/mycrimai/": "MyCrimAI",
      "https://myccblitai.life/": "MyCCBLitAI", "/myccblitai/": "MyCCBLitAI",
      "https://myaccidentai.life/": "MyAccidentAI", "/myaccidentai/": "MyAccidentAI",
      "/mylawfirmai/": "MyLawFirmAi",
    });
  });
  for (const portal of PORTAL_DESTINATIONS) {
    it(`preserves metadata and redirects all aliases for ${portal.app}`, () => {
      for (const value of [portal.path, ...portal.legacy]) {
        expect(canonicalPortalRedirect(value)).toBe(portal.path);
        expect(PORTAL_APP_BY_URL[value]).toBe(portal.app);
      }
      for (const name of portal.names) expect(portalLoginPaths([name])).toContain(portal.path);
    });
  }
  it.each([null, "", "https://evil.test", "//evil.test", "/mycrimai/?next=evil", "https://mycrimai.life/evil", "https://mycrimai.life.evil/", "javascript:alert(1)", "https://mycrimai.life@evil.test/"])("rejects unknown URL %s", value => {
    expect(canonicalPortalRedirect(value)).toBeNull();
  });
});

describe("customer delivery links", () => {
  it.each([undefined, "", "   "])("uses the published primary when override is absent or blank (%j), ignoring development domains", configured => {
    vi.stubEnv("LAWYES_PUBLIC_URL", configured);
    vi.stubEnv("REPLIT_DOMAINS", "preview.replit.dev,other.replit.dev");
    expect(portalLoginLinks(["MyCrimAI"])).toEqual(["https://mylegalpracticeai.life/mycrimai/"]);
  });
  it("normalizes a valid explicit override to its HTTPS origin", () => {
    vi.stubEnv("LAWYES_PUBLIC_URL", " https://published.example.test/path?ignored=true#fragment ");
    expect(portalLoginLinks(["MyCrimAI"])).toEqual(["https://published.example.test/mycrimai/"]);
  });
  it.each([
    "http://insecure.test", "ftp://example.test", "javascript:alert(1)",
    "//example.test", "not a url", "https://", "https://user@example.test",
    "https://user:secret@example.test", "https://:secret@example.test",
  ])("rejects invalid, non-HTTPS or credential-bearing overrides (%s)", configured => {
    vi.stubEnv("LAWYES_PUBLIC_URL", configured);
    expect(() => portalLoginLinks(["MyCrimAI"])).toThrow("valid HTTPS public origin without credentials");
  });
  it("wires portal links into provisioning, admin delivery and resend paths", () => {
    const source = readFileSync(new URL("./provisioning.ts", import.meta.url), "utf8");
    const calls = source.match(/accessCodeSmsBody\(\{[\s\S]*?\}\)/g) ?? [];
    expect(calls).toHaveLength(3);
    for (const call of calls) expect(call).toMatch(/\bapps[,:]/);
    expect(source.match(/\$\{loginLinks\}/g)).toHaveLength(2);
    expect(source.match(/html: customerEmailHtml\(/g)).toHaveLength(3);
  });
  it("includes integrated HTTPS links for every portal in both delivery formats", () => {
    vi.stubEnv("LAWYES_PUBLIC_URL", "https://integrated.example.test/");
    const apps = [...PORTAL_DESTINATIONS.map(p => p.app), "MyLawAcad"];
    const links = portalLoginLinks(apps);
    expect(links).toHaveLength(10);
    for (const url of links) {
      expect(portalLoginHtml(apps)).toContain(`href="${url}"`);
      for (const licenses of [undefined, 5]) {
        expect(accessCodeSmsBody({ accessCode: "TEST-ONLY", trial: true, apps, licenses })).toContain(url);
      }
      expect(url).not.toContain("TEST-ONLY");
    }
  });
  it("does not invent access for unknown apps or accept insecure deployment origins", () => {
    expect(portalLoginPaths(["unknown"])).toEqual([]);
    vi.stubEnv("LAWYES_PUBLIC_URL", "http://insecure.test");
    expect(() => portalLoginLinks(["MyCrimAI"])).toThrow("HTTPS");
  });
});

describe("portal provisioning health predicate", () => {
  const now = new Date("2026-01-01");
  it("detects missing, inactive and expired rows", () => {
    for (const row of [undefined, { isActive: false }, { status: "inactive" }, { expiresAt: now }]) {
      expect(portalRowAccessible(row, now)).toBe(false);
    }
  });
  it("accepts active unexpired and legacy unlimited rows", () => {
    expect(portalRowAccessible({ status: "active", expiresAt: new Date("2027-01-01") }, now)).toBe(true);
    expect(portalRowAccessible({ isActive: true, expiresAt: null }, now)).toBe(true);
  });
});