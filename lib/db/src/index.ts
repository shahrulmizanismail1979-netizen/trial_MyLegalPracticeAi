import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

/**
 * Create an additional pool against the same database (e.g. with a custom
 * search_path for schema-isolated tests). Callers own its lifecycle.
 */
export function createPool(config?: pg.PoolConfig): pg.Pool {
  return new Pool({ connectionString: process.env.DATABASE_URL, ...config });
}

/** Create a Drizzle client (same schema typing as `db`) over a given pool. */
export function createDb(p: pg.Pool): typeof db {
  return drizzle(p, { schema });
}

export * from "./schema";
