"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { copyFileSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { isAbsolute, relative, resolve } = require("node:path");

function requiredOption(name) {
    const index = process.argv.indexOf(name);
    const value = index === -1 ? undefined : process.argv[index + 1];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
}

const root = resolve(__dirname, "..");
const consumer = resolve(requiredOption("--consumer"));
const typescriptRoot = resolve(requiredOption("--typescript-root"));
const requireFromConsumer = createRequire(resolve(consumer, "package.json"));
for (const entry of [
    "@bradleyhodges/sfsymbols-react",
    "@bradleyhodges/sfsymbols-react/unstyled",
    "@bradleyhodges/sfsymbols-react/metadata",
    "react",
]) {
    const entryPath = requireFromConsumer.resolve(entry);
    const relativePath = relative(consumer, entryPath);
    assert.ok(
        relativePath &&
            !relativePath.startsWith("..") &&
            !isAbsolute(relativePath),
        `${entry} does not resolve inside the installed consumer`,
    );
}
const tsc = resolve(typescriptRoot, "node_modules/typescript/bin/tsc");
const fixture = mkdtempSync(resolve(consumer, ".sfsymbols-types-fixture-"));
try {
    copyFileSync(
        resolve(root, "tests/integration/types/consumer.tsx"),
        resolve(fixture, "consumer.tsx"),
    );
    writeFileSync(
        resolve(fixture, "package.json"),
        JSON.stringify({
            name: "sfsymbols-types-fixture",
            private: true,
            type: "module",
        }),
    );

    for (const [label, moduleName, resolution] of [
        ["node10", "commonjs", "node10"],
        ["nodeNext", "NodeNext", "NodeNext"],
        ["bundler", "esnext", "bundler"],
    ]) {
        const result = spawnSync(
            process.execPath,
            [
                tsc,
                "--noEmit",
                "--strict",
                "--esModuleInterop",
                "--jsx",
                "react-jsx",
                "--target",
                "es2020",
                "--module",
                moduleName,
                "--moduleResolution",
                resolution,
                resolve(fixture, "consumer.tsx"),
            ],
            { cwd: fixture, encoding: "utf8" },
        );
        assert.equal(
            result.status,
            0,
            `${label}: ${result.stdout}${result.stderr}`,
        );
    }
    console.log(
        "TypeScript verification passed: node10, NodeNext and bundler resolutions.",
    );
} finally {
    rmSync(fixture, { recursive: true, force: true });
}
