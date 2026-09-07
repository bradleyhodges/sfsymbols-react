"use strict";

const assert = require("node:assert/strict");
const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { dirname, isAbsolute, relative, resolve, sep } = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const ENTRY_POINTS = ["index", "unstyled", "metadata", "types"];
const PUBLIC_PATHS = [".", "./unstyled", "./metadata", "./types"];

function parseConsumers(args) {
    const consumers = [];
    for (let index = 0; index < args.length; index++) {
        if (args[index] !== "--consumer" || index + 1 >= args.length) {
            throw new Error(
                "Usage: node scripts/verify-package.cjs [--consumer <label>=<path>]...",
            );
        }
        const value = args[++index];
        const separator = value.indexOf("=");
        if (separator <= 0 || separator === value.length - 1) {
            throw new Error(`Invalid consumer: ${value}`);
        }
        consumers.push({
            label: value.slice(0, separator),
            path: resolve(value.slice(separator + 1)),
        });
    }
    return consumers;
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function assertModuleMarker(root, format, type) {
    assert.deepEqual(readJson(resolve(root, `dist/${format}/package.json`)), {
        type,
        sideEffects: false,
    });
}

function assertDeclarationMaps(root) {
    for (const format of ["module", "main"]) {
        const formatDirectory = resolve(root, `dist/${format}`);
        const mapPaths = readdirSync(formatDirectory)
            .filter((file) => file.endsWith(".d.ts.map"))
            .map((file) => resolve(formatDirectory, file));
        assert.ok(mapPaths.length >= ENTRY_POINTS.length);
        for (const mapPath of mapPaths) {
            const declaration = mapPath.slice(0, -4);
            assert.ok(existsSync(declaration), `Missing ${declaration}`);
            const map = readJson(mapPath);
            assert.ok(map.sources.length > 0, `${mapPath} has no sources`);
            for (const source of map.sources) {
                const sourcePath = resolve(
                    dirname(mapPath),
                    map.sourceRoot || "",
                    source,
                );
                const sourceRelative = relative(root, sourcePath);
                assert.ok(
                    !sourceRelative.startsWith("..") &&
                        !isAbsolute(sourceRelative) &&
                        sourceRelative.startsWith(`src${sep}`) &&
                        existsSync(sourcePath),
                    `${mapPath} does not resolve to shipped source: ${sourcePath}`,
                );
            }
        }
    }
}

function moduleDependencies(source) {
    const dependencies = [];
    const esmMatcher =
        /(?:^|[;\r\n])\s*(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?(["'])([^"']+)\1/g;
    for (const match of source.matchAll(esmMatcher))
        dependencies.push(match[2]);
    const commonJsMatcher = /\brequire\s*\(\s*(["'])([^"']+)\1\s*\)/g;
    for (const match of source.matchAll(commonJsMatcher)) {
        dependencies.push(match[2]);
    }
    return dependencies;
}

function assertDependencyBoundary(entryPath, forbiddenPackage) {
    const pending = [entryPath];
    const visited = new Set();
    while (pending.length > 0) {
        const file = pending.pop();
        if (visited.has(file)) continue;
        visited.add(file);
        const source = readFileSync(file, "utf8");
        for (const dependency of moduleDependencies(source)) {
            assert.ok(
                dependency !== forbiddenPackage &&
                    !dependency.startsWith(`${forbiddenPackage}/`),
                `${entryPath} reaches ${forbiddenPackage} through ${file}`,
            );
            if (!dependency.startsWith(".")) continue;
            const candidate = resolve(dirname(file), dependency);
            if (existsSync(candidate)) pending.push(candidate);
        }
    }
}

function assertPackageMetadata(root) {
    const packageJson = readJson(resolve(root, "package.json"));
    assert.match(
        packageJson.version,
        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
        "package version must be release-compatible semver",
    );
    assert.equal(packageJson.sideEffects, false);
    assert.deepEqual(Object.keys(packageJson.exports), PUBLIC_PATHS);
    assert.deepEqual(packageJson.peerDependencies, {
        react: "^18.0.0 || ^19.0.0",
    });
    assert.deepEqual(packageJson.dependencies, {
        "@bradleyhodges/sfsymbols-types": "^8.0.4",
        cn: "^0.2.5",
    });
    for (const publicPath of PUBLIC_PATHS) {
        for (const condition of ["import", "require"]) {
            const target = packageJson.exports[publicPath][condition];
            assert.equal(typeof target.types, "string");
            assert.equal(typeof target.default, "string");
            assert.ok(existsSync(resolve(root, target.types)));
            assert.ok(existsSync(resolve(root, target.default)));
        }
    }
}

function assertCommonJs(packageName) {
    for (const publicPath of PUBLIC_PATHS) {
        const suffix = publicPath === "." ? "" : publicPath.slice(1);
        const api = require(`${packageName}${suffix}`);
        if (publicPath === "." || publicPath === "./unstyled") {
            assert.ok(api.SFIcon);
            assert.equal(api.default, api.SFIcon);
        }
        if (publicPath === "./metadata") {
            assert.equal(typeof api.getIconKeywords, "function");
            assert.equal(typeof api.getIconVariants, "function");
        }
    }
}

async function assertEsm(packageName) {
    for (const publicPath of PUBLIC_PATHS) {
        const suffix = publicPath === "." ? "" : publicPath.slice(1);
        const api = await import(`${packageName}${suffix}`);
        if (publicPath === "." || publicPath === "./unstyled") {
            assert.ok(api.SFIcon);
            assert.equal(api.default, api.SFIcon);
        }
        if (publicPath === "./metadata") {
            assert.equal(typeof api.getIconKeywords, "function");
            assert.equal(typeof api.getIconVariants, "function");
        }
    }
}

async function verifyPackage(root = resolve(__dirname, "..")) {
    assertPackageMetadata(root);
    assertModuleMarker(root, "module", "module");
    assertModuleMarker(root, "main", "commonjs");
    assertDeclarationMaps(root);
    assertDependencyBoundary(resolve(root, "dist/module/unstyled.js"), "cn");
    assertDependencyBoundary(resolve(root, "dist/main/unstyled.js"), "cn");

    const packageName = readJson(resolve(root, "package.json")).name;
    assertCommonJs(packageName);
    await assertEsm(packageName);

    // Direct ESM loading proves that the nested type marker applies to emitted .js.
    await import(pathToFileURL(resolve(root, "dist/module/index.js")).href);
    return { entries: PUBLIC_PATHS.length, formats: 2 };
}

function runConsumerNode(consumer, args) {
    const result = spawnSync(process.execPath, args, {
        cwd: consumer,
        encoding: "utf8",
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stdout + result.stderr);
}

function verifyInstalledConsumer(packageName, consumer) {
    const reactPackage = readJson(
        resolve(consumer.path, "node_modules/react/package.json"),
    );
    const icon = JSON.stringify({
        width: 20,
        height: 20,
        viewBox: "0 0 20 20",
        svgPathData: [{ d: "M0 0h20v20z" }],
    });
    runConsumerNode(consumer.path, [
        "-e",
        `const assert=require("node:assert/strict");const React=require("react");const {renderToStaticMarkup}=require("react-dom/server");const root=require("${packageName}");const unstyled=require("${packageName}/unstyled");const metadata=require("${packageName}/metadata");require("${packageName}/types");assert.equal(root.default,root.SFIcon);assert.equal(unstyled.default,unstyled.SFIcon);assert.equal(typeof metadata.getIconKeywords,"function");assert.match(renderToStaticMarkup(React.createElement(root.SFIcon,{icon:${icon}})),/<svg/);`,
    ]);
    runConsumerNode(consumer.path, [
        "--input-type=module",
        "-e",
        `import assert from "node:assert/strict";import React from "react";import {renderToStaticMarkup} from "react-dom/server";import Root,{SFIcon} from "${packageName}";import Unstyled,{SFIcon as NamedUnstyled} from "${packageName}/unstyled";import {getIconVariants} from "${packageName}/metadata";import "${packageName}/types";assert.equal(Root,SFIcon);assert.equal(Unstyled,NamedUnstyled);assert.equal(typeof getIconVariants,"function");assert.match(renderToStaticMarkup(React.createElement(SFIcon,{icon:${icon}})),/<svg/);`,
    ]);
    return reactPackage.version;
}

if (require.main === module) {
    let consumers;
    try {
        consumers = parseConsumers(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
    if (consumers)
        verifyPackage()
            .then(({ entries, formats }) => {
                console.log(
                    `Package verification passed (${entries} entries, ${formats} module formats).`,
                );
                const packageName = readJson(
                    resolve(__dirname, "../package.json"),
                ).name;
                for (const consumer of consumers) {
                    const reactVersion = verifyInstalledConsumer(
                        packageName,
                        consumer,
                    );
                    console.log(
                        `Verified consumer ${consumer.label} (React ${reactVersion}).`,
                    );
                }
            })
            .catch((error) => {
                console.error(
                    error instanceof Error ? error.stack : String(error),
                );
                process.exitCode = 1;
            });
}

module.exports = {
    assertDependencyBoundary,
    verifyInstalledConsumer,
    verifyPackage,
};
