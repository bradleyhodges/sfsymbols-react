const assert = require("node:assert/strict");
const {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = resolve(__dirname, "..");
const buildScript = resolve(root, "scripts/build.cjs");
const { renameWithRetry, replaceDist } = require(buildScript);

function createProject() {
    const project = mkdtempSync(join(tmpdir(), "sfsymbols-react-build-"));
    cpSync(resolve(root, "src"), resolve(project, "src"), {
        recursive: true,
    });
    for (const file of [
        "package.json",
        "tsconfig.json",
        "tsconfig.main.json",
    ]) {
        cpSync(resolve(root, file), resolve(project, file));
    }
    symlinkSync(
        resolve(root, "node_modules"),
        resolve(project, "node_modules"),
        "junction",
    );
    mkdirSync(resolve(project, "dist"), { recursive: true });
    writeFileSync(resolve(project, "dist/sentinel.txt"), "previous release");
    return project;
}

function runBuild(project) {
    return spawnSync(
        process.execPath,
        [buildScript, "--project-root", project],
        { encoding: "utf8" },
    );
}

function assertPreviousDistSurvived(project) {
    assert.equal(
        readFileSync(resolve(project, "dist/sentinel.txt"), "utf8"),
        "previous release",
    );
    assert.equal(existsSync(resolve(project, "build-out")), false);
}

test("a compiler failure preserves the previous dist", () => {
    const project = createProject();
    try {
        writeFileSync(
            resolve(project, "src/compiler-error.ts"),
            "export const invalid: string = 42;\n",
        );
        const result = runBuild(project);
        assert.notEqual(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /compiler failed/i);
        assertPreviousDistSurvived(project);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test("an unused named import fails compilation before dist replacement", () => {
    const project = createProject();
    try {
        const index = resolve(project, "src/index.tsx");
        writeFileSync(
            index,
            `import { memo } from "react";\n${readFileSync(index, "utf8")}`,
        );
        const result = runBuild(project);
        assert.notEqual(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /memo.*never read|never read.*memo/i);
        assertPreviousDistSurvived(project);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test("a validation failure preserves the previous dist", () => {
    const project = createProject();
    try {
        const unstyled = resolve(project, "src/unstyled.tsx");
        writeFileSync(
            unstyled,
            readFileSync(unstyled, "utf8").replace(
                "export default SFIcon;",
                "export { SFIcon as OnlyNamedIcon };",
            ),
        );
        const result = runBuild(project);
        assert.notEqual(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /validation failed/i);
        assertPreviousDistSurvived(project);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test("a native module evaluation failure preserves the previous dist", () => {
    const project = createProject();
    try {
        const metadata = resolve(project, "src/metadata.ts");
        writeFileSync(
            metadata,
            `${readFileSync(metadata, "utf8")}\nthrow new Error("invalid native module");\n`,
        );
        const result = runBuild(project);
        assert.notEqual(result.status, 0, result.stdout + result.stderr);
        assert.match(
            result.stderr,
            /validation failed.*invalid native module/is,
        );
        assertPreviousDistSurvived(project);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test("successful staging emits complete dual-module output and resolvable declaration maps", () => {
    const project = createProject();
    try {
        const result = runBuild(project);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.equal(existsSync(resolve(project, "dist/sentinel.txt")), false);
        assert.equal(existsSync(resolve(project, "build-out")), false);

        for (const format of ["module", "main"]) {
            for (const entry of [
                "create-icon",
                "index",
                "metadata",
                "styled",
                "types",
                "unstyled",
            ]) {
                for (const suffix of ["js", "d.ts", "d.ts.map"]) {
                    const file = resolve(
                        project,
                        `dist/${format}/${entry}.${suffix}`,
                    );
                    assert.equal(existsSync(file), true, file);
                }
                const mapPath = resolve(
                    project,
                    `dist/${format}/${entry}.d.ts.map`,
                );
                const map = JSON.parse(readFileSync(mapPath, "utf8"));
                assert.ok(map.sources.length > 0, mapPath);
                for (const source of map.sources) {
                    assert.equal(
                        existsSync(
                            resolve(
                                dirname(mapPath),
                                map.sourceRoot ?? "",
                                source,
                            ),
                        ),
                        true,
                        `${mapPath} -> ${source}`,
                    );
                }
            }
        }

        assert.deepEqual(
            JSON.parse(
                readFileSync(
                    resolve(project, "dist/module/package.json"),
                    "utf8",
                ),
            ),
            { type: "module", sideEffects: false },
        );
        assert.deepEqual(
            JSON.parse(
                readFileSync(
                    resolve(project, "dist/main/package.json"),
                    "utf8",
                ),
            ),
            { type: "commonjs", sideEffects: false },
        );
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test("Windows rename retries are bounded and limited to transient lock errors", () => {
    let attempts = 0;
    const waits = [];
    renameWithRetry("source", "destination", {
        rename() {
            attempts++;
            if (attempts < 3)
                throw Object.assign(new Error("locked"), { code: "EBUSY" });
        },
        wait(milliseconds) {
            waits.push(milliseconds);
        },
    });
    assert.equal(attempts, 3);
    assert.deepEqual(waits, [20, 40]);

    attempts = 0;
    assert.throws(
        () =>
            renameWithRetry("source", "destination", {
                rename() {
                    attempts++;
                    throw Object.assign(new Error("denied"), {
                        code: "ENOENT",
                    });
                },
                wait() {
                    throw new Error("must not wait for permanent errors");
                },
            }),
        /denied/,
    );
    assert.equal(attempts, 1);
});

test("a replacement failure rolls the previous dist back into place", () => {
    const project = mkdtempSync(join(tmpdir(), "sfsymbols-react-rollback-"));
    const stageRoot = resolve(project, "build-out");
    const dist = resolve(project, "dist");
    const previousDist = resolve(stageRoot, "previous-dist");
    mkdirSync(stageRoot, { recursive: true });
    mkdirSync(dist, { recursive: true });
    writeFileSync(resolve(dist, "sentinel.txt"), "previous release");
    try {
        assert.throws(
            () =>
                replaceDist({
                    stageRoot,
                    stagedDist: resolve(stageRoot, "missing-package"),
                    previousDist,
                    dist,
                }),
            /ENOENT/,
        );
        assert.equal(
            readFileSync(resolve(dist, "sentinel.txt"), "utf8"),
            "previous release",
        );
        assert.equal(existsSync(previousDist), false);
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});

test("an unrelated project root is rejected before cleanup", () => {
    const project = mkdtempSync(join(tmpdir(), "sfsymbols-react-unsafe-root-"));
    const stageRoot = resolve(project, "build-out");
    mkdirSync(stageRoot, { recursive: true });
    writeFileSync(resolve(stageRoot, "sentinel.txt"), "unowned");
    try {
        const result = runBuild(project);
        assert.notEqual(result.status, 0, result.stdout + result.stderr);
        assert.match(
            result.stderr,
            /not an @bradleyhodges\/sfsymbols-react project/i,
        );
        assert.equal(
            readFileSync(resolve(stageRoot, "sentinel.txt"), "utf8"),
            "unowned",
        );
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
});
