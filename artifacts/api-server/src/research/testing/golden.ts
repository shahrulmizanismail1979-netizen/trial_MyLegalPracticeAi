import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Golden-result comparison utilities. Golden files live in fixtures/golden/
// and are committed. Regenerate deliberately with UPDATE_GOLDEN=1 — a missing
// golden file is a test failure, never a silent pass.

export const GOLDEN_DIR = path.resolve(
  __dirname,
  "../../../../../fixtures/golden",
);

function stable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Load the golden value for `name` (fixtures/golden/<name>.json). When
 * UPDATE_GOLDEN=1, the golden file is (re)written from `actual` first.
 * Callers assert: expect(actual).toEqual(await loadGolden(name, actual)).
 */
export async function loadGolden(
  name: string,
  actual: unknown,
): Promise<unknown> {
  const file = path.join(GOLDEN_DIR, `${name}.json`);
  if (process.env.UPDATE_GOLDEN === "1") {
    await mkdir(GOLDEN_DIR, { recursive: true });
    await writeFile(file, stable(actual), "utf8");
  }
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new Error(
      `Golden file missing: ${file}. Run with UPDATE_GOLDEN=1 to create it deliberately.`,
    );
  }
  return JSON.parse(raw);
}
