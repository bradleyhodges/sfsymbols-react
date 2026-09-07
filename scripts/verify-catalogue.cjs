"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const { isAbsolute, relative, resolve } = require("node:path");

function requiredOption(name) {
    const index = process.argv.indexOf(name);
    const value = index === -1 ? undefined : process.argv[index + 1];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
}

const consumer = resolve(requiredOption("--consumer"));
const expectedCount = Number(requiredOption("--expected-count"));
const expectedHash = requiredOption("--expected-sha256");
assert.ok(Number.isSafeInteger(expectedCount) && expectedCount > 0);
assert.match(expectedHash, /^[a-f0-9]{64}$/);

const requireFromConsumer = createRequire(resolve(consumer, "package.json"));
for (const packageName of [
    "@bradleyhodges/sfsymbols-react",
    "@bradleyhodges/sfsymbols",
    "react",
    "react-dom/server",
]) {
    const packagePath = requireFromConsumer.resolve(packageName);
    const relativePath = relative(consumer, packagePath);
    assert.ok(
        relativePath &&
            !relativePath.startsWith("..") &&
            !isAbsolute(relativePath),
        `${packageName} does not resolve inside the installed consumer`,
    );
}

const React = requireFromConsumer("react");
const { renderToStaticMarkup } = requireFromConsumer("react-dom/server");
const icons = requireFromConsumer("@bradleyhodges/sfsymbols");
const styled = requireFromConsumer("@bradleyhodges/sfsymbols-react").SFIcon;
const unstyled = requireFromConsumer(
    "@bradleyhodges/sfsymbols-react/unstyled",
).SFIcon;
const entries = Object.entries(icons);
assert.equal(entries.length, expectedCount, "icon export inventory changed");
const dataHash = createHash("sha256");

function renderedPaths(markup) {
    return [...markup.matchAll(/<path\b[^>]*>/g)].map(([tag]) => ({
        d: /\bd="([^"]*)"/.exec(tag)?.[1],
        fill: /\bfill="([^"]*)"/.exec(tag)?.[1],
        fillOpacity: /\bfill-opacity="([^"]*)"/.exec(tag)?.[1],
    }));
}

for (const [name, icon] of entries) {
    dataHash.update(JSON.stringify([name, icon]));
    const expectedPaths = icon.svgPathData.map((path) => ({
        d: path.d,
        fill: path.fill ?? "currentColor",
        fillOpacity:
            path.fillOpacity === undefined
                ? undefined
                : String(path.fillOpacity),
    }));
    for (const [entryName, Icon] of [
        ["styled", styled],
        ["unstyled", unstyled],
    ]) {
        const markup = renderToStaticMarkup(
            React.createElement(Icon, { icon, size: 24 }),
        );
        assert.equal(
            /\bviewBox="([^"]*)"/.exec(markup)?.[1],
            icon.viewBox || `0 0 ${icon.width} ${icon.height}`,
            `${entryName} ${name}: viewBox changed`,
        );
        assert.deepEqual(
            renderedPaths(markup),
            expectedPaths,
            `${entryName} ${name}: geometry or default paint changed`,
        );
    }
}
assert.equal(
    dataHash.digest("hex"),
    expectedHash,
    "icon names or data changed",
);
console.log(
    `Catalogue verification passed: ${entries.length} exports rendered unchanged through both package entries.`,
);
