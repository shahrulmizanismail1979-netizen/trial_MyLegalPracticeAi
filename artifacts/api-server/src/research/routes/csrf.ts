/**
 * CSRF guard for the research API.
 *
 * Cross-site form submission is the most common CSRF vector for API servers
 * protected only by cookie-based sessions. Browsers always send form
 * submissions with Content-Type: application/x-www-form-urlencoded (or
 * multipart/form-data), never with application/json. Requiring JSON for
 * every mutating request therefore blocks form-based CSRF without requiring
 * synchroniser tokens.
 *
 * Upload routes use multipart/form-data (handled by multer) and are
 * explicitly exempt.
 */

import type { Request, Response, NextFunction } from "express";

/** HTTP verbs that change server state. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Path-prefix pattern for upload routes that send multipart/form-data.
 * These are excluded from the JSON content-type requirement because the
 * browser's fetch() call sets the boundary automatically, and the payload is
 * an opaque binary blob — there is no JSON alternative.
 */
const MULTIPART_EXEMPT_RE = /^\/uploads(\/|$)/;

/**
 * Express middleware — enforces `Content-Type: application/json` on all
 * state-mutating requests to the research API.
 *
 * Returns HTTP 415 (Unsupported Media Type) for non-JSON bodies on mutating
 * routes (excluding upload endpoints).
 */
export function csrfGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  // Exempt file-upload routes (multipart/form-data)
  if (MULTIPART_EXEMPT_RE.test(req.path)) {
    next();
    return;
  }

  // Exempt bodyless requests — no Content-Length > 0 and no chunked transfer.
  // DELETE, PATCH, and PUT often carry no body; browsers cannot form-submit
  // DELETE at all, so these are not a CSRF vector. Only enforce when the
  // client is actually sending a payload.
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  const hasBody =
    contentLength > 0 || req.headers["transfer-encoding"] != null;
  if (!hasBody) {
    next();
    return;
  }

  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.startsWith("application/json")) {
    res.status(415).json({
      error: "Unsupported Media Type",
      message:
        "Research API mutating endpoints require Content-Type: application/json. " +
        "Upload routes (/uploads/*) are exempt.",
    });
    return;
  }

  next();
}
