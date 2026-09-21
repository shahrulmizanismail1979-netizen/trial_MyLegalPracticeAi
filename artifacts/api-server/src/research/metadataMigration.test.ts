import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { researchCaseMetadata } from "@workspace/db";
import { createIsolatedTestDb, type IsolatedTestDb } from "./testing/testDb";

const migrationDir = path.resolve(__dirname, "../../../../lib/db/sql/migrations");
const forwardMigration = await readFile(
  path.join(migrationDir, "0044-research-metadata-unique-key.sql"),
  "utf8",
);

describe("research metadata forward migration", () => {
  let isolated: IsolatedTestDb;
  let judgmentId: number;
  let containerId: number;

  beforeEach(async () => {
    isolated = await createIsolatedTestDb();
    // Reproduce the historical schema without the test bootstrap's later DDL.
    for (const name of [
      "0010-phase07-isolation.sql",
      "0011-phase07-verified-judgment-spans.sql",
      "0012-phase07-warning-separation.sql",
      "0013-phase07-schema-alignment.sql",
      "0014-phase08-search-ui.sql",
    ]) {
      await isolated.pool.query(await readFile(path.join(migrationDir, name), "utf8"));
    }
    const container = await isolated.pool.query(`
      INSERT INTO research_source_containers
        (original_name, source_batch, content_sha256, size_bytes, provenance)
      VALUES ('migration-test', 'migration-test', repeat('a', 64), 1, '{}')
      RETURNING id
    `);
    containerId = container.rows[0].id;
    const candidate = await isolated.pool.query(
      "INSERT INTO research_case_candidates (container_id) VALUES ($1) RETURNING id",
      [containerId],
    );
    const judgment = await isolated.pool.query(`
      INSERT INTO research_verified_judgments
        (candidate_id, container_id, text_checksum, verified_by)
      VALUES ($1, $2, repeat('b', 64), 'migration-test') RETURNING id
    `, [candidate.rows[0].id, containerId]);
    judgmentId = judgment.rows[0].id;
  });

  afterEach(async () => {
    await isolated?.drop();
  });

  const metadata = (version = "test@1", value = "Original") => ({
    judgmentId,
    containerId,
    fieldName: "caseName" as const,
    value,
    confidence: 0.9,
    method: "regex" as const,
    processorVersion: version,
    reviewerStatus: "approved" as const,
  });

  // Same Drizzle conflict target as metadataProcessor; exercise PostgreSQL's
  // arbiter inference, not just an index-name assertion.
  function processorInsert(version = "test@1", value = "Original") {
    return isolated.db.insert(researchCaseMetadata).values(metadata(version, value))
      .onConflictDoNothing({
        target: [
          researchCaseMetadata.judgmentId,
          researchCaseMetadata.fieldName,
          researchCaseMetadata.processorVersion,
        ],
      }).returning();
  }

  it("enables the processor conflict target on a fresh historical schema", async () => {
    const indexBefore = await isolated.pool.query(
      "SELECT to_regclass('research_case_metadata_judgment_field_version_uq') AS index",
    );
    expect(indexBefore.rows[0].index).toBeNull();
    await isolated.pool.query(forwardMigration);

    expect(await processorInsert()).toHaveLength(1);
    expect(await processorInsert("test@1", "Must not overwrite")).toHaveLength(0);
    expect(await processorInsert("test@2")).toHaveLength(1);
    await isolated.db.insert(researchCaseMetadata).values({
      ...metadata(), fieldName: "court",
    });
    const records = await isolated.db.select().from(researchCaseMetadata);
    expect(records).toHaveLength(3);
    expect(records.find((r) => r.fieldName === "caseName" && r.processorVersion === "test@1"))
      .toMatchObject({ value: "Original", reviewerStatus: "approved" });
  });

  it("preserves existing metadata and can be applied again", async () => {
    await isolated.db.insert(researchCaseMetadata).values(metadata());
    const before = await isolated.db.select().from(researchCaseMetadata);
    await isolated.pool.query(forwardMigration);
    await isolated.pool.query(forwardMigration);
    expect(await isolated.db.select().from(researchCaseMetadata)).toEqual(before);
    expect(await processorInsert()).toHaveLength(0);
  });

  it("refuses duplicate keys without changing either record", async () => {
    await isolated.db.insert(researchCaseMetadata).values([
      metadata(),
      { ...metadata("test@1", "Conflicting reviewed value"), reviewerStatus: "rejected" },
    ]);
    const before = await isolated.db.select().from(researchCaseMetadata);
    // Use one connection: a failed explicit migration transaction needs a
    // rollback on that same connection before it returns to the pool.
    const client = await isolated.pool.connect();
    try {
      await expect(client.query(forwardMigration)).rejects.toMatchObject({
        code: "23505",
        message: expect.stringContaining("1 duplicate key groups"),
        hint: expect.stringContaining("editorial review"),
      });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    expect(await isolated.db.select().from(researchCaseMetadata)).toEqual(before);
    const index = await isolated.pool.query(
      "SELECT to_regclass('research_case_metadata_judgment_field_version_uq') AS index",
    );
    expect(index.rows[0].index).toBeNull();
  });
});