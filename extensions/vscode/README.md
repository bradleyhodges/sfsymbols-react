# SF Symbols Preview for VS Code

An optional local extension for projects using `@bradleyhodges/sfsymbols`. It adds a 96-pixel hover preview to imported icons and **SF Symbols: Preview and Import Icon** to the Command Palette. Search the exact `sf*` names, move through the results to load previews, and press Enter to add a named per-icon import:

```ts
import { sfArrowUpCircleFill } from '@bradleyhodges/sfsymbols/sfArrowUpCircleFill';
```

Existing named aliases and namespace imports are reused. A conflicting local name receives a numeric suffix, shown in the status bar. Type-only imports remain intact and do not count as usable values. Insertion preserves shebangs, directive prologues such as `"use client"`, existing imports and line endings. A cancelled picker or a document changed while the picker is open makes no edit.

## Local build and installation

This extension is separate from the React npm package. It adds no application dependency and contains no bundled icon catalogue. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm package
```

The result is `artifacts/sfsymbols-preview-0.1.0.vsix`. To install it yourself, run **Extensions: Install from VSIX…** in VS Code and select that file. Building or testing does not install or publish the extension. The nested pnpm workspace owns its lockfile and build-script policy; use commands from this directory without `--ignore-workspace`.

## Supported projects

- VS Code 1.95 or later, with a local saved JavaScript, JSX, TypeScript or TSX document.
- A normal npm/pnpm installation of `@bradleyhodges/sfsymbols` reachable through an ancestor `node_modules` directory. Package-level pnpm symlinks are supported.
- The package's `./sf*` conditional ESM export layout (`./dist/module/sf*.js`). Exact root and per-icon named imports, aliases and root namespace property references are recognized. CommonJS, re-export barrels, default imports, virtual files and custom module aliases are not recognized.
- Documents up to 1 MiB with complete syntax accepted by Babel's JavaScript/TypeScript/JSX parser. Incomplete or unsupported syntax is left untouched.

The extension does not execute workspace modules, run a package manager, or make network requests. It reads the manifest and parses leaf files as bounded static data, rejects executable expressions/getters/spreads and paths outside the real package directory, and loads geometry only for hovered or selected icons. SVG path commands, arc flags, viewBoxes, fills and opacity are validated. Empty non-rendering paths in the catalogue are preserved. Previews use an explicit light/dark theme color and escaped SVG in extension-owned storage; hover Markdown is untrusted with HTML disabled.

Limits are 64 KiB per leaf, 256 KiB per manifest, 20,000 icons, 40,000 directory entries, 128 paths per icon, 32 KiB per path, 32 levels / 10,000 evaluated static nodes, eight cached catalogue directories (30-second expiry), 16 queued previews and 128 SVG files per activation. Cached previews are disposed at shutdown. A package update appears in the catalogue within 30 seconds; geometry is read afresh when requested. Diagnostics are available in the **SF Symbols** Output channel.

## Verification

```sh
pnpm test:corpus /path/to/installed/consumer/example.tsx
```

This reads every installed leaf as data and renders its safe SVG without importing any package JavaScript. The current local 8.1.1-rc.0 corpus has been checked: 8,111 exports and 14,740 paths.

For an isolated extension-development host, set `VSCODE_EXECUTABLE` to your existing VS Code executable, then run:

```sh
pnpm build
pnpm test:host
```

Without that variable, Microsoft's test runner can download a test version. The test host uses temporary user-data, workspace and extension directories. It verifies actual hover-provider output, local SVG safety, QuickPick acceptance/cancellation, changed-document protection, editor imports, duplicate prevention, cache eviction and disposal. It does not alter your regular settings or install the extension. Native visual inspection remains a separate manual check.

For keybindings or other extensions, `sfsymbols.insertIcon` accepts an optional exact icon-name string to bypass the picker; that name must exist in the installed catalogue.
