const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const test = require("node:test");

const root = resolve(__dirname, "..");

function writePackage(consumer, name, files) {
    const packageRoot = resolve(consumer, "node_modules", ...name.split("/"));
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(
        resolve(packageRoot, "package.json"),
        JSON.stringify({ name, main: "index.js" }),
    );
    for (const file of files) {
        const path = resolve(packageRoot, file);
        mkdirSync(resolve(path, ".."), { recursive: true });
        writeFileSync(path, "module.exports = {};\n");
    }
}

function installResolutionStubs(consumer) {
    writePackage(consumer, "@bradleyhodges/sfsymbols-react", [
        "index.js",
        "unstyled.js",
        "metadata.js",
    ]);
    writePackage(consumer, "@bradleyhodges/sfsymbols", [
        "index.js",
        "sfArrowUpCircleFill.js",
    ]);
    writePackage(consumer, "next", ["index.js", "dist/bin/next.js"]);
    writePackage(consumer, "react", ["index.js"]);
    writePackage(consumer, "react-dom", ["index.js", "server.js"]);
}

function assertFailedSetupIsClean(fixtureCase) {
    const consumer = mkdtempSync(
        join(tmpdir(), "sfsymbols-fixture-cleanup-consumer-"),
    );
    const sentinel = resolve(consumer, "consumer-sentinel.txt");
    const sentinelContents = `${fixtureCase.name}: preserve me\n`;
    try {
        writeFileSync(
            resolve(consumer, "package.json"),
            JSON.stringify({ private: true }),
        );
        writeFileSync(sentinel, sentinelContents);
        if (!fixtureCase.name.includes("missing dependency")) {
            installResolutionStubs(consumer);
        }

        const preload = resolve(consumer, "fail-fixture-copy.cjs");
        if (fixtureCase.args.includes("--inject-copy-failure")) {
            writeFileSync(
                preload,
                `const fs = require("node:fs");\nconst copyFileSync = fs.copyFileSync;\nfs.copyFileSync = (source, destination, ...args) => {\n    if (String(destination).includes(${JSON.stringify(fixtureCase.prefix)})) {\n        throw new Error("intentional fixture setup copy failure");\n    }\n    return copyFileSync(source, destination, ...args);\n};\n`,
            );
        }

        const args = fixtureCase.args.filter(
            (argument) => argument !== "--inject-copy-failure",
        );
        const result = spawnSync(
            process.execPath,
            [
                ...(fixtureCase.args.includes("--inject-copy-failure")
                    ? ["--require", preload]
                    : []),
                resolve(root, "scripts", fixtureCase.script),
                "--consumer",
                consumer,
                ...args,
            ],
            { cwd: root, encoding: "utf8" },
        );

        assert.notEqual(
            result.status,
            0,
            `${fixtureCase.name} unexpectedly succeeded`,
        );
        assert.equal(readFileSync(sentinel, "utf8"), sentinelContents);
        assert.deepEqual(
            readdirSync(consumer).filter((name) =>
                name.startsWith(fixtureCase.prefix),
            ),
            [],
            `${fixtureCase.name} left an owned fixture child behind`,
        );
    } finally {
        rmSync(consumer, { recursive: true, force: true });
    }
}

for (const fixtureCase of [
    {
        name: "browser missing dependency",
        prefix: ".sfsymbols-browser-fixture-",
        script: "serve-browser-fixture.cjs",
        args: [],
    },
    {
        name: "Next setup copy failure",
        prefix: ".sfsymbols-next-fixture-",
        script: "verify-next-fixture.cjs",
        args: ["--inject-copy-failure"],
    },
    {
        name: "TypeScript setup copy failure",
        prefix: ".sfsymbols-types-fixture-",
        script: "verify-typescript-fixture.cjs",
        args: ["--typescript-root", root, "--inject-copy-failure"],
    },
]) {
    test(`${fixtureCase.name} removes only the owned fixture child`, () => {
        assertFailedSetupIsClean(fixtureCase);
    });
}
