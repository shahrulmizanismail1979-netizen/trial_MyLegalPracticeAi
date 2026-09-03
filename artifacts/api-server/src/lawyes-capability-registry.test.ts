import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_REGISTRY,
  REQUIRED_CAPABILITY_CATEGORIES,
  type Capability,
  validateCapabilityRegistry,
} from "../../landing-page/src/fixtures/lawyes-skills";

const readServerSource = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

function currentServerRouteFamilies(): ReadonlySet<string> {
  const root = readServerSource("routes/index.ts");
  const lit = readServerSource("lit/routes/index.ts");
  const firm = readServerSource("firm/routes/index.ts");
  const firmInsights = readServerSource("firm/routes/insights.ts");
  const families = new Set<string>();

  for (const match of root.matchAll(/router\.use\("([^"]+)"/g)) {
    families.add(`/api${match[1]}`);
  }
  for (const match of root.matchAll(/router\.use\((\w+Router)\);/g)) {
    const importedRouter = match[1];
    const importMatch = root.match(
      new RegExp(`import ${importedRouter} from "\\./([^"]+)"`),
    );
    if (importMatch) {
      families.add(`/api/${importMatch[1].split("-")[0]}`);
    }
  }
  for (const match of lit.matchAll(/router\.use\("([^"]+)"/g)) {
    families.add(`/api/lit${match[1]}`);
  }

  // Firm route modules mount their own paths, so the index imports are the
  // authoritative family surface (for example tasks.ts owns /tasks/*).
  for (const match of firm.matchAll(/import \w+Router from "\.\/([^"]+)"/g)) {
    const family = match[1];
    if (family !== "health" && family !== "auth" && family !== "users" && family !== "insights") {
      families.add(`/api/firm/${family}`);
    }
  }
  for (const match of firmInsights.matchAll(/router\.(?:get|post|put|patch|delete)\("([^"]+)"/g)) {
    families.add(`/api/firm${match[1]}`);
  }

  return families;
}

describe("LAWYes capability registry contract", () => {
  it("matches required practice coverage, preview boundaries, and live router families", () => {
    expect(validateCapabilityRegistry(CAPABILITY_REGISTRY, currentServerRouteFamilies())).toEqual([]);
    expect(new Set(CAPABILITY_REGISTRY.map((capability) => capability.category))).toEqual(
      new Set(REQUIRED_CAPABILITY_CATEGORIES),
    );
  });

  it("reports unsafe readiness and adapter-boundary combinations clearly", () => {
    const specialist = CAPABILITY_REGISTRY.find((capability) => capability.id === "litigation-ai-toolkit")!;
    const previewAgainstSpecialistRoutes = {
      ...specialist,
      readiness: "Available in LAWYes preview",
      workspaceDestination: "draft",
    } satisfies Capability;
    const runnableAdapterCapability = {
      ...specialist,
      workspaceDestination: "matter",
      adapterBoundary: "",
    } satisfies Capability;

    expect(
      validateCapabilityRegistry(
        [previewAgainstSpecialistRoutes, runnableAdapterCapability],
        currentServerRouteFamilies(),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("preview-ready capability may only use browser-local service routes"),
        expect.stringContaining('preview action "matter" is only allowed for browser-local capabilities'),
        expect.stringContaining("capability must state its LAWYes adapter boundary"),
      ]),
    );
  });

  it("reports stale specialist routes clearly", () => {
    const specialist = CAPABILITY_REGISTRY.find((capability) => capability.id === "litigation-ai-toolkit")!;
    const stale = {
      ...specialist,
      serviceRoutes: ["/api/lit/removed-tool/*"],
    } satisfies Capability;

    expect(validateCapabilityRegistry([stale], currentServerRouteFamilies())).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "registered specialist route family is missing from the server router surface: /api/lit/removed-tool/*",
        ),
      ]),
    );
  });
});