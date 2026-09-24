/** Integrated destinations only. Legacy aliases are exact, never URL prefixes. */
export const PORTAL_DESTINATIONS = [
  { app: "MyLitAI", path: "/mylitai/", legacy: ["https://mylitai.life"], names: ["MyLitAI"] },
  { app: "MyLitAI (Versi 2)", path: "/mylitai-irac/", legacy: ["https://mylitai.life/irac/"], names: ["MyLitAI (Versi 2)"] },
  { app: "MySyalitAI", path: "/mysyariahai/", legacy: ["https://mysyalitai.life"], names: ["MySyalitAI", "MySyariahAI"] },
  { app: "MyCorpAI", path: "/mycorplegalai/", legacy: ["https://mycorpai.life"], names: ["MyCorpAI", "MyCorpLegalAI"] },
  { app: "MyConveyAI", path: "/myconveylitai/", legacy: ["https://myconveyai.life"], names: ["MyConveyAI", "MyConveyLitAI"] },
  { app: "MyCrimAI", path: "/mycrimai/", legacy: ["https://mycrimai.life/"], names: ["MyCrimAI"] },
  { app: "MyCCBLitAI", path: "/myccblitai/", legacy: ["https://myccblitai.life/"], names: ["MyCCBLitAI", "MyCorpCommBankLitAi"] },
  { app: "MyAccidentAI", path: "/myaccidentai/", legacy: ["https://myaccidentai.life/"], names: ["MyAccidentAI", "MyAccidentAi"] },
  { app: "MyLawFirmAi", path: "/mylawfirmai/", legacy: [], names: ["MyLawFirmAi", "MyLawFirmAI"] },
] as const;

export function canonicalPortalRedirect(value: string | null): string | null {
  return PORTAL_DESTINATIONS.find(p => p.path === value || (p.legacy as readonly string[]).includes(value ?? ""))?.path ?? null;
}

export const PORTAL_APP_BY_URL: Record<string, string> = Object.fromEntries(
  PORTAL_DESTINATIONS.flatMap(p => [p.path, ...p.legacy].map(url => [url, p.app])),
);

/** Academic access is bundle-only, not a newly purchasable single portal. */
export function portalLoginPaths(apps: readonly string[]): string[] {
  return [
    ...PORTAL_DESTINATIONS.filter(p => p.names.some(n => apps.includes(n))).map(p => p.path),
    ...(apps.includes("MyLawAcad") ? ["/mylawacad/"] : []),
  ];
}