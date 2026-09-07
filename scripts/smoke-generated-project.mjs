import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";

const repoRoot = path.resolve(import.meta.dirname, "..");
const latestTag = "1.5.9";
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "create-stardrive-smoke-"));
const fixtureName = "stardrive-smoke";
const fixtureDir = path.join(fixtureRoot, fixtureName);

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

function assertMissing(relativePath) {
  assert.equal(fs.existsSync(path.join(fixtureDir, relativePath)), false, `${relativePath} should be removed`);
}

function readPackageJson() {
  const content = fs.readFileSync(path.join(fixtureDir, "package.json"), "utf8");
  assert.equal(content.endsWith("\n"), true, "package.json should end with a newline");
  return JSON.parse(content);
}

function assertDefaultProject() {
  assert.equal(fs.readFileSync(path.join(fixtureDir, "STARDRIVE_AGENT_MODE.md"), "utf8"), "project\n");

  const pkg = readPackageJson();
  assert.equal(pkg.name, fixtureName);
  assert.equal(pkg.scripts["sync-version"], undefined);
  assert.equal(pkg.scripts.prebuild, undefined);

  for (const entry of [
    ".github",
    "SECURITY.md",
    "CHANGELOG.md",
    "repository-header.png",
    "scripts/syncVersion.js",
    "public/.well-known/agent-skills",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
  ]) {
    assertMissing(entry);
  }

  for (const entry of [
    "src/pages/blog",
    "src/pages/faq.astro",
    "src/pages/integration",
    "src/pages/events",
    "wrangler.jsonc",
  ]) {
    assert.equal(fs.existsSync(path.join(fixtureDir, entry)), true, `${entry} should be retained by default`);
  }
}

async function applyTrimmedFeatures() {
  const runnerPath = path.join(fixtureRoot, "apply-trimmed-features.mjs");
  await build({
    bundle: true,
    format: "esm",
    outfile: runnerPath,
    platform: "node",
    stdin: {
      contents: `import { applyFeatureRemovals } from ${JSON.stringify(path.join(repoRoot, "src/features.ts"))}; applyFeatureRemovals(process.argv[2], ["blog", "faq", "integrations", "events", "cloudflare"]);`,
      loader: "ts",
      resolveDir: repoRoot,
    },
  });
  run("node", [runnerPath, fixtureDir]);
}

function assertTrimmedProject() {
  for (const entry of [
    "src/pages/blog",
    "src/pages/faq.astro",
    "src/pages/integration",
    "src/pages/events",
    "wrangler.jsonc",
    "worker-configuration.d.ts",
    "scripts/fixWranglerConfig.js",
    "public/_headers",
    "public/_redirects",
  ]) {
    assertMissing(entry);
  }

  const trimmedPackage = readPackageJson();
  assert.equal(trimmedPackage.scripts["generate-types"], undefined);
  assert.equal(trimmedPackage.scripts["check:type"], "tsc --noEmit");

  const themeConfig = fs.readFileSync(path.join(fixtureDir, "theme.config.ts"), "utf8");
  assert.match(themeConfig, /droppedFeatures: \['blog', 'faq', 'integrations', 'events', 'cloudflare'\]/);
}

run("node", ["build.mjs"], { cwd: repoRoot });
run("node", [path.join(repoRoot, "bin/index.js"), fixtureName, "--version", latestTag, "--no-install"], { cwd: fixtureRoot });
assertDefaultProject();
await applyTrimmedFeatures();
assertTrimmedProject();

if (!process.argv.includes("--skip-install")) {
  run("npm", ["install"], { cwd: fixtureDir });
  run("npm", ["run", "check"], { cwd: fixtureDir });
  run("npm", ["run", "build"], { cwd: fixtureDir });
}

console.log(`Generated-project smoke passed at ${fixtureDir}`);
