import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import {
  parseManifest,
  validateArtifact,
} from "./prepublish-validation.mjs";

const fixturesDir = join(process.cwd(), "scripts", "fixtures", "prepublish");
const fixture = (name) => join(fixturesDir, name);

test("parses the inline production build shape, including multiline arrays", () => {
  const artifact = parseManifest(fixture("inline-web.toml"));

  assert.deepEqual(artifact.build, [
    "pnpm",
    "--filter",
    "@workspace/fixture-inline",
    "run",
    "build",
  ]);
  assert.deepEqual(artifact.serviceEnv, {
    PORT: "19001",
    BASE_PATH: "/inline/",
  });
  assert.equal(artifact.productionBuildDeclared, true);
  assert.doesNotThrow(() => validateArtifact(artifact, fixture("inline-web.toml")));
});

test("parses the nested production build table shape", () => {
  const artifact = parseManifest(fixture("table-api.toml"));

  assert.deepEqual(artifact.build, [
    "pnpm",
    "--filter",
    "@workspace/fixture-table",
    "run",
    "build",
  ]);
  assert.deepEqual(artifact.env, { NODE_ENV: "production" });
  assert.equal(artifact.productionBuildDeclared, true);
});

test("reports a web manifest missing BASE_PATH instead of skipping its build", () => {
  const filePath = fixture("missing-base-path.toml");
  const artifact = parseManifest(filePath);

  assert.deepEqual(artifact.build, [
    "pnpm",
    "--filter",
    "@workspace/fixture",
    "run",
    "build",
  ]);
  assert.throws(
    () => validateArtifact(artifact, filePath),
    /must declare BASE_PATH in \[services\.env\]/,
  );
});

test("reports a web manifest missing PORT instead of skipping its build", () => {
  const filePath = fixture("missing-port.toml");
  const artifact = parseManifest(filePath);

  assert.throws(
    () => validateArtifact(artifact, filePath),
    /must declare PORT in \[services\.env\]/,
  );
});

test("rejects an unterminated declared build instead of treating it as absent", () => {
  const filePath = fixture("malformed-build.toml");

  assert.throws(
    () => parseManifest(filePath),
    /declares a production build but its command must be a non-empty array of strings/,
  );
});

test("rejects a declared build with an empty right-hand side", () => {
  const filePath = fixture("empty-build.toml");

  assert.throws(
    () => parseManifest(filePath),
    /declares a production build but its command must be a non-empty array of strings/,
  );
});

test("rejects invalid leading and repeated commas in a build array", () => {
  const filePath = fixture("invalid-build-commas.toml");

  assert.throws(
    () => parseManifest(filePath),
    /declares a production build but its command must be a non-empty array of strings/,
  );
});

test("rejects a production build manifest with no artifact kind", () => {
  const filePath = fixture("missing-kind.toml");
  const artifact = parseManifest(filePath);

  assert.throws(
    () => validateArtifact(artifact, filePath),
    /scripts[\\/]fixtures[\\/]prepublish[\\/]missing-kind\.toml.*must declare a recognized artifact kind/,
  );
});

test("rejects a production build manifest with a malformed artifact kind", () => {
  const filePath = fixture("malformed-kind.toml");
  const artifact = parseManifest(filePath);

  assert.equal(artifact.kind, undefined);
  assert.throws(
    () => validateArtifact(artifact, filePath),
    /scripts[\\/]fixtures[\\/]prepublish[\\/]malformed-kind\.toml.*must declare a recognized artifact kind/,
  );
});

test("rejects a production build manifest with an unsupported artifact kind", () => {
  const filePath = fixture("unsupported-kind.toml");
  const artifact = parseManifest(filePath);

  assert.throws(
    () => validateArtifact(artifact, filePath),
    /scripts[\\/]fixtures[\\/]prepublish[\\/]unsupported-kind\.toml.*must declare a recognized artifact kind.*desktop/,
  );
});