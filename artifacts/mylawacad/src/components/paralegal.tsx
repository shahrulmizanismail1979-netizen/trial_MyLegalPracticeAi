/**
 * MyLawAcad floating "virtual paralegal" (AI chat + voice).
 *
 * Thin wrapper around the shared @workspace/paralegal-widget so both the
 * examiner and studio dashboards can drop in a single <AcadParalegal /> without
 * duplicating the request/auth wiring.
 *
 * Auth: MyLawAcad is a session-cookie portal (setBaseUrl("/api/acad"), no
 * bearer token getter — see src/lib/api-client + src/main.tsx). So the request
 * wrapper only needs credentials:'include' to send the session cookie; it must
 * NOT be omitted or the shared AI rate limiter would see an unauthenticated
 * request.
 */
import { ParalegalWidget } from "@workspace/paralegal-widget";

const API_BASE = "/api/acad";

const paralegalRequest = (path: string, init?: RequestInit) =>
  fetch(`${API_BASE}${path}`, { ...init, credentials: "include" });

export function AcadParalegal() {
  return (
    <ParalegalWidget
      portalName="MyLawAcad"
      request={paralegalRequest}
      accent="#8a6d2f"
    />
  );
}
