// This schema mixes ORM-managed declarations with SQL-owned research objects.
// A generic push treats intentionally absent declarations as removal requests.
const message =
  "SCHEMA_PUSH_BLOCKED: This project uses reviewed additive SQL, not Drizzle push. " +
  "Push can remove research idempotency/FTS indexes and workspace cascades. " +
  "See lib/db/sql/RESEARCH_SCHEMA_CONTRACT.md. No database changes were attempted.";

function assertSafeSchemaCommand(args = process.argv) {
  if (args.includes("push") || args.includes("push-force")) {
    throw new Error(message);
  }
}

module.exports = { assertSafeSchemaCommand };

if (require.main === module) {
  console.error(message);
  process.exitCode = 1;
}