import path from "node:path";
import { parseArgs } from "./args.js";
import { banner, c, fail, ok, step } from "./logger.js";
import {
  commandExists,
  detectPackageManager,
  devCommands,
} from "./package-manager.js";
import { collectFeatureRemovals, configureFeatures } from "./features.js";
import { askProjectName } from "./project-name.js";
import { resolveTag } from "./release.js";
import {
  calibrateGitignore,
  calibratePackageJson,
  cloneRepo,
  setAgentMode,
  installDependencies,
  trimProject,
} from "./scaffold.js";
import { createPrompt } from "./prompt.js";

const { positional, requestedVersion, skipInstall } = parseArgs(process.argv);

const pm = detectPackageManager();

if (!commandExists(pm)) {
  fail(`${pm} is not installed`);
  process.exit(1);
}

console.log(banner);

const prompt = createPrompt();

try {
  const projectName = await askProjectName(positional[0], prompt);
  const droppedFeatures = await collectFeatureRemovals(prompt);
  const targetDir = path.resolve(projectName);

  step("Locating the latest Stardrive release");
  const tag = resolveTag(requestedVersion);
  ok(`Selected ${c.bold(tag)}`);

  cloneRepo(tag, targetDir, projectName);
  trimProject(targetDir);
  calibratePackageJson(targetDir, projectName, pm);
  calibrateGitignore(targetDir, pm);
  configureFeatures(targetDir, droppedFeatures);
  installDependencies(targetDir, projectName, pm, skipInstall);
  setAgentMode(targetDir);

  console.log(`
${c.green("All systems go.")} ${c.dim("Pre-flight checklist complete.")}

  ${c.dim("$")} ${c.cyan(`cd ${projectName}`)}
  ${c.dim("$")} ${c.cyan(devCommands[pm])}

${c.bold("Happy launching!")} ${c.magenta("🚀")}
`);
} finally {
  prompt?.close();
}
