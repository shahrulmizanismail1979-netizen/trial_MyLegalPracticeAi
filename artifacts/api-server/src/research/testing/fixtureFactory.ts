import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  InsertResearchSourceContainer,
  ResearchSourceContainer,
} from "@workspace/db";
import { registerContainer } from "../data/containers";
import type { DbClient } from "../domain/types";

// Synthetic fixture factory. Only synthetic content is ever used in tests —
// real restricted case files are excluded from source control and fixtures.

export const SYNTHETIC_FIXTURES_DIR = path.resolve(
  __dirname,
  "../../../../../fixtures/synthetic",
);

export function makeContainerInput(
  overrides: Partial<InsertResearchSourceContainer> = {},
): InsertResearchSourceContainer {
  const id = randomUUID();
  const body = `synthetic container ${id}`;
  return {
    originalName: `synthetic-${id}.txt`,
    sourceBatch: `factory-batch-${id}`,
    contentSha256: createHash("sha256").update(body).digest("hex"),
    sizeBytes: Buffer.byteLength(body),
    mimeType: "text/plain",
    provenance: { enteredVia: "fixture-factory", fixtureId: id },
    ...overrides,
  };
}

/** Register a synthetic container built by the factory. */
export async function createFixtureContainer(
  overrides: Partial<InsertResearchSourceContainer> = {},
  dbc?: DbClient,
): Promise<ResearchSourceContainer> {
  return registerContainer(makeContainerInput(overrides), dbc);
}

/** Register a container from a file in fixtures/synthetic/. */
export async function createContainerFromFixtureFile(
  fileName: string,
  overrides: Partial<InsertResearchSourceContainer> = {},
  dbc?: DbClient,
): Promise<ResearchSourceContainer> {
  const bytes = await readFile(path.join(SYNTHETIC_FIXTURES_DIR, fileName));
  return registerContainer(
    makeContainerInput({
      originalName: fileName,
      contentSha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.length,
      ...overrides,
    }),
    dbc,
  );
}

export function makeJobKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
