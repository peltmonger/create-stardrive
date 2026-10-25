# create-stardrive

Launchpad to start the Astro Stardrive boilerplate.

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
- Boilerplate repository workflows, published agent skills, and their artifact verifier are not carried into generated sites. Site-level type checks, lint, and build scripts remain available.

