// Express-session middleware scoped to the MyCrimAI routes (/api/crim/*).
// The rest of the api-server uses its own token/cookie auth schemes, so the
// session middleware is applied only on the crim subrouter mount.
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
    `CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL PRIMARY KEY,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");`,
  )
  .catch((err) => logger.error({ err }, "Failed to ensure crim session table"));

export const crimSession: RequestHandler = session({
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: false,
  }),
  name: "crim.sid",
  secret: process.env.SESSION_SECRET || "default-secret-change-me",
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
