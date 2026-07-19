import { randomBytes } from "crypto";

/**
 * A random secret generated once at server startup.
 *
 * Used as the signing secret for cookie-parser so that session cookies
 * (`taskradar_sid`) are signed server-side and cannot be forged by clients.
 * The value is never exposed to any client or API response.
 */
export const SERVER_TOKEN = randomBytes(32).toString("hex");
