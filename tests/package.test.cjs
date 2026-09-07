const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join, resolve } = require("node:path");
const test = require("node:test");

const root = resolve(__dirname, "..");
const npmCli = resolve(
    dirname(process.execPath),
    "node_modules/npm/bin/npm-cli.js",
);
const packageJson = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8"),
);

const publicEntries = {
    ".": "index",
    "./unstyled": "unstyled",
    "./metadata": "metadata",
    "./types": "types",
};

test("package metadata exposes dual modules and declarations for every public entry", () => {
    assert.equal(packageJson.version, "8.1.1");
    assert.equal(packageJson.main, "./dist/main/index.js");
    assert.equal(packageJson.module, "./dist/module/index.js");
    assert.equal(packageJson.types, "./dist/main/index.d.ts");
    assert.equal(packageJson.sideEffects, false);

    for (const [publicPath, file] of Object.entries(publicEntries)) {
        assert.deepEqual(packageJson.exports[publicPath], {
            import: {
                types: `./dist/module/${file}.d.ts`,
                default: `./dist/module/${file}.js`,
            },
            require: {
                types: `./dist/main/${file}.d.ts`,
                default: `./dist/main/${file}.js`,
            },
        });
        if (publicPath !== ".") {
            assert.deepEqual(
                packageJson.typesVersions["*"][publicPath.slice(2)],
                [`dist/main/${file}.d.ts`],
            );
        }
    }
    assert.equal(
        Object.hasOwn(packageJson.typesVersions["*"], "*"),
        false,
        "legacy mappings must not expose unknown subpaths as the root API",
    );
});

test("production dependencies contain only the renderer runtime", () => {
    assert.deepEqual(packageJson.dependencies, {
        "@bradleyhodges/sfsymbols-types": "^8.1.1",
        cn: "^0.2.5",
    });
    assert.deepEqual(packageJson.peerDependencies, {
        react: "^18.0.0 || ^19.0.0",
    });
    assert.equal(packageJson.devDependencies.react, "^19.2.8");
    for (const dependency of [
        "@types/node",
        "next",
        "react",
        "react-dom",
        "tailwind-merge",
    ]) {
        assert.equal(
            Object.hasOwn(packageJson.dependencies, dependency),
            false,
            `${dependency} must not be a production dependency`,
        );
    }
});

test("package allowlist and lifecycle scripts are release-safe", () => {
    assert.deepEqual(packageJson.files, [
        "dist",
        "src",
        "README.md",
        "LICENSE",
        "CHANGELOG.md",
    ]);
    assert.equal(packageJson.scripts.build, "node scripts/build.cjs");
    assert.equal(
        packageJson.scripts.test,
        "pnpm run build && node --test tests/*.test.cjs",
    );
    assert.equal(
        packageJson.scripts.prepack,
        "pnpm run build && pnpm run verify-package",
    );
    assert.equal(
        packageJson.scripts["verify-package"],
        "node scripts/verify-package.cjs",
    );
    assert.equal(
        packageJson.scripts["verify-catalogue"],
        "node scripts/verify-catalogue.cjs",
    );
    assert.equal(
        packageJson.scripts["verify-typescript"],
        "node scripts/verify-typescript-fixture.cjs",
    );
    assert.equal(
        packageJson.scripts["verify-next"],
        "node scripts/verify-next-fixture.cjs",
    );
    assert.equal(
        packageJson.scripts["fixture:browser"],
        "node scripts/serve-browser-fixture.cjs",
    );
    assert.equal(
        packageJson.scripts.format,
        "biome check src scripts tests package.json tsconfig.json tsconfig.main.json --write --skip-errors",
    );
    assert.doesNotMatch(
        packageJson.scripts["verify-package"],
        /(?:npm|pnpm)\s+(?:run\s+)?pack\b/i,
    );
    assert.match(packageJson.scripts.pub, /npm publish/);
});

test("release verifier accepts a fresh dual-module build", () => {
    const result = spawnSync(
        process.execPath,
        [resolve(root, "scripts/verify-package.cjs")],
        { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Package verification passed/);
});

test("release verifier rejects direct and transitive bare cn imports", () => {
    for (const kind of ["direct", "transitive"]) {
        const project = mkdtempSync(
            join(tmpdir(), `sfsymbols-react-verifier-${kind}-`),
        );
        try {
            cpSync(resolve(root, "dist"), resolve(project, "dist"), {
                recursive: true,
            });
            cpSync(resolve(root, "src"), resolve(project, "src"), {
                recursive: true,
            });
            cpSync(
                resolve(root, "package.json"),
                resolve(project, "package.json"),
            );
            mkdirSync(resolve(project, "scripts"));
            cpSync(
                resolve(root, "scripts/verify-package.cjs"),
                resolve(project, "scripts/verify-package.cjs"),
            );
            symlinkSync(
                resolve(root, "node_modules"),
                resolve(project, "node_modules"),
                "junction",
            );

            const unstyled = resolve(project, "dist/module/unstyled.js");
            if (kind === "direct") {
                writeFileSync(
                    unstyled,
                    `import "cn";\n${readFileSync(unstyled, "utf8")}`,
                );
            } else {
                writeFileSync(
                    resolve(project, "dist/module/unstyled-helper.js"),
                    'import "cn";\n',
                );
                writeFileSync(
                    unstyled,
                    `import "./unstyled-helper.js";\n${readFileSync(unstyled, "utf8")}`,
                );
            }

            const result = spawnSync(
                process.execPath,
                [resolve(project, "scripts/verify-package.cjs")],
                { cwd: project, encoding: "utf8" },
            );
            assert.notEqual(result.status, 0, result.stdout + result.stderr);
            assert.match(result.stderr, /reaches cn/i);
        } finally {
            rmSync(project, { recursive: true, force: true });
        }
    }
});

test("packed artifacts contain only the allowlist and load through native ESM, CommonJS and browser bundling", async () => {
    const packDirectory = mkdtempSync(join(tmpdir(), "sfsymbols-react-pack-"));
    const consumer = mkdtempSync(join(tmpdir(), "sfsymbols-react-consumer-"));
    try {
        const packed = spawnSync(
            process.execPath,
            [
                npmCli,
                "pack",
                "--ignore-scripts",
                "--json",
                "--pack-destination",
                packDirectory,
            ],
            { cwd: root, encoding: "utf8" },
        );
        assert.equal(packed.status, 0, packed.stdout + packed.stderr);
        const [manifest] = JSON.parse(packed.stdout);
        assert.equal(manifest.name, packageJson.name);
        assert.equal(manifest.version, packageJson.version);
        assert.ok(manifest.files.length > 0);
        for (const { path } of manifest.files) {
            assert.match(
                path,
                /^(?:package\.json|README\.md|LICENSE|CHANGELOG\.md|dist\/|src\/)/,
                `unexpected packed path: ${path}`,
            );
        }
        for (const prefix of ["dist/", "src/"]) {
            assert.ok(
                manifest.files.some(({ path }) => path.startsWith(prefix)),
                `${prefix} must be packed`,
            );
        }
        const tarball = resolve(packDirectory, manifest.filename);
        writeFileSync(
            resolve(consumer, "package.json"),
            JSON.stringify({ private: true, type: "module" }),
        );
        const installed = spawnSync(
            process.execPath,
            [
                npmCli,
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--package-lock=false",
                tarball,
                "react@19.2.8",
                "react-dom@19.2.8",
            ],
            { cwd: consumer, encoding: "utf8" },
        );
        assert.equal(installed.status, 0, installed.stdout + installed.stderr);

        const commonJs = spawnSync(
            process.execPath,
            [
                "-e",
                `const assert=require("node:assert/strict");const root=require("${packageJson.name}");const unstyled=require("${packageJson.name}/unstyled");const metadata=require("${packageJson.name}/metadata");require("${packageJson.name}/types");assert.equal(root.default,root.SFIcon);assert.equal(unstyled.default,unstyled.SFIcon);assert.equal(typeof metadata.getIconKeywords,"function");`,
            ],
            { cwd: consumer, encoding: "utf8" },
        );
        assert.equal(commonJs.status, 0, commonJs.stdout + commonJs.stderr);

        const esm = spawnSync(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                `import assert from "node:assert/strict";import Root,{SFIcon} from "${packageJson.name}";import Unstyled,{SFIcon as NamedUnstyled} from "${packageJson.name}/unstyled";import {getIconVariants} from "${packageJson.name}/metadata";import "${packageJson.name}/types";assert.equal(Root,SFIcon);assert.equal(Unstyled,NamedUnstyled);assert.equal(typeof getIconVariants,"function");`,
            ],
            { cwd: consumer, encoding: "utf8" },
        );
        assert.equal(esm.status, 0, esm.stdout + esm.stderr);

        const verifiedConsumer = spawnSync(
            process.execPath,
            [
                resolve(root, "scripts/verify-package.cjs"),
                "--consumer",
                `test=${consumer}`,
            ],
            { cwd: root, encoding: "utf8" },
        );
        assert.equal(
            verifiedConsumer.status,
            0,
            verifiedConsumer.stdout + verifiedConsumer.stderr,
        );
        assert.match(
            verifiedConsumer.stdout,
            /Verified consumer test \(React 19\.2\.8\)/,
        );

        const esbuild = require("esbuild");
        const installedPackage = resolve(
            consumer,
            "node_modules/@bradleyhodges/sfsymbols-react",
        );
        const bundle = async (contents, format = "esm") => {
            const result = await esbuild.build({
                absWorkingDir: consumer,
                bundle: true,
                external: ["react", "react/jsx-runtime"],
                format,
                logLevel: "silent",
                metafile: true,
                minify: true,
                platform: "browser",
                stdin: {
                    contents,
                    resolveDir: consumer,
                    sourcefile: "package-boundary.mjs",
                },
                treeShaking: true,
                write: false,
            });
            const packageInputs = Object.keys(result.metafile.inputs).filter(
                (path) => path.includes("sfsymbols-react/"),
            );
            for (const input of packageInputs) {
                const relativeInput = require("node:path").relative(
                    installedPackage,
                    resolve(consumer, input),
                );
                assert.ok(
                    relativeInput &&
                        !relativeInput.startsWith("..") &&
                        !require("node:path").isAbsolute(relativeInput),
                    `bundle input escaped installed tarball: ${input}`,
                );
            }
            return { packageInputs, result };
        };
        const includesCn = (result) =>
            Object.values(result.metafile.outputs).some((output) =>
                Object.entries(output.inputs).some(
                    ([path, contribution]) =>
                        contribution.bytesInOutput > 0 &&
                        /(?:^|[\\/])node_modules[\\/](?:\.pnpm[\\/]cn@[^\\/]+[\\/]node_modules[\\/])?cn[\\/]/.test(
                            path,
                        ),
                ),
            );

        const styled = await bundle(
            `import { SFIcon } from "${packageJson.name}"; console.log(SFIcon);`,
        );
        assert.ok(styled.packageInputs.length > 0);
        assert.equal(includesCn(styled.result), true);
        const unstyled = await bundle(
            `import { SFIcon } from "${packageJson.name}/unstyled"; console.log(SFIcon);`,
        );
        assert.ok(unstyled.packageInputs.length > 0);
        assert.equal(includesCn(unstyled.result), false);
        const unstyledCommonJs = await bundle(
            `const { SFIcon } = require("${packageJson.name}/unstyled"); console.log(SFIcon);`,
            "cjs",
        );
        assert.ok(unstyledCommonJs.packageInputs.length > 0);
        assert.equal(includesCn(unstyledCommonJs.result), false);
        const helpers = await bundle(
            `import { getIconKeywords, getIconVariants } from "${packageJson.name}"; console.log(getIconKeywords, getIconVariants);`,
        );
        assert.ok(helpers.packageInputs.length > 0);
        assert.equal(includesCn(helpers.result), false);
        const unused = await bundle(
            `import { SFIcon } from "${packageJson.name}"; console.log("kept");`,
        );
        assert.ok(unused.result.outputFiles[0].contents.length < 30);
    } finally {
        rmSync(packDirectory, { recursive: true, force: true });
        rmSync(consumer, { recursive: true, force: true });
    }
});
