<div align="center">

<h1>@bradleyhodges/sfsymbols-react</h1>
<h3>Companion package for using Apple's SF Symbols icons from <a href="https://github.com/bradleyhodges/sfsymbols">@bradleyhodges/sfsymbols</a> in React/Next.js.</h3>

<p align="center">
				<a href="">
				<img alt="NPM Downloads by package author" src="https://img.shields.io/npm-stat/dm/bradleyhodges" />
				</a>
    <a href="https://www.npmjs.com/package/@bradleyhodges/sfsymbols-react">
				<img src="https://img.shields.io/badge/npmjs-package-red?logo=npm" alt="npmjs package" />
    </a>
    <a href="https://github.com/bradleyhodges/sfsymbols-react">
				<img src="https://img.shields.io/badge/github-repo-blue?logo=github" alt="GitHub repo" />
    </a>
    <br />
    <a href="https://github.com/bradleyhodges/sfsymbols/releases">
				<img src="https://img.shields.io/badge/version-8.1.1-blue.svg" alt="Version: 8.1.1" />
    </a>
				<a href="">
    <img src="https://img.shields.io/badge/Platforms-Next.js%20|%20React.js%20|%20React%20Native-FF69B4.svg" alt="Platforms: Next.js – React.js – React Nav" />
				</a>
    <a href="https://github.com/bradleyhodges/sfsymbols-react/blob/stable/LICENSE">
				<img src="https://img.shields.io/badge/license-MIT-lightgrey.svg" alt="License: MIT" />
    </a>
</p>

<p align="center">SF Symbols is a library of over 7,000 symbols that are designed to integrate seamlessly with San Francisco, the system font for Apple platforms.</p>

<p align="center">
  <a href="#available-icons">Available Icons</a>
  • <a href="#-getting-started">🚀 Getting Started</a>
  • <a href="#install-the-packages">Install</a>
  • <a href="#usage">Usage</a>
  • <a href="#optimising-for-performance">Optimising for Performance</a>
  • <a href="#styled-and-unstyled-entries">Style Entries</a>
  • <a href="#props-and-precedence">Props</a>
  • <a href="#optional-vs-code-previews">VS Code Extension</a>
  • <a href="https://github.com/bradleyhodges/sfsymbols-react/issues">Issues</a>
  • <a href="https://github.com/bradleyhodges/sfsymbols-react/pulls">Pull Requests</a>
</p>
</div>

> [!CAUTION]
> SF Symbols is licensed by Apple for use only on Apple platforms. **Use of this package, or any of the other @bradleyhodges/sfsymbols-\* packages, outside of Apple platforms is NOT permitted.**

## Available Icons
<a href="https://github.com/bradleyhodges/sfsymbols">@bradleyhodges/sfsymbols</a> contains 8,111 icons, which includes 609 supplementary brand icons. All 7,502 of the `Regular` weight icons from the [San Francisco font](https://github.com/bradleyhodges/SFWindows) are included. Other weights and variable icon directives are not included in this package, but the icon weights can be made heavier by applying a stroke to the vector paths.

For simplicity, **I've created a basic icon browser for this package, which you can access here: [bradleyhodges-sfsymbols.vercel.app](https://bradleyhodges-sfsymbols.vercel.app)**
[![Screenshot of a comment on a GitHub issue showing an image, added in the Markdown, of an Octocat smiling and raising a tentacle.](https://github.com/bradleyhodges/sfsymbols/blob/main/assets/icon-browser-screenshot.png?raw=true)](https://bradleyhodges-sfsymbols.vercel.app)

## 🚀 Getting Started

This package contains the React components and metadata helpers that allow you to use these icons in your React/Next.js project. The actual icons and icon data for SF Symbols 8 come from the [`sfsymbols` package](https://www.npmjs.com/package/@bradleyhodges/sfsymbols-react), which you'll need to install as well.

### Install the Packages

You will need to install the following packages to use the icons in your project:

- [`@bradleyhodges/sfsymbols`](https://www.npmjs.com/package/@bradleyhodges/sfsymbols) – Icon catalogue package (contains the actual icons).
- [`@bradleyhodges/sfsymbols-react`](https://www.npmjs.com/package/@bradleyhodges/sfsymbols-react) – React component wrapper for the using the icons in React/Next.js.

```bash
pnpm add @bradleyhodges/sfsymbols @bradleyhodges/sfsymbols-react
```

The component wrapper renders web DOM `<svg>` elements. **React Native applications need a native SVG renderer** instead. This library supports React 18 and 19.

## Usage

It's dead simple to get going. Once you've installed the above packages, you can simply import and use them:

```tsx
import SFIcon from "@bradleyhodges/sfsymbols-react";
import { sfArrowUpCircleFill, sfCheckmark, sfCrossVialFill } from "@bradleyhodges/sfsymbols";

function MyComponent() {
    return (
        <div>
            <SFIcon icon={sfArrowUpCircleFill} />;
            <SFIcon icon={sfCheckmark} weight={2} />
            <SFIcon icon={sfCrossVialFill} size={24} className="text-red-500" />
        </div>
    );
}
```

Use the [icon browser](https://bradleyhodges-sfsymbols.vercel.app) to find icons you want to use.

### Optimising for performance

The `default` and `SFIcon` exports are the same memoized, ref-forwarding component. For an opt-in direct icon import, use the exact `sf*` leaf path. This lets a bundler avoid parsing the catalogue's large root barrel:

```tsx
import { SFIcon } from "@bradleyhodges/sfsymbols-react";
import { sfArrowUpCircleFill } from "@bradleyhodges/sfsymbols/sfArrowUpCircleFill";

<SFIcon icon={sfArrowUpCircleFill} size={24} color="rebeccapurple" />;
```

Do not build an application registry that imports every icon merely to support runtime lookup. Import the icons used by the application, or load bounded groups on demand.

## Styled and unstyled entries

The root entry merges these compatibility classes with `className` by using the [`cn engine`](https://github.com/shadcn-ui/cn) with a default base class set: `inline-block align-middle overflow-visible text-current box-content h-[1em] -leading-[0.125em]`. The default `h-[1em]` class is omitted when `size` or a native `height` is supplied, and caller sizing utilities win class conflicts.

The unstyled entry renders the same SVG, paths, accessibility markup, ref, and events without importing `cn` or adding classes:

```tsx
import SFIcon from "@bradleyhodges/sfsymbols-react/unstyled";

<SFIcon icon={sfArrowUpCircleFill} className="icon" />;
```

Use the root entry for the established layout behavior. Use `/unstyled` when the application owns all SVG layout and wants the smaller boundary.

## Props and precedence

`SFIcon` accepts ordinary `React.SVGProps<SVGSVGElement>` plus the following props:

| Prop | Type | Behavior |
| --- | --- | --- |
| `icon` | `IconDefinition` | Required icon geometry and metadata. |
| `size` | `number \| string \| null` | Sets both dimensions unless a native dimension overrides it. Explicit `0` is preserved. |
| `width`, `height` | native SVG values | Override `size` independently. |
| `color` | CSS color | Overrides each path's source fill. |
| `weight` | `number \| null` | Adds root fill, stroke, stroke width and round joins. It is a stroke effect, not selection of Apple's native SF Symbols weights. |
| `fillOpacity` | `string \| number \| null` | Overrides source path opacity. With `weight`, the legacy default is `1`. |
| `preservePathOpacity` | `boolean` | Keeps source opacity when `weight` is set and `fillOpacity` is absent. |
| `className`, `style` | native SVG values | Apply to the SVG. The styled entry merges classes; ordinary CSS cascade and inline-style rules still apply. |
| `title` | `string` | Renders `<title>` and generates its linked ID. |
| `description` | `string` | Renders `<desc>` and generates its linked ID. A description alone does not name an image; also supply `title`, `aria-label`, or an external accessible name. |
| `titleId`, `descriptionId` | `string` | Replace the generated ID for the corresponding element. They have no effect when that element is absent. |
| `svgChildren` | `ReactNode` | Inserts SVG content such as `defs` before the icon paths. Legacy `children` remain ignored. |
| `pathProps` | path props or `(path, index) => path props` | Applies safe per-path presentation and event props after generated fill and opacity. |

Dimension precedence is native `width` or `height`, then `size`, then the icon's positive width, then its positive height, then `1em`. The definition fallback is deliberately square for compatibility. A zero definition dimension is not used as the fallback, while an explicit `size={0}`, `width={0}`, or `height={0}` remains zero.

Path fill precedence is `pathProps.fill`, `color`, source fill, then `currentColor`. Path opacity precedence is `pathProps.fillOpacity`, explicit `fillOpacity`, the legacy `weight` default unless `preservePathOpacity` is true, then source opacity. `pathProps.style` follows ordinary React style precedence. Geometry and child ownership stay with the renderer: `d`, `key`, `ref`, `children`, and `dangerouslySetInnerHTML` are excluded by the public type and filtered at runtime.

Native SVG props, including refs and event handlers, are forwarded. Explicit `role`, `aria-hidden`, `aria-label`, `aria-labelledby`, and `aria-describedby` override generated accessibility attributes. When `title` and `aria-label` are both present, the title's generated `aria-labelledby` takes naming precedence; explicitly override `aria-labelledby`, including with `aria-labelledby={undefined}`, when `aria-label` should supply the name. Without an accessible name the SVG is hidden; a title, `aria-label`, or external `aria-labelledby` makes it visible to accessibility APIs. Generated IDs are unique, stable across title removal and restoration, and can be replaced with deterministic IDs when server output needs them.

```tsx
const iconRef = React.createRef<SVGSVGElement>();

<SFIcon
    ref={iconRef}
    icon={sfArrowUpCircleFill}
    title="Upload"
    description="Moves the selected item upward"
    svgChildren={
        <defs>
            <linearGradient id="upload-gradient">...</linearGradient>
        </defs>
    }
    pathProps={(path, index) => ({
        fill: index === 0 ? "url(#upload-gradient)" : path.fill,
    })}
/>
```

Plain serializable props and SVG children can render through React Server Components. Functions such as `pathProps` callbacks and event handlers must be introduced on the client side under the application's normal Server/Client boundary; the package does not add a `use client` directive.

## Metadata helpers and types

The root and `/metadata` entries export `getIconKeywords` and `getIconVariants`. Both validate legacy catalogue shapes without mutating them, ignore inherited properties and accessors, preserve source order, and return frozen copies.

```ts
import {
    getIconKeywords,
    getIconVariants,
} from "@bradleyhodges/sfsymbols-react/metadata";

const keywords = getIconKeywords(sfArrowUpCircleFill);
const variants = getIconVariants<"custom">(sfArrowUpCircleFill);
```

Keyword arrays retain valid `text`, `generic`, and finite `priority` fields. Legacy string dictionaries become `{ text }` entries without invented metadata. Variant maps retain own string values and use a null prototype, so arbitrary absent custom names such as `toString` safely resolve to `undefined`. Convert with `{ ...variants }` when an API specifically requires an ordinary object prototype.

React Server Component props are one such boundary because React's serializable object form requires an ordinary object prototype:

```tsx
<ClientComponent variants={{ ...getIconVariants(icon) }} />
```

Public types are available from the root, `/unstyled`, and the type-only `/types` entry: `IconDefinition`, `SFIconProps`, `SFIconPathProps`, `SFIconPath`, `SFIconKeyword`, and `SFIconVariant`. The additive `SFIconProps` type keeps the companion package's legacy contract intact.

## Optional VS Code previews

The separate extension in [`extensions/vscode`](./extensions/vscode/README.md) provides local hover previews and **SF Symbols: Preview and Import Icon**. It parses installed icon leaves as bounded static data and inserts exact per-icon imports; it is not an application dependency and does not ship an icon registry.

To build a local VSIX without installing or publishing it:

```bash
cd extensions/vscode
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm package
```

Then choose **Extensions: Install from VSIX…** in VS Code and select `artifacts/sfsymbols-preview-0.1.0.vsix`. See the extension README for supported syntax, security boundaries, limits, corpus checks, and the isolated extension-host workflow.
