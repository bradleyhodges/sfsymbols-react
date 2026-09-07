"use strict";

const {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} = require("node:fs");
const {
    basename,
    dirname,
    isAbsolute,
    relative,
    resolve,
    sep,
} = require("node:path");
const { spawnSync } = require("node:child_process");

const ENTRY_POINTS = ["index", "unstyled", "metadata", "types"];
const RETRYABLE_RENAME_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);
const MAX_RENAME_ATTEMPTS = 5;

function parseProjectRoot(args) {
    if (args.length === 0) return resolve(__dirname, "..");
    if (args.length === 2 && args[0] === "--project-root") {
        return resolve(args[1]);
    }
    throw new Error("Usage: node scripts/build.cjs [--project-root <path>]");
}

function buildPaths(projectRoot) {
    const root = resolve(projectRoot);
    const stageRoot = resolve(root, "build-out");
    const stagedDist = resolve(stageRoot, "package");
    const previousDist = resolve(stageRoot, "previous-dist");
    const dist = resolve(root, "dist");
    if (
        dirname(stageRoot) !== root ||
        basename(stageRoot) !== "build-out" ||
        dirname(dist) !== root ||
        basename(dist) !== "dist" ||
        dirname(stagedDist) !== stageRoot ||
        dirname(previousDist) !== stageRoot
    ) {
        throw new Error(`Unsafe build paths beneath ${root}`);
    }
    return { root, stageRoot, stagedDist, previousDist, dist };
}

function assertProjectRoot(projectRoot) {
    const manifestPath = resolve(projectRoot, "package.json");
    let packageJson;
    try {
        packageJson = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
        throw new Error(
            `${projectRoot} is not an @bradleyhodges/sfsymbols-react project`,
        );
    }
    if (packageJson.name !== "@bradleyhodges/sfsymbols-react") {
        throw new Error(
            `${projectRoot} is not an @bradleyhodges/sfsymbols-react project`,
        );
    }
    for (const path of ["src", "tsconfig.json", "tsconfig.main.json"]) {
        if (!existsSync(resolve(projectRoot, path))) {
            throw new Error(`Project root is missing ${path}: ${projectRoot}`);
        }
    }
}

function removeChecked(target, allowedPaths) {
    const resolvedTarget = resolve(target);
    if (!allowedPaths.has(resolvedTarget)) {
        throw new Error(`Refusing to remove unowned path: ${resolvedTarget}`);
    }
    rmSync(resolvedTarget, { recursive: true, force: true });
}

function pause(milliseconds) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function renameWithRetry(
    source,
    destination,
    {
        rename = renameSync,
        wait = pause,
        maxAttempts = MAX_RENAME_ATTEMPTS,
    } = {},
) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            rename(source, destination);
            return;
        } catch (error) {
            if (
                !RETRYABLE_RENAME_CODES.has(error.code) ||
                attempt === maxAttempts
            ) {
                throw error;
            }
            wait(20 * 2 ** (attempt - 1));
        }
    }
}

function runCompiler({ root, config, outDir, tscPath }) {
    const result = spawnSync(
        process.execPath,
        [
            tscPath,
            "-p",
            resolve(root, config),
            "--outDir",
            outDir,
            "--declarationMap",
            "true",
        ],
        { cwd: root, encoding: "utf8" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(
            `Compiler failed for ${config}.\n${result.stdout}${result.stderr}`,
        );
    }
}

function filesWithSuffix(directory, suffix) {
    const files = [];
    const pending = [directory];
    while (pending.length > 0) {
        const current = pending.pop();
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const path = resolve(current, entry.name);
            if (entry.isDirectory()) pending.push(path);
            else if (entry.isFile() && entry.name.endsWith(suffix)) {
                files.push(path);
            }
        }
    }
    return files;
}

function relocateDeclarationMaps(paths) {
    for (const format of ["module", "main"]) {
        const stagedFormat = resolve(paths.stagedDist, format);
        for (const stagedMapPath of filesWithSuffix(
            stagedFormat,
            ".d.ts.map",
        )) {
            const finalMapDirectory = dirname(
                resolve(
                    paths.dist,
                    format,
                    relative(stagedFormat, stagedMapPath),
                ),
            );
            const map = JSON.parse(readFileSync(stagedMapPath, "utf8"));
            map.sources = map.sources.map((source) => {
                const absoluteSource = resolve(
                    dirname(stagedMapPath),
                    map.sourceRoot || "",
                    source,
                );
                return relative(finalMapDirectory, absoluteSource).replaceAll(
                    sep,
                    "/",
                );
            });
            map.sourceRoot = undefined;
            writeFileSync(stagedMapPath, JSON.stringify(map));
        }
    }
}

function assertFile(path) {
    if (!existsSync(path)) throw new Error(`Missing output: ${path}`);
}

function assertExports(path, format, entry) {
    const source = readFileSync(path, "utf8");
    if (entry === "index" || entry === "unstyled") {
        const named =
            format === "module"
                ? /(?:export\s+const\s+SFIcon\b|export\s*\{[^}]*\bSFIcon\b)/.test(
                      source,
                  )
                : /(?:exports\.SFIcon\b|Object\.defineProperty\(exports,\s*["']SFIcon["'])/.test(
                      source,
                  );
        const defaultExport =
            format === "module"
                ? /(?:export\s+default\s+SFIcon\b|export\s*\{[^}]*\bdefault\b)/.test(
                      source,
                  )
                : /(?:exports\.default\b|Object\.defineProperty\(exports,\s*["']default["'])/.test(
                      source,
                  );
        if (!named || !defaultExport) {
            throw new Error(`${entry} is missing named/default SFIcon exports`);
        }
    }
    if (entry === "metadata") {
        for (const name of ["getIconKeywords", "getIconVariants"]) {
            if (!source.includes(name)) {
                throw new Error(`metadata is missing ${name}`);
            }
        }
    }
}

function localDependencies(source) {
    const dependencies = [];
    const matcher = /(?:from\s+|require\s*\()(["'])(\.\.?\/[^"']+)\1/g;
    for (const match of source.matchAll(matcher)) dependencies.push(match[2]);
    return dependencies;
}

function assertUnstyledBoundary(entryPath) {
    const pending = [entryPath];
    const visited = new Set();
    while (pending.length > 0) {
        const file = pending.pop();
        if (visited.has(file)) continue;
        visited.add(file);
        const source = readFileSync(file, "utf8");
        if (/(?:from\s+["']cn["']|require\s*\(\s*["']cn["'])/.test(source)) {
            throw new Error(`Unstyled entry reaches cn through ${file}`);
        }
        for (const dependency of localDependencies(source)) {
            const candidate = resolve(dirname(file), dependency);
            if (existsSync(candidate)) pending.push(candidate);
        }
    }
}

function runNativeCheck(args, label) {
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`${label} failed.\n${result.stdout}${result.stderr}`);
    }
}

function assertNativeModules(paths) {
    const entries = Object.fromEntries(
        ENTRY_POINTS.map((entry) => [
            entry,
            resolve(paths.stagedDist, "main", `${entry}.js`),
        ]),
    );
    const checkExports = `const assert=require("node:assert/strict");const entries=JSON.parse(process.argv[1]);for(const [name,file] of Object.entries(entries)){const api=require(file);if(name==="index"||name==="unstyled"){assert.ok(api.SFIcon);assert.equal(api.default,api.SFIcon)}if(name==="metadata"){assert.equal(typeof api.getIconKeywords,"function");assert.equal(typeof api.getIconVariants,"function")}}`;
    runNativeCheck(
        ["-e", checkExports, JSON.stringify(entries)],
        "Native CommonJS validation",
    );

    const moduleEntries = Object.fromEntries(
        ENTRY_POINTS.map((entry) => [
            entry,
            resolve(paths.stagedDist, "module", `${entry}.js`),
        ]),
    );
    const checkImports = `import assert from "node:assert/strict";import {pathToFileURL} from "node:url";const entries=JSON.parse(process.argv[1]);for(const [name,file] of Object.entries(entries)){const api=await import(pathToFileURL(file).href);if(name==="index"||name==="unstyled"){assert.ok(api.SFIcon);assert.equal(api.default,api.SFIcon)}if(name==="metadata"){assert.equal(typeof api.getIconKeywords,"function");assert.equal(typeof api.getIconVariants,"function")}}`;
    runNativeCheck(
        [
            "--input-type=module",
            "-e",
            checkImports,
            JSON.stringify(moduleEntries),
        ],
        "Native ESM validation",
    );
}

function validateOutput(paths) {
    try {
        for (const format of ["module", "main"]) {
            for (const entry of ENTRY_POINTS) {
                const base = resolve(paths.stagedDist, format, entry);
                for (const suffix of ["js", "d.ts", "d.ts.map"]) {
                    assertFile(`${base}.${suffix}`);
                }
                assertExports(`${base}.js`, format, entry);
            }
            const stagedFormat = resolve(paths.stagedDist, format);
            for (const mapPath of filesWithSuffix(stagedFormat, ".d.ts.map")) {
                const map = JSON.parse(readFileSync(mapPath, "utf8"));
                if (!Array.isArray(map.sources) || map.sources.length === 0) {
                    throw new Error(
                        `Declaration map has no sources: ${mapPath}`,
                    );
                }
                for (const source of map.sources) {
                    const finalMapDirectory = dirname(
                        resolve(
                            paths.dist,
                            format,
                            relative(stagedFormat, mapPath),
                        ),
                    );
                    const sourcePath = resolve(
                        finalMapDirectory,
                        map.sourceRoot || "",
                        source,
                    );
                    const sourceRelative = relative(paths.root, sourcePath);
                    if (
                        sourceRelative.startsWith("..") ||
                        isAbsolute(sourceRelative) ||
                        !sourceRelative.startsWith(`src${sep}`) ||
                        !existsSync(sourcePath)
                    ) {
                        throw new Error(
                            `Declaration map does not resolve to shipped source: ${sourcePath}`,
                        );
                    }
                }
            }
        }
        assertUnstyledBoundary(resolve(paths.stagedDist, "module/unstyled.js"));
        assertUnstyledBoundary(resolve(paths.stagedDist, "main/unstyled.js"));
        assertNativeModules(paths);
    } catch (error) {
        throw new Error(`Validation failed: ${error.message}`, {
            cause: error,
        });
    }
}

function writeModuleMarkers(stagedDist) {
    writeFileSync(
        resolve(stagedDist, "module/package.json"),
        `${JSON.stringify({ type: "module", sideEffects: false }, null, 4)}\n`,
    );
    writeFileSync(
        resolve(stagedDist, "main/package.json"),
        `${JSON.stringify({ type: "commonjs", sideEffects: false }, null, 4)}\n`,
    );
}

function replaceDist(paths) {
    let previousMoved = false;
    if (existsSync(paths.dist)) {
        renameWithRetry(paths.dist, paths.previousDist);
        previousMoved = true;
    }
    try {
        renameWithRetry(paths.stagedDist, paths.dist);
    } catch (replacementError) {
        if (previousMoved) {
            try {
                renameWithRetry(paths.previousDist, paths.dist);
            } catch (rollbackError) {
                throw new AggregateError(
                    [replacementError, rollbackError],
                    `Dist replacement and rollback failed; previous dist remains at ${paths.previousDist}`,
                );
            }
        }
        throw replacementError;
    }
}

function buildPackage(projectRoot) {
    assertProjectRoot(projectRoot);
    const paths = buildPaths(projectRoot);
    const allowedRemovals = new Set([paths.stageRoot, paths.previousDist]);
    let keepStageForRecovery = false;
    removeChecked(paths.stageRoot, allowedRemovals);
    mkdirSync(resolve(paths.stagedDist, "module"), { recursive: true });
    mkdirSync(resolve(paths.stagedDist, "main"), { recursive: true });

    try {
        const tscPath = resolve(
            require.resolve("typescript/package.json"),
            "../bin/tsc",
        );
        runCompiler({
            root: paths.root,
            config: "tsconfig.json",
            outDir: resolve(paths.stagedDist, "module"),
            tscPath,
        });
        runCompiler({
            root: paths.root,
            config: "tsconfig.main.json",
            outDir: resolve(paths.stagedDist, "main"),
            tscPath,
        });
        relocateDeclarationMaps(paths);
        writeModuleMarkers(paths.stagedDist);
        validateOutput(paths);
        try {
            replaceDist(paths);
        } catch (error) {
            keepStageForRecovery =
                existsSync(paths.previousDist) && !existsSync(paths.dist);
            throw error;
        }
        if (existsSync(paths.previousDist)) {
            removeChecked(paths.previousDist, allowedRemovals);
        }
        removeChecked(paths.stageRoot, allowedRemovals);
        return paths.dist;
    } catch (error) {
        if (!keepStageForRecovery && existsSync(paths.stageRoot)) {
            removeChecked(paths.stageRoot, allowedRemovals);
        }
        throw error;
    }
}

if (require.main === module) {
    try {
        const projectRoot = parseProjectRoot(process.argv.slice(2));
        const dist = buildPackage(projectRoot);
        console.log(`Built and validated ${dist}`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

module.exports = {
    buildPackage,
    renameWithRetry,
    replaceDist,
    validateOutput,
};
