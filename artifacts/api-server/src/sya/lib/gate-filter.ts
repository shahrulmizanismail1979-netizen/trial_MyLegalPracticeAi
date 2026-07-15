import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export type Gate = "civil" | "criminal" | "advisory";

export function isValidGate(g: unknown): g is Gate {
  return g === "civil" || g === "criminal" || g === "advisory";
}

/**
 * Returns a SQL condition that matches rows whose `gates` column (comma-separated)
 * contains the given gate as a delimiter-bounded token. Whitespace around tokens
 * is tolerated. Returns null if gate is not provided/invalid.
 */
export function gateCondition(column: PgColumn, gate: unknown): SQL | null {
  if (!isValidGate(gate)) return null;
  const needle = `%,${gate},%`;
  return sql`(',' || REPLACE(COALESCE(${column}, ''), ' ', '') || ',') LIKE ${needle}`;
}
