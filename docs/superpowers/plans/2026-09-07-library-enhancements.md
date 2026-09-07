# SF Symbols React Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement the accepted audit recommendations while preserving existing icon names, exports, geometry, ref behavior, and class overrides.

**Architecture:** Share one memoized, ref-forwarding SVG renderer between the existing styled entry and a new unstyled entry. Add public types and metadata helpers without narrowing the companion package's legacy types. Build and verify both module formats in staging, then replace dist; supply an optional editor extension separately from the application runtime.

**Tech Stack:** TypeScript, React 18/19, Node test runner, pnpm, esbuild for verification/editor builds, VS Code API for the optional extension.

**Spec:** The user-approved audit at C:/Users/bradley/.codex/visualizations/2026/09/07/01a07a3f-0cda-7c42-befb-ea6db98ee52d/sfsymbols-react-audit.md and the explicit instruction to implement its changes.

## Global Constraints

- Keep named and default SFIcon exports and all existing icon exports/names/aliases unchanged.
- Never edit sibling icons or its SVG geometry/metadata; test local icon and types packages through packed consumers.
- Preserve legacy color/fillOpacity/weight behavior, class conflict resolution, square default viewports, and SVG ref forwarding.
- Preserve explicit size={0}, native dimension/style/class overrides, and explicit ARIA overrides.
- React is a host peer; verify React 18 and 19. Do not add use client without evidence it is needed.
- New APIs are additive. Do not narrow IconDefinition or legacy SFIconProps from the companion types package.
- No publication, deployment, extension installation, or pushes. Commit coherent completed changes with Conventional Commits.
- Tests use tracked tests/; existing ignored test/ contains an unrelated generated fixture.

## Task 1: Shared renderer, additive APIs, metadata helpers

**Files:** src/index.tsx, src/unstyled.tsx, src/create-icon.tsx, src/types.ts, src/metadata.ts; tests/component.test.cjs, tests/metadata.test.cjs.

**Interfaces:** Both entries export SFIcon and default, backed by one createSFIcon implementation; both re-export public types. Styled entry uses cn; unstyled entry never imports cn. Public SFIconProps extends the legacy companion props, adding native width/height, description, titleId, descriptionId, svgChildren, preservePathOpacity, and pathProps. SFIconPathProps excludes d/key/ref/children/dangerouslySetInnerHTML. pathProps can be a props object or a function of original path and index. Export IconDefinition/SFIconVariant and new SFIconPath/SFIconKeyword types. Export getIconKeywords(icon) and getIconVariants(icon) from root and metadata entry.

- [ ] Write red tests against the current emitted component. Zero definition dimensions must render 1em; explicit size 0 stays 0. Positive definition dimensions retain their legacy fallback. Native dimensions override size. Existing classes merge as before; omit only the default h-[1em] class when an explicit size or height is supplied, allowing the actual height attribute to work while user sizing classes remain authoritative.
- [ ] Prove external aria-labelledby alone no longer hides a named SVG; explicit aria-hidden/role/label references retain precedence. useId stays unconditional; titleId/descriptionId overrides and description links are deterministic. Legacy children remain ignored; svgChildren explicitly composes defs/children before paths.
- [ ] Implement one shared renderer with memo, forwardRef, path/class memoization, original path key behavior, and no client-only features. Preserve path geometry and source fill/opacity by default. preservePathOpacity opts out of the legacy weight opacity=1 default; explicit fillOpacity still wins. Explicit pathProps styles override generated path styling, but cannot replace d, key, ref, children or inject inner HTML at runtime.
- [ ] Add metadata tests using real-shaped keyword arrays, legacy dictionaries, null/invalid inputs, optional custom variant names, and mutation checks. Helpers return readonly typed views/copies, validate rather than assume legacy {} unions, preserve source order and caller data, and handle inherited/untrusted object properties safely. Legacy dictionary string values become keyword text; absent generic/priority remain absent.
- [ ] Add type-only exports, JSDoc for public APIs, and a separate unstyled entry with exactly the same SVG contract and caller className passed through unchanged.
- [ ] Run the existing build, focused tests and typecheck. Commit source/tests plus regenerated outputs after validation; packaging changes follow separately.

Example contract assertions:

```js
assert.match(render({ icon: zeroDimensions }), /width="1em" height="1em"/);
assert.match(render({ icon: zeroDimensions, size: 0 }), /width="0" height="0"/);
assert.match(render({ icon: zeroDimensions, 'aria-labelledby': 'label' }), /aria-hidden="false"/);
assert.deepEqual(getIconVariants({ ...icon, variants: { fill: 'sfCircleFill', bad: 2 } }), { fill: 'sfCircleFill' });
```

## Task 2: Production dependencies and staged package build

**Files:** package.json, pnpm-lock.yaml, tsconfig.json, scripts/build.cjs, scripts/verify-package.cjs, tests/build.test.cjs, tests/package.test.cjs; emitted dist files.

**Consumes:** Task 1 entries index, unstyled, metadata and types. **Produces:** explicit import/require type conditions for each public path, root and nested sideEffects metadata, valid ESM package boundary, declaration maps resolving to included source files, release verification scripts.

- [ ] Add tests that fail on accidental cn inclusion in unstyled, retention of an unused named import, missing default/named exports, missing declarations/maps, or invalid native ESM/CJS imports.
- [ ] Move react to peerDependencies (range based on the verified React 18/19 matrix) and devDependencies. Remove next/react-dom/@types/node/tailwind-merge runtime dependencies; keep only needed development tools. Keep the types dependency compatible with published 8.0.4 and local 8.1.0 using ^8.0.4; independently verify 8.1.0 packed inputs. Set the React package version to 8.1.0 for these additive features.
- [ ] Replace duplicate tsc/clean-first build with staging under build-out, two real compiler passes, correct final declaration-map source paths, module markers, output validation, bounded Windows rename retry, rollback if replacement fails, and checked cleanup paths. A compiler/validation failure must preserve the previous dist.
- [ ] Include dist, referenced src, README/LICENSE/changelog only in npm package. Wire build and verification into prepack without recursive lifecycle invocation; retain an explicit publish command but never execute it.
- [ ] Build actual packed consumers: use npm pack --ignore-scripts where nested packing is required, then install local tarballs. Validate React 18/19, TypeScript consumer modes, native Node ESM/CommonJS and esbuild bundle boundaries. Assert all existing icon names/data remain unchanged when rendering the local catalogue.
- [ ] Run meaningful build-failure regression tests, install/lockfile validation, typecheck, lint, tests, and package checks. Commit completed build/dependency changes.

## Task 3: Optional VS Code icon previews and imports

**Files:** extensions/vscode/ (separate extension manifest, TypeScript implementation, tests, build/package scripts and documentation).

**Consumes:** installed @bradleyhodges/sfsymbols package metadata/ESM leaf files; existing sf* export names. **Produces:** local VSIX with hover previews and a searchable command inserting exact per-icon imports; no runtime dependency of the React package.

- [ ] Read current VS Code and parser documentation through Context7. Write red tests for constrained static icon-data parsing, module resolution, XML/Markdown escaping, import alias handling, duplicate imports and insertion placement.
- [ ] Read icon files as data using a real JS parser; never require/eval/import workspace JS. Only interpret bounded static literals/arrays/object/identifier references needed for generated icons. Reject calls, getters, unsupported constructs, invalid geometry/viewBoxes and excessive files. Resolve the installed icon package from the active document/workspace without running its code.
- [ ] Implement hover previews for recognized icon imports and Quick Pick commands for previews/import insertion. Use exact existing names and direct import paths, preserve aliases and existing imports, respect document changes/cancellation, and avoid eager loading all SVGs. Write escaped SVG previews only to extension-owned cache, use untrusted Markdown, no network resources/scripts. Dispose watchers/providers and bound caches.
- [ ] Keep the extension optional, separate from root package files/dependencies, and document local VSIX installation and supported inputs. Package it locally and verify its contents and extension-host behavior where tools permit. Do not install or publish it.
- [ ] Run extension tests/typecheck/build/package and commit completed work.

## Task 4: Integration, developer documentation and final verification

**Files:** README.md, CHANGELOG.md, tests/browser/, tests/integration/, scripts for reproducible local package/corpus checks; release artifacts.

- [ ] Document every existing/additive prop and precedence, styled versus unstyled behavior, direct imports, metadata helpers, React peer support, SVG composition, opacity-preserving strokes, editor workflows and local unpublished-package verification.
- [ ] Run a real browser SSR/hydration fixture covering refs/events, unique/custom title/description IDs, explicit ARIA, size 0/default/24, native dimensions, class/style overrides, palette/pathProps and SVG defs. Test both entry points and preserve source paths/opacity unless explicitly overridden.
- [ ] Verify packed consumer import/type/bundle matrix and local 8.1 types/icons; verify Next App Router server rendering for the actual final package. Compare baseline icon export inventory and data hashes; no icon changes are allowed.
- [ ] Re-run react-doctor, scoped lint/typecheck/tests/build/pack. Fix regressions; distinguish scanner policy suggestions from actual package defects.
- [ ] Obtain whole-branch review, address findings, commit coherent integration/docs changes, and report measured sizes, tests, commits, locations, and real limits. Leave work available for review without pushing/publishing.
