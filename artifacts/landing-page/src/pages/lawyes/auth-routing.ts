/**
 * Accept only same-origin LAWYes workspace destinations after practitioner
 * access-code authentication. This keeps returnTo useful for direct matter
 * links without creating an open redirect.
 */
export function validatedLawyesReturnTo(
  value: string | null | undefined,
  origin = "https://lawyes.local",
): string {
  if (!value) return "/lawyes";

  try {
    const target = new URL(value, origin);
    const expectedOrigin = new URL(origin).origin;
    if (target.origin !== expectedOrigin || !isLawyesWorkspacePath(target.pathname)) {
      return "/lawyes";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/lawyes";
  }
}

function isLawyesWorkspacePath(pathname: string) {
  return (
    pathname === "/lawyes" ||
    pathname === "/lawyes/" ||
    /^\/lawyes\/[^/]+\/?$/.test(pathname)
  );
}

/**
 * Direct workspace visits retain their detail path. Standalone /sign-in uses
 * the validated returnTo query value, falling back to the workspace home.
 */
export function practitionerAuthDestination(
  location: string,
  returnTo: string | null | undefined,
  origin = "https://lawyes.local",
): string {
  const pathname = location.split(/[?#]/, 1)[0] || "/";
  if (isLawyesWorkspacePath(pathname)) {
    return validatedLawyesReturnTo(location, origin);
  }
  return validatedLawyesReturnTo(returnTo, origin);
}