# create-stardrive

Launchpad to start the Astro Stardrive boilerplate.

For current generated Astro projects, use patched Node 22.23.4+, 24.22.1+, or 26.12.1+. This repository pins Node 24.22.1 for development and CI. The CLI's own `>=18` engine declaration is separate from the generated project's Node requirement; generating a project does not upgrade your runtime.

It helps you getting Stardrive installed and also auto-adjusts some details for better fit.

<br />

Simply run:

```sh
npm create stardrive@latest
```

*or*

```sh
pnpm create stardrive@latest
```

*or*

```sh
yarn create stardrive@latest
```

*or*

```sh
bun create stardrive@latest
```

<br />

> [!TIP]
> Use the flag `--no-install` to skip the dependency install.
> Use the flag `--version X.X.X` to use a specific version.

<br />

Alternatively, you can also always simply fork/clone the original repository at [github.com/peltmonger/stardrive](https://github.com/peltmonger/stardrive).

For every following step, please also consult the original repository!

**Happy launching!** 🚀

## Maintainer validation

- `npm run typecheck` and `npm run build` validate the CLI.
- `npm test` checks buffered wizard answers through a real terminal; the Python PTY check covers answers sent one prompt at a time on macOS in CI. Both protect supported interaction modes.
- `node scripts/smoke-generated-project.mjs` checks scaffolding and feature removal, then installs, checks, and builds the trimmed site. `--skip-install` runs only the structural checks.
- The smoke script pins a released Stardrive version for reproducibility. Refresh the pin when a release changes generated-project behavior, and verify the new baseline before merging. It is a tested compatibility baseline, not a claim to test every release.
- For an unreleased template, set `STARDRIVE_TEMPLATE_DIR` to a source checkout and run the same smoke script. This test-only path applies the existing starter transforms without changing CLI release selection or publishing a tag. It checks the candidate version and Node policy, and installs, checks, and builds both default and trimmed output unless `--skip-install` is passed. The candidate CI job pins the Stardrive security PR commit; update that SHA only after reviewing a new candidate.
- Boilerplate repository workflows, published agent skills, and their artifact verifier are not carried into generated sites. Site-level type checks, lint, and build scripts remain available.

