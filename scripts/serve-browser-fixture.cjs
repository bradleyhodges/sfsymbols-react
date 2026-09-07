"use strict";

const assert = require("node:assert/strict");
const { copyFileSync, mkdtempSync, readFileSync, rmSync } = require("node:fs");
const http = require("node:http");
const { createRequire } = require("node:module");
const { isAbsolute, relative, resolve } = require("node:path");
const { build } = require("esbuild");

function option(name, fallback) {
    const index = process.argv.indexOf(name);
    return index === -1 ? fallback : process.argv[index + 1];
}

const root = resolve(__dirname, "..");
const consumer = resolve(option("--consumer", ""));
const port = Number(option("--port", "4188"));
if (
    !option("--consumer") ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
) {
    throw new Error(
        "Usage: node scripts/serve-browser-fixture.cjs --consumer <installed-consumer> [--port 4188]",
    );
}
const fixture = mkdtempSync(resolve(consumer, ".sfsymbols-browser-fixture-"));
const requireFromConsumer = createRequire(resolve(consumer, "package.json"));
for (const packageName of [
    "@bradleyhodges/sfsymbols-react",
    "@bradleyhodges/sfsymbols/sfArrowUpCircleFill",
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

for (const file of ["app.tsx", "client.tsx"]) {
    copyFileSync(resolve(root, "tests/browser", file), resolve(fixture, file));
}

async function main() {
    const shared = {
        absWorkingDir: fixture,
        bundle: true,
        define: { "process.env.NODE_ENV": '"development"' },
        logLevel: "silent",
    };
    await build({
        ...shared,
        entryPoints: ["app.tsx"],
        external: ["react", "react/*"],
        format: "cjs",
        outfile: "app-ssr.cjs",
        platform: "node",
    });
    await build({
        ...shared,
        entryPoints: ["client.tsx"],
        format: "esm",
        outfile: "client.js",
        platform: "browser",
    });
    const React = requireFromConsumer("react");
    const { renderToString } = requireFromConsumer("react-dom/server");
    const { App } = require(resolve(fixture, "app-ssr.cjs"));
    const markup = renderToString(React.createElement(App));
    assert.equal((markup.match(/<svg\b/g) || []).length, 22);
    assert.match(markup, /id="styled-custom-title"/);
    assert.match(markup, /id="unstyled-custom-description"/);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SFIcon verification</title><style>body{font:16px system-ui;margin:24px;color:#243044}main{max-width:1040px}button{padding:8px 12px}section{display:inline-block;vertical-align:top;width:44%;margin:1%;padding:1%;background:#f5f6f7}section div{min-height:38px;display:flex;gap:12px;align-items:center}svg{flex:none}[class~="h-[1em]"]{height:1em}.h-8{height:32px}.w-10{width:40px}pre{font-size:12px;white-space:pre-wrap}</style></head><body><div id="root">${markup}</div><pre id="errors"></pre><script type="module" src="/client.js"></script></body></html>`;
    const server = http.createServer((request, response) => {
        if (request.url === "/") {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(html);
        } else if (request.url === "/client.js") {
            response.setHeader(
                "Content-Type",
                "text/javascript; charset=utf-8",
            );
            response.end(readFileSync(resolve(fixture, "client.js")));
        } else {
            response.statusCode = 404;
            response.end();
        }
    });
    const close = () => {
        server.close();
        rmSync(fixture, { recursive: true, force: true });
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    await new Promise((resolveListen, rejectListen) => {
        server.once("error", rejectListen);
        server.listen(port, "127.0.0.1", () => {
            server.off("error", rejectListen);
            console.log("SSR fixture passed: 22 packed-package SVG cases.");
            console.log(`Browser verification: http://127.0.0.1:${port}`);
            console.log(
                "Expected: no hydration errors; refs/IDs/source paths true; click styled-refs, press Enter on unstyled-refs, toggle titles twice and confirm stableGeneratedIds remains true.",
            );
            resolveListen();
        });
    });
}

main().catch((error) => {
    rmSync(fixture, { recursive: true, force: true });
    console.error(error);
    process.exitCode = 1;
});
