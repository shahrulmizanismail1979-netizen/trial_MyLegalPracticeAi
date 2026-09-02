import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const artifactsDir = join(root, "artifacts");

function parseString(value) {
  const match = value.trim().match(/^"((?:[^"\\]|\\.)*)"/);
  return match ? JSON.parse(`"${match[1]}"`) : undefined;
}

function parseStringArray(value) {
  const match = value.trim().match(/^\[(.*)\]\s*(?:#.*)?$/);
  if (!match) return undefined;

  return [...match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((item) =>
    JSON.parse(`"${item[1]}"`),
  );
}

function parseManifest(filePath) {
  const text = readFileSync(filePath, "utf8");
  let section = "";
  const values = new Map();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("[[")) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    const assignment = line.match(/^([A-Za-z][\w-]*)\s*=\s*(.+)$/);
    if (assignment) {
      values.set(section ? `${section}.${assignment[1]}` : assignment[1], assignment[2]);
    }
  }

  const serviceEnv = {};
  const buildEnv = {};
  for (const [key, value] of values) {
    if (key.startsWith("services.env.")) {
      serviceEnv[key.slice("services.env.".length)] = parseString(value);
    } else if (key.startsWith("services.production.build.env.")) {
      buildEnv[key.slice("services.production.build.env.".length)] = parseString(value);
    }
  }

  const inlineBuild = values.get("services.production.build");
  const tableBuild = values.get("services.production.build.args");

  return {
    title: parseString(values.get("title") ?? "") ?? relative(root, filePath),
    kind: parseString(values.get("kind") ?? ""),
    build: inlineBuild
      ? parseStringArray(inlineBuild)
      : tableBuild
        ? parseStringArray(tableBuild)
        : undefined,
    env: { ...serviceEnv, ...buildEnv },
  };
}

function run(label, command, env = process.env) {
  console.log(`\n==> ${label}`);
  console.log(`$ ${command.join(" ")}`);
  const result = spawnSync(command[0], command.slice(1), {
    cwd: root,
    env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("Full workspace typecheck", ["pnpm", "run", "typecheck"]);

const manifests = readdirSync(artifactsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(artifactsDir, entry.name, ".replit-artifact", "artifact.toml"))
  .filter((filePath) => {
    try {
      readFileSync(filePath);
      return true;
    } catch {
      return false;
    }
  })
  .sort();

for (const filePath of manifests) {
  const artifact = parseManifest(filePath);
  if (!artifact.build) {
    console.log(`\n==> ${artifact.title}: no production build declared; skipped`);
    continue;
  }

  if (artifact.kind === "web" && (!artifact.env.PORT || !artifact.env.BASE_PATH)) {
    console.error(
      `\n${relative(root, filePath)} must declare PORT and BASE_PATH in [services.env]`,
    );
    process.exit(1);
  }

  const shownEnv = Object.entries(artifact.env)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  run(
    `${artifact.title} production build${shownEnv ? ` (${shownEnv})` : ""}`,
    artifact.build,
    { ...process.env, ...artifact.env },
  );
}

console.log(`\nPre-publish validation passed (${manifests.length} artifact manifests checked).`);