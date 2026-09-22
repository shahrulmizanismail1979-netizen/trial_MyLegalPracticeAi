import { expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { findQueueProducerPaths } from "./testing/queueProducerAudit";
import { isIsolatedQueueSuite } from "./testing/isolatedQueueSuites";
import { queueAuditExceptions } from "./testing/queueAuditExceptions";

it("every suite that can reach the real research queue has an isolation decision", async () => {
  const root = path.resolve(__dirname, "..");
  const names = (await readdir(root, { recursive: true })).filter(file => file.endsWith(".ts"));
  const sources = new Map(await Promise.all(names.map(async file => {
    const full = path.join(root, file);
    return [full, await readFile(full, "utf8")] as const;
  })));
  const producers = findQueueProducerPaths(sources);
  expect(producers.size).toBeGreaterThan(10);
  for (const [file, reason] of Object.entries(queueAuditExceptions)) {
    expect(reason.length).toBeGreaterThan(20);
    expect(producers.has(path.join(root, file)), `Remove stale audit exception: ${file}`).toBe(true);
  }
  for (const file of [
    "research/drive/driveIngestCrashRecovery.test.ts",
    "routes/research-admin.restricted.test.ts",
    "routes/research-admin-bulk-rights.test.ts",
  ]) expect(producers.has(path.join(root, file)), `Must discover producer: ${file}`).toBe(true);
  expect(producers.has(path.join(root, "research/drive/driveIngestProcessor.test.ts"))).toBe(false);
  const unreviewed = [...producers]
    .filter(([file]) => !isIsolatedQueueSuite(file) && !queueAuditExceptions[path.relative(root, file).replaceAll("\\", "/")])
    .map(([, chain]) => chain.map(file => path.relative(root, file)).join(" -> "));
  expect(unreviewed, "New queue-capable suite: isolate before service imports, or document a narrowly audited exception.").toEqual([]);
});

function discover(source: string, extra: Record<string, string> = {}) {
  return findQueueProducerPaths(new Map(Object.entries({
    "/src/new.test.ts": source,
    "/src/research/processing/queue.ts": "export function enqueue() {}",
    "/src/research/processing/index.ts": 'export { enqueue } from "./queue";',
    "/src/service.ts": 'import { enqueue as addJob } from "./research/processing"; export const produce = () => addJob();',
    "/src/router.ts": 'import { produce } from "./service"; router.post("/approve", produce);',
    ...extra,
  }))).get("/src/new.test.ts");
}

it.each([
  'import { enqueue as addJob } from "./research/processing"; addJob();',
  'import * as jobs from "./research/processing"; jobs.enqueue();',
  'const jobs = await import("./research/processing"); jobs.enqueue();',
  'const jobs = require("./research/processing"); jobs.enqueue();',
  'import router from "./router"; request(router).post("/approve");',
])("discovers a newly added producer without executing it: %s", source => {
  expect(discover(source)?.at(-1)).toBe("/src/research/processing/queue.ts");
});

it.each([
  'vi.mock("./service", () => ({ produce: vi.fn() }));',
  'vi.mock("@workspace/db", () => ({ db: { insert: vi.fn() }, pool: {} }));',
])("recognizes full unit replacements: %s", mock => {
  expect(discover(`${mock} import router from "./router";`)).toBeUndefined();
});

it.each([
  'vi.mock("./service");',
  'vi.doMock("./service", () => ({ produce: vi.fn() }));',
  'vi.mock("./service", async importOriginal => ({ ...await importOriginal(), produce: vi.fn() }));',
  'vi.mock("@workspace/db", async () => ({ ...await vi.importActual("@workspace/db"), db: {} }));',
  'vi.mock("@workspace/db", () => ({ db: actual.db }));',
  'vi.mock("@workspace/db", () => ({ db: realDb }));',
  'vi.mock("./service", () => ({ produce: realProduce }));',
  'vi.mock("./service", () => ({ produce: vi.fn() })); vi.unmock("./service");',
  'if (mockIt) vi.mock("./service", () => ({ produce: vi.fn() }));',
])("does not mistake uncertain/partial mocks for isolation: %s", mock => {
  expect(discover(`${mock} import router from "./router";`)).toBeDefined();
});

it("ignores comments, type-only imports, and string fixtures", () => {
  expect(discover(`
    // import { enqueue } from "./research/processing"; enqueue();
    import type { Job } from "./research/processing";
    import { type JobOptions } from "./service";
    const fixture = 'import router from "./router"';
  `)).toBeUndefined();
});

it("finds direct table writes even without the queue API", () => {
  expect(discover("db.insert(researchJobs).values({ state: 'QUEUED' });")).toEqual(["/src/new.test.ts"]);
  expect(discover("await pool.query(`INSERT INTO research_jobs (state) VALUES ('QUEUED')`);")).toBeDefined();
});

it("follows barrels and cyclic route imports without hanging", () => {
  expect(discover('import "./barrel";', {
    "/src/barrel.ts": 'export * from "./cycle"; export * from "./router";',
    "/src/cycle.ts": 'import "./barrel";',
  })).toBeDefined();
});

it("does not exempt another suite when a unit suite mocks a shared producer", () => {
  const found = findQueueProducerPaths(new Map([
    ["/src/unit.test.ts", 'vi.mock("./research/processing/queue", () => ({ enqueue: vi.fn() })); import "./research/processing/queue";'],
    ["/src/real.test.ts", 'import "./research/processing/queue";'],
    ["/src/research/processing/queue.ts", ""],
  ]));
  expect([...found.keys()]).toEqual(["/src/real.test.ts"]);
});

it("normalizes Windows paths when following relative producer imports", () => {
  const found = findQueueProducerPaths(new Map([
    ["C:\\src\\new.test.ts", 'import "./research/processing/queue";'],
    ["C:\\src\\research\\processing\\queue.ts", ""],
  ]));
  expect(found.get("C:/src/new.test.ts")).toEqual([
    "C:/src/new.test.ts", "C:/src/research/processing/queue.ts",
  ]);
});