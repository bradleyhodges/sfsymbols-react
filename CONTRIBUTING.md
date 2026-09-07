# Verifying unpublished packages

Pack companion packages without running lifecycle scripts, pack this package normally so `prepack` validates its build, then install the tarballs in clean React consumers. Paths are supplied on the command line and are never stored in package metadata:

```bash
npm pack --ignore-scripts /path/to/sfsymbols-types
npm pack --ignore-scripts /path/to/sfsymbols
npm pack --pack-destination /path/to/tarballs

node scripts/verify-package.cjs \
  --consumer react18=/path/to/react18-consumer \
  --consumer react19=/path/to/react19-consumer

node scripts/verify-typescript-fixture.cjs \
  --consumer /path/to/react18-consumer \
  --typescript-root /path/to/typescript-tooling

node scripts/verify-catalogue.cjs \
  --consumer /path/to/react19-consumer \
  --expected-count 8111 \
  --expected-sha256 b4054966f2455b6cbdaa0f0c7ceaf0a8326f602dd5b41ac96479643bc947fce7

node scripts/verify-next-fixture.cjs --consumer /path/to/next-consumer
node scripts/serve-browser-fixture.cjs --consumer /path/to/react19-consumer --port 4188
```

The catalogue command renders every installed export through both entries and compares names, complete icon data, viewBoxes, paths, fills, and opacity. The browser fixture uses real server rendering and hydration. The Next fixture runs production Webpack HTML/RSC checks and a production Turbopack prerender. Consumers must already contain the intended React, companion-package, and local wrapper tarballs.
