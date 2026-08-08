import pg from "pg";
import * as schema from "./schema";
export declare const pool: import("pg").Pool;
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: import("pg").Pool;
};
/**
 * Create an additional pool against the same database (e.g. with a custom
 * search_path for schema-isolated tests). Callers own its lifecycle.
 */
export declare function createPool(config?: pg.PoolConfig): pg.Pool;
/** Create a Drizzle client (same schema typing as `db`) over a given pool. */
export declare function createDb(p: pg.Pool): typeof db;
export * from "./schema";
//# sourceMappingURL=index.d.ts.map