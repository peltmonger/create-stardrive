import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { c, info, ok, step } from "./logger.js";
import { STARDRIVE_REPO } from "./release.js";
import type { PackageManager } from "./types.js";

const TRIM_ENTRIES = [
  "scripts/syncVersion.js",
  ".ai/TRIMMING_GUIDE.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "repository-header.png",
  ".github",
  "public/.well-known/agent-skills"
];

const STALE_LOCKFILES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
];

export function cloneRepo(tag: string, targetDir: string, projectName: string): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "create-app-"));

  step(`Beaming ${c.bold(tag)} down from orbit`);
  info(STARDRIVE_REPO);

  execSync(
    `git -c advice.detachedHead=false clone --depth=1 --branch ${tag} --quiet ${STARDRIVE_REPO} "${tempDir}"`,
    {
      stdio: ["ignore", "ignore", "inherit"],
    },
  );

  fs.rmSync(path.join(tempDir, ".git"), {
    recursive: true,
    force: true,
  });

  fs.cpSync(tempDir, targetDir, {
    recursive: true,
  });
  ok(`Landed in ${c.bold(projectName)}/`);
}

export function trimProject(targetDir: string): void {
  step("Trimming unused boosters");

  for (const entry of TRIM_ENTRIES) {
    fs.rmSync(path.join(targetDir, entry), {
      recursive: true,
      force: true,
    });
  }

  for (const file of STALE_LOCKFILES) {
    fs.rmSync(path.join(targetDir, file), {
      force: true,
    });
  }
  ok("Stripped extras and stale lockfiles");
}

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  packageManager?: string;
  [key: string]: unknown;
}

export function calibratePackageJson(
  targetDir: string,
  projectName: string,
  pm: PackageManager,
): void {
  step("Calibrating package.json");

  const packageJsonPath = path.join(targetDir, "package.json");

  const pkg = JSON.parse(
    fs.readFileSync(packageJsonPath, "utf8"),
  ) as PackageJson;

  pkg.name = projectName;

  if (pkg.scripts) {
    delete pkg.scripts["sync-version"];
    delete pkg.scripts["prebuild"];

    if (pkg.scripts["fix"]) {
      pkg.scripts["fix"] = pkg.scripts["fix"].replace(
        "npm run sync-version && ",
        "",
      );
    }
  }

  if (pm === "pnpm") {
    pkg.packageManager = `pnpm@${execSync("pnpm --version").toString().trim()}`;
  }

  if (pm === "bun") {
    pkg.packageManager = `bun@${execSync("bun --version").toString().trim()}`;
  }

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  ok(`Named your ship ${c.bold(projectName)}`);
}

const LOCKFILE_RULES: Record<PackageManager, string> = {
  npm: "package-lock.json",
  pnpm: "pnpm-lock.yaml",
  yarn: "yarn.lock",
  bun: "bun.lockb",
};

export function calibrateGitignore(
  targetDir: string,
  pm: PackageManager,
): void {
  step("Calibrating .gitignore lockfile rules");

  const gitignorePath = path.join(targetDir, ".gitignore");

  if (!fs.existsSync(gitignorePath)) {
    info("No .gitignore found, skipping lockfile calibration");
    return;
  }

  const lines = fs.readFileSync(gitignorePath, "utf8").split(/\r?\n/);

  const activeRule = LOCKFILE_RULES[pm];
  const inactiveRules = Object.values(LOCKFILE_RULES).filter(
    (rule) => rule !== activeRule,
  );

  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^#?\s*(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb)$/);
    if (!match) return line;

    const rule = match[1]!;
    if (rule === activeRule) {
      // Comment out the active PM's lockfile so it gets committed.
      return `#${rule}`;
    }
    if (inactiveRules.includes(rule)) {
      // Ensure all other lockfiles are actively ignored.
      return rule;
    }
    return line;
  });

  fs.writeFileSync(gitignorePath, rewritten.join("\n"));
  ok(`Enabled ${activeRule} for ${pm}, ignored others`);
}

export function setAgentMode(targetDir: string): void {
  step("Specifying AI agent mode in the project");

  fs.writeFileSync(
    path.join(targetDir, "STARDRIVE_AGENT_MODE.md"),
    "project\n",
  );
  ok("Created STARDRIVE_AGENT_MODE.md");
}

export function installDependencies(
  targetDir: string,
  projectName: string,
  pm: PackageManager,
  skipInstall: boolean,
): void {
  if (skipInstall) {
    step("Skipping dependency install");
    info(`Run "${pm} install" inside ${projectName}/ when you're ready.`);
    return;
  }

  step(`Loading dependencies with ${c.bold(pm)}`);

  execSync(`${pm} install --silent`, {
    cwd: targetDir,
    stdio: "inherit",
  });
  ok("Engines online");
}
