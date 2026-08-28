import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Baseline = {
  production: {
    canonicalOrigin: string;
    deploymentRouter: string;
    deploymentTarget: string;
    publishRequiresExplicitOwnerApproval: boolean;
  };
  artifacts: Array<{ name: string; path: string; route: string }>;
  apiMountContracts: Array<{ mount: string; source: string; marker: string }>;
  environmentContractNames: Record<string, string[]>;
  dataContracts: {
    baselineMigration: string;
    postBaselineMigrationAssertions: Record<
      string,
      { requiredMarkers: string[]; allowedNonDataDrops: string[] }
    >;
    destructiveMigrationAllowlist: Record<string, string[]>;
  };
  regressionEvidence: Array<{
    contract: string;
    path: string;
    marker: string;
  }>;
};

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const baseline = JSON.parse(
  read("fixtures/preservation/task-522-baseline.json"),
) as Baseline;

describe("Task 522 preservation baseline", () => {
  it("pins the existing deployment, canonical domain, and artifact paths", () => {
    const replit = read(".replit");

    expect(baseline.production).toEqual({
      canonicalOrigin: "https://mylegalpracticeai.life",
      deploymentRouter: "application",
      deploymentTarget: "autoscale",
      publishRequiresExplicitOwnerApproval: true,
    });
    expect(replit).toContain('router = "application"');
    expect(replit).toContain('deploymentTarget = "autoscale"');
    expect(replit).toContain(
      'LAWYES_PUBLIC_URL = "https://mylegalpracticeai.life"',
    );

    const routes = baseline.artifacts.map(({ route }) => route);
    expect(new Set(routes).size).toBe(routes.length);
    for (const artifact of baseline.artifacts) {
      expect(
        existsSync(join(root, artifact.path, "package.json")),
        `${artifact.name} must remain at ${artifact.path}`,
      ).toBe(true);
    }
  });

  it("pins guarded API mounts instead of booting or touching services", () => {
    for (const contract of baseline.apiMountContracts) {
      expect(
        read(contract.source),
        `${contract.mount} lost mount or guard: ${contract.marker}`,
      ).toContain(contract.marker);
    }
  });

  it("keeps regression evidence for auth, billing, and tenant isolation", () => {
    for (const evidence of baseline.regressionEvidence) {
      expect(existsSync(join(root, evidence.path)), evidence.contract).toBe(
        true,
      );
      expect(read(evidence.path), evidence.contract).toContain(evidence.marker);
    }
  });

  it("stores environment contract names only, never secret values", () => {
    const serialized = JSON.stringify(baseline);
    const names = Object.values(baseline.environmentContractNames).flat();

    expect(names).toEqual(
      expect.arrayContaining([
        "DATABASE_URL",
        "SESSION_SECRET",
        "LAWYES_PUBLIC_URL",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "PRIVATE_OBJECT_DIR",
        "PUBLIC_OBJECT_SEARCH_PATHS",
      ]),
    );
    expect(serialized).not.toMatch(
      /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\//,
    );
  });

  it("rejects every destructive migration except pinned pre-baseline SQL", () => {
    const migrationDir = join(root, "lib/db/sql/migrations");
    const files = readFileSync(
      join(migrationDir, baseline.dataContracts.baselineMigration),
    );
    expect(files.length).toBeGreaterThan(0);

    const destructive =
      /\b(?:DROP\s+(?:TABLE|COLUMN|SCHEMA)|TRUNCATE(?:\s+TABLE)?|DELETE\s+FROM)\b/gi;
    const found: Record<string, string[]> = {};

    for (const file of readdirSync(migrationDir).filter((name) =>
      name.endsWith(".sql"),
    )) {
      const sql = readFileSync(join(migrationDir, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/--.*$/gm, "");
      const matches = [...sql.matchAll(destructive)].map((match) => match[0]);
      if (matches.length) found[file] = matches;
    }

    expect(Object.keys(found)).toEqual(
      Object.keys(baseline.dataContracts.destructiveMigrationAllowlist),
    );
    for (const [file, allowedMarkers] of Object.entries(
      baseline.dataContracts.destructiveMigrationAllowlist,
    )) {
      const statements = found[file] ?? [];
      expect(statements).toHaveLength(allowedMarkers.length);
      for (const marker of allowedMarkers) {
        expect(read(`lib/db/sql/migrations/${file}`)).toContain(marker);
      }
    }
  });

  it("requires migration 0033 to remain additive to preserved portal data", () => {
    const migrationDir = "lib/db/sql/migrations";
    for (const [file, assertion] of Object.entries(
      baseline.dataContracts.postBaselineMigrationAssertions,
    )) {
      const sql = read(`${migrationDir}/${file}`);
      for (const marker of assertion.requiredMarkers) {
        expect(sql, `${file} must retain ${marker}`).toContain(marker);
      }

      // PostgreSQL has no CREATE OR REPLACE TRIGGER. These two drops replace
      // triggers on tables created by this same additive migration; they do
      // not remove records, columns, tables, schemas, or customer data.
      const nonDataDrops = [
        ...sql.matchAll(/\bDROP\s+TRIGGER\s+IF\s+EXISTS\s+[^;]+/gi),
      ].map((match) => match[0].replace(/\s+/g, " ").trim());
      expect(nonDataDrops).toEqual(assertion.allowedNonDataDrops);
    }
  });
});
