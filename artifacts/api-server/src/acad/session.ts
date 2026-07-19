// Express-session middleware scoped to the MyLawAcad routes (/api/acad/*).
// The rest of the api-server uses its own token/cookie auth schemes, so the
// session middleware is applied only on the acad subrouter mount.
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { RequestHandler } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const PgSession = connectPgSimple(session);

// Ensure the session table exists at startup (createTableIfMissing needs
// connect-pg-simple's bundled table.sql, which isn't in our esbuild output).
pool
  .query(
    `CREATE TABLE IF NOT EXISTS "acad_user_sessions" (
      "sid" varchar NOT NULL PRIMARY KEY,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "IDX_acad_user_sessions_expire" ON "acad_user_sessions" ("expire");`,
  )
  .catch((err) => logger.error({ err }, "Failed to ensure acad session table"));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set in production");
}

export const acadSession: RequestHandler = session({
  store: new PgSession({
    pool,
    tableName: "acad_user_sessions",
    createTableIfMissing: false,
  }),
  name: "acad.sid",
  secret: sessionSecret ?? "dev-only-insecure-secret",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});
