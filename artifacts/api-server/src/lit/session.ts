import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { RequestHandler } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const PgSession = connectPgSimple(session);

pool
  .query(
    `CREATE TABLE IF NOT EXISTS "lit_sessions" (
      "sid" varchar NOT NULL PRIMARY KEY,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "IDX_lit_sessions_expire" ON "lit_sessions" ("expire");`,
  )
  .catch((err) => logger.error({ err }, "Failed to ensure lit session table"));

export const litSession: RequestHandler = session({
  store: new PgSession({
    pool,
    tableName: "lit_sessions",
    createTableIfMissing: false,
  }),
  name: "lit.sid",
  secret: process.env.SESSION_SECRET || "default-secret-change-me",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});
