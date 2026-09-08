const { build } = require("esbuild");
const { mkdirSync } = require("node:fs");
mkdirSync("artifacts", { recursive: true });
Promise.all([
    build({
        entryPoints: ["src/extension.ts"],
        outfile: "dist/extension.cjs",
        bundle: true,
        platform: "node",
        target: "node20",
        format: "cjs",
        external: ["vscode"],
        minify: true,
        legalComments: "inline",
    }),
    build({
        entryPoints: ["tests/host.ts"],
        outfile: "dist/host.cjs",
        bundle: true,
        platform: "node",
        target: "node20",
        format: "cjs",
        external: ["vscode"],
    }),
]).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
