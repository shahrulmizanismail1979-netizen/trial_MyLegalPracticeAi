const LEGACY_MYCRIM_URL = "https://mycrimai.life/";
const INTEGRATED_MYCRIM_PATH = "/mycrimai/";

/**
 * Existing Stripe sessions can still return the legacy MyCrimAI appUrl.
 * Keep accepting that exact trusted value, but always open the integrated app.
 */
export function canonicalPortalRedirect(redirect: string | null): string | null {
  return redirect === LEGACY_MYCRIM_URL ? INTEGRATED_MYCRIM_PATH : redirect;
}