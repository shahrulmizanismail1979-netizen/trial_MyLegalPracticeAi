import { pool } from "@workspace/db";
import { describe, expect, it } from "vitest";
import { ensureLawyesReportTables } from "./ensureLawyesReportTables";
import { seedLawyesEditorialIntake } from "./lawyesIntake";

describe("LAWYes intake candidate query (dev database)", () => {
  it("executes as a dry run without creating or publishing reports", async () => {
    await ensureLawyesReportTables();
    const before = await pool.query<{ reports: string; published: string }>(
      `SELECT count(*) reports,
              count(*) FILTER (WHERE state='Published') published
         FROM research_lawyes_reports`,
    );

    const result = await seedLawyesEditorialIntake(100, { dryRun: true });

    const after = await pool.query<{ reports: string; published: string }>(
      `SELECT count(*) reports,
              count(*) FILTER (WHERE state='Published') published
         FROM research_lawyes_reports`,
    );
    expect(result.drafted).toBeGreaterThanOrEqual(0);
    expect(result.pendingAccess).toBeGreaterThanOrEqual(0);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});