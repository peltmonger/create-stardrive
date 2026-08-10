import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { c, info, ok, step } from "./logger.js";

function removePaths(targetDir: string, entries: string[]): void {
  for (const entry of entries) {
    fs.rmSync(path.join(targetDir, entry), {
      recursive: true,
      force: true,
    });
  }
}

function editFile(
  targetDir: string,
  relativePath: string,
  transform: (content: string) => string,
): void {
  const filePath = path.join(targetDir, relativePath);
  if (!fs.existsSync(filePath)) return;
  const before = fs.readFileSync(filePath, "utf8");
  const after = transform(before);
  if (after !== before) {
    // Collapse any runs of 3+ newlines (i.e. 2+ consecutive blank lines)
    // down to a single blank line. Block removals and line drops can leave
    // these behind, which trips prettier's `no-multiple-empty-lines` rule.
    const collapsed = after.replace(/\n{3,}/g, "\n\n");
    fs.writeFileSync(filePath, collapsed);
  }
}

function removeLines(source: string, pattern: RegExp): string {
  return source
    .split("\n")
    .filter((line) => !pattern.test(line))
    .join("\n");
}

function removeBraceBlock(source: string, startPattern: RegExp): string {
  const match = startPattern.exec(source);
  if (!match) return source;

  const start = match.index;
  let i = source.indexOf("{", start);
  if (i === -1) return source;

  let depth = 0;
  let end = -1;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return source;

  let after = end + 1;
  while (after < source.length && /[);,]/.test(source[after]!)) after++;
  if (source[after] === "\n") after++;

  let head = start;
  while (head > 0 && /[ \t]/.test(source[head - 1]!)) head--;

  return source.slice(0, head) + source.slice(after);
}

function removeCollectionFromExport(source: string, name: string): string {
  return source.replace(
    /(export const collections\s*=\s*\{)([^}]*)(\};?)/,
    (_full, open: string, body: string, close: string) => {
      const items = body
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && entry !== name);
      return `${open} ${items.join(", ")} ${close}`;
    },
  );
}

function removeBlog(targetDir: string): void {
  removePaths(targetDir, [
    "src/utils/blog.ts",
    "src/utils/reading-time.ts",
    "src/styles/blog.css",
    "src/pages/rss.xml.js",
    "src/pages/[lang]/rss.xml.js",
    "src/pages/blog",
    "src/pages/[lang]/blog",
    "src/layouts/article.astro",
    "src/images/content/articles-fallback.jpg",
    "src/images/content/articles",
    "src/content/articles",
    "src/components/structured/article.astro",
    "src/components/blog",
    "scripts/processSocialImages.js",
    "public/data/articles",
  ]);

  editFile(targetDir, "scripts/postbuild.js", (content) =>
    removeLines(content, /await import\(['"]\.\/processSocialImages\.js['"]\);/),
  );

  editFile(targetDir, "src/content.config.ts", (content) => {
    const withoutDecl = removeBraceBlock(content, /const articles = defineCollection\(/);
    return removeCollectionFromExport(withoutDecl, "articles");
  });

  editFile(targetDir, "theme.config.ts", (content) => {
    const withoutSection = removeBraceBlock(content, /^[ \t]*articles:\s*\{/m);
    const withoutComment = removeLines(withoutSection, /^\s*\/\/ content\/articles settings\s*$/);
    return removeLines(withoutComment, /^\s*addArticles:/);
  });

  // Drop the `reading-time` dependency and its Vite optimizeDps entry.
  const packageJsonPath = path.join(targetDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf8"),
    ) as PackageJson;

    if (pkg.dependencies) delete pkg.dependencies["reading-time"];
    if (pkg.devDependencies) delete pkg.devDependencies["reading-time"];

    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
  }

  editFile(targetDir, "astro.config.ts", (content) =>
    content
      .replace(
        /(\binclude:\s*\[)([^\]]*)\]/,
        (_full, prefix: string, body: string) => {
          const items = body
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0 && entry !== "'reading-time'");
          return `${prefix}${items.join(", ")}]`;
        },
      )
      .replace(/,\s*\]/, "]"),
  );
}

function removeFaq(targetDir: string): void {
  removePaths(targetDir, [
    "src/content/faq-answers",
    "src/pages/faq.astro",
    "src/pages/[lang]/faq.astro",
    "src/components/faq",
  ]);

  editFile(targetDir, "src/content.config.ts", (content) => {
    const withoutDecl = removeBraceBlock(content, /const faq_answers = defineCollection\(/);
    return removeCollectionFromExport(withoutDecl, "faq_answers");
  });

  editFile(targetDir, "theme.config.ts", (content) =>
    removeLines(content, /^\s*addFAQ:/),
  );
}

function removeIntegration(targetDir: string): void {
  removePaths(targetDir, [
    "src/images/content/integration",
    "src/content/integration-options",
    "src/pages/integration",
    "src/pages/[lang]/integration",
    "src/components/integration",
  ]);

  editFile(targetDir, "src/content.config.ts", (content) => {
    const withoutDecl = removeBraceBlock(
      content,
      /const integration_options = defineCollection\(/,
    );
    return removeCollectionFromExport(withoutDecl, "integration_options");
  });

  // The default boilerplate lists `integration_options` as the only on-demand
  // rendered collection and excludes `/integration/**` from llms.txt. With the
  // feature gone, both arrays should be emptied so no stale references remain.
  editFile(targetDir, "theme.config.ts", (content) =>
    content
      .replace(
        /onDemandRenderedCollections:\s*\[[^\]]*\]/,
        "onDemandRenderedCollections: []",
      )
      .replace(
        /excludePagesPattern:\s*\[[^\]]*\]/,
        "excludePagesPattern: []",
      ),
  );
}

function removeEvents(targetDir: string): void {
  removePaths(targetDir, [
    "src/styles/events.css",
    "src/pages/events",
    "src/pages/[lang]/events",
    "src/pages/dynamic-events-sitemap.xml.ts",
    "src/components/events",
    "src/content/events",
    "src/images/content/events",
    "src/utils/event-bridge.ts"
  ]);

  editFile(targetDir, "src/content.config.ts", (content) => {
    const withoutDecl = removeBraceBlock(content, /const events = defineCollection\(/);
    return removeCollectionFromExport(withoutDecl, "events");
  });

  editFile(targetDir, "theme.config.ts", (content) => {
    const withoutSection = removeBraceBlock(content, /^[ \t]*events:\s*\{/m);
    const withoutComment = removeLines(
      withoutSection,
      /^\s*\/\/ content\/events settings\s*$/,
    );
    return removeLines(withoutComment, /^\s*addEvents:/);
  });

  editFile(targetDir, "astro.config.ts", (content) => {
    return removeLines(content, /^\s*customSitemaps:\s.*$/m);
  });
}

function cleanupContentConfig(targetDir: string): void {
  const contentConfigPath = path.join(targetDir, "src/content.config.ts");
  if (!fs.existsSync(contentConfigPath)) return;

  const content = fs.readFileSync(contentConfigPath, "utf8");

  // If the `collections` export body is empty (only whitespace), every
  // collection has been removed - collapse the file to a minimal stub so
  // no dangling imports or declarations remain.
  const match = content.match(
    /export const collections\s*=\s*\{([^}]*)\}\s*;?/,
  );
  if (match && match[1]!.trim() === "") {
    fs.writeFileSync(contentConfigPath, "export const collections = {};\n");
    ok("No content collections left; cleaned up content.config.ts");
  }
}

function cleanupNav(
  targetDir: string,
  removed: { blog: boolean; faq: boolean; integration: boolean; events: boolean },
): void {
  const routes = [
    removed.blog ? "blog" : null,
    removed.faq ? "faq" : null,
    removed.integration ? "integration" : null,
    removed.events ? "events" : null,
  ].filter((route): route is string => route !== null);

  if (routes.length === 0) return;

  const pattern = new RegExp(
    `getLocaleUrl\\(['"](?:${routes.join("|")})['"]`,
  );

  editFile(targetDir, "src/components/layout/nav/footer-nav.astro", (content) =>
    removeLines(content, pattern),
  );
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

function removeCloudflare(targetDir: string): void {
  removePaths(targetDir, [
    "scripts/purgeCloudflareCache.js",
    "worker-configuration.d.ts",
    "wrangler.jsonc",
    "public/_headers",
    "public/_redirects",
  ]);

  editFile(targetDir, "astro.config.ts", (content) => {
    const withoutImport = removeLines(
      content,
      /^import cloudflare from ['"]@astrojs\/cloudflare['"];/,
    );
    // `adapter: cloudflare({ ... })` spans multiple lines - drop the whole
    // brace-balanced block (and its trailing `,`) rather than just the opener.
    return removeBraceBlock(withoutImport, /^\s*adapter:\s*cloudflare\(/m);
  });

  const packageJsonPath = path.join(targetDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf8"),
    ) as PackageJson;

    if (pkg.scripts) delete pkg.scripts["purge:cloudflare"];
    if (pkg.dependencies) {
      delete pkg.dependencies["@astrojs/cloudflare"];
      delete pkg.dependencies["wrangler"];
    }
    if (pkg.devDependencies) {
      delete pkg.devDependencies["@astrojs/cloudflare"];
      delete pkg.devDependencies["wrangler"];
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
  }
}

/**
 * Records the list of dropped features in `theme.config.ts` under the
 * `droppedFeatures` key, so AI agents and maintainers can see at a glance
 * which parts of the default boilerplate were intentionally removed.
 */
function updateDroppedFeatures(targetDir: string, features: string[]): void {
  if (features.length === 0) return;

  editFile(targetDir, "theme.config.ts", (content) => {
    const arrayLiteral = `[${features.map((f) => `'${f}'`).join(", ")}]`;

    // If `droppedFeatures` already exists, replace its value.
    const existingPattern = /droppedFeatures\s*:\s*\[[^\]]*\]/;
    if (existingPattern.test(content)) {
      return content.replace(existingPattern, `droppedFeatures: ${arrayLiteral}`);
    }

    // Otherwise, insert it just before the final closing `};` of the export.
    const closingMatch = content.match(/\n};\s*$/);
    if (!closingMatch || closingMatch.index === undefined) return content;

    const insert = `\n\n  droppedFeatures: ${arrayLiteral},`;
    return content.slice(0, closingMatch.index) + insert + content.slice(closingMatch.index);
  });
}

async function confirm(
  rl: readline.Interface,
  question: string,
  defaultYes = true,
): Promise<boolean> {
  const hint = defaultYes ? "(Y/n)" : "(y/N)";
  const answer = (
    await rl.question(`${c.cyan("?")} ${c.bold(question)} ${c.dim(`${hint} `)}`)
  )
    .trim()
    .toLowerCase();

  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

export async function configureFeatures(targetDir: string): Promise<void> {
  step("Configuring optional features");

  if (!input.isTTY) {
    info("Non-interactive shell detected; keeping all features.");
    return;
  }

  const rl = readline.createInterface({ input, output });
  const dropped: string[] = [];

  try {
    const keepBlog = await confirm(rl, "Keep the blog feature?");
    if (!keepBlog) {
      removeBlog(targetDir);
      ok("Removed the blog feature");
      dropped.push("blog");
    }

    const keepFaq = await confirm(rl, "Keep the FAQ feature?");
    if (!keepFaq) {
      removeFaq(targetDir);
      ok("Removed the FAQ feature");
      dropped.push("faq");
    }

    const keepIntegration = await confirm(rl, "Keep the integration catalog?");
    if (!keepIntegration) {
      removeIntegration(targetDir);
      ok("Removed the integration catalog");
      dropped.push("integrations");
    }

    const keepEvents = await confirm(rl, "Keep the events feature?");
    if (!keepEvents) {
      removeEvents(targetDir);
      ok("Removed the events feature");
      dropped.push("events");
    }

    cleanupNav(targetDir, {
      blog: !keepBlog,
      faq: !keepFaq,
      integration: !keepIntegration,
      events: !keepEvents,
    });

    cleanupContentConfig(targetDir);

    const useCloudflare = await confirm(
      rl,
      "Will you host on Cloudflare Workers?",
    );
    if (!useCloudflare) {
      removeCloudflare(targetDir);
      ok("Removed Cloudflare-specific setup");
      dropped.push("cloudflare");
    }

    updateDroppedFeatures(targetDir, dropped);
    if (dropped.length > 0) {
      ok(`Recorded dropped features: ${dropped.join(", ")}`);
    }
  } finally {
    rl.close();
  }
}
