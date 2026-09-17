import fs from "node:fs";
import path from "node:path";
import { c, fail } from "./logger.js";
import { createPrompt } from "./prompt.js";
import type { Prompt } from "./prompt.js";

export function isValidProjectName(name: string): boolean {
  return /^[a-z0-9._-]+$/i.test(name) && !/^[._]/.test(name);
}

export async function askProjectName(
  initial: string | undefined,
  prompt?: Prompt,
): Promise<string> {
  if (initial && isValidProjectName(initial)) {
    const targetDir = path.resolve(initial);
    if (!fs.existsSync(targetDir)) return initial;
    fail(`Directory "${initial}" already exists.`);
  }

  const ownPrompt = prompt === undefined;
  const rl = prompt ?? createPrompt();

  if (!rl) {
    fail(
      `Project name "${initial ?? ""}" is missing or invalid and stdin is not interactive.`,
    );
    process.exit(1);
  }

  try {
    while (true) {
      const answer = (
        await rl.question(
          `${c.cyan("?")} ${c.bold("Project name:")} ${c.dim("(my-stardrive) ")}`,
        )
      ).trim();

      const name = answer || "my-stardrive";

      if (!isValidProjectName(name)) {
        console.log(
          `  ${c.yellow("!")} Use letters, digits, dots, dashes or underscores.`,
        );
        continue;
      }

      const targetDir = path.resolve(name);

      if (fs.existsSync(targetDir)) {
        console.log(
          `  ${c.yellow("!")} "${name}" already exists. Try another.`,
        );
        continue;
      }

      return name;
    }
  } finally {
    if (ownPrompt) rl.close();
  }
}
