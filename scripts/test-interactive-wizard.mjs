import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "create-stardrive-pty-"));
const fakeBin = path.join(fixtureRoot, "bin");
const projectName = "wizard-test";
const transcript = path.join(fixtureRoot, "transcript");

fs.mkdirSync(fakeBin);
fs.writeFileSync(
  path.join(fakeBin, "git"),
  `#!/bin/sh
case "$*" in
  *ls-remote*) printf 'deadbeef\trefs/tags/v1.5.9\\n' ;;
  *)
    for target; do :; done
    mkdir -p "$target/.git"
    printf '{"name":"stardrive","scripts":{}}\\n' > "$target/package.json"
    printf 'export default {\\n};\\n' > "$target/theme.config.ts"
    printf '#package-lock.json\\n' > "$target/.gitignore"
    ;;
esac
`,
  { mode: 0o755 },
);

execFileSync(process.execPath, ["build.mjs"], { cwd: repoRoot });

const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(repoRoot, "bin/index.js"))} --version 1.5.9 --no-install`;
const args = process.platform === "darwin"
  ? ["-q", transcript, "sh", "-c", command]
  : ["-qefc", command, transcript];
const result = spawnSync("script", args, {
  cwd: fixtureRoot,
  env: {
    ...process.env,
    PATH: `${fakeBin}:${process.env.PATH}`,
    TERM: "xterm",
    npm_config_user_agent: "npm/11.17.0 node/v26.4.0 darwin x64",
  },
  input: `${projectName}\nn\nn\nn\nn\nn\n`,
  encoding: "utf8",
  timeout: 10_000,
});

assert.equal(result.error, undefined, `wizard timed out: ${result.error?.message ?? "unknown error"}`);
const output = fs.readFileSync(transcript, "utf8");
assert.equal(result.status, 0, `${result.stderr}\n${output}`);
for (const prompt of [
  "Project name:",
  "Keep the blog feature?",
  "Keep the FAQ feature?",
  "Keep the integration catalog?",
  "Keep the events feature?",
  "Will you host on Cloudflare Workers?",
]) {
  assert.match(output, new RegExp(prompt));
}
assert.match(output, /All systems go\./);
assert.match(
  fs.readFileSync(path.join(fixtureRoot, projectName, "theme.config.ts"), "utf8"),
  /droppedFeatures: \['blog', 'faq', 'integrations', 'events', 'cloudflare'\]/,
);

console.log("Interactive PTY wizard test passed");
