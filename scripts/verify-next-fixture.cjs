"use strict";

const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} = require("node:fs");
const { createRequire } = require("node:module");
const { once } = require("node:events");
const { isAbsolute, relative, resolve } = require("node:path");

function option(name, fallback) {
    const index = process.argv.indexOf(name);
    return index === -1 ? fallback : process.argv[index + 1];
}

const root = resolve(__dirname, "..");
const consumerOption = option("--consumer");
const consumer = resolve(consumerOption || "");
const port = Number(option("--port", "4198"));
if (!consumerOption || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
        "Usage: node scripts/verify-next-fixture.cjs --consumer <installed-next-consumer> [--port 4198]",
    );
}
const requireFromConsumer = createRequire(resolve(consumer, "package.json"));
for (const packageName of [
    "@bradleyhodges/sfsymbols-react",
    "@bradleyhodges/sfsymbols/sfArrowUpCircleFill",
    "next",
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

const source = resolve(root, "tests/integration/next");
const fixture = mkdtempSync(resolve(consumer, ".sfsymbols-next-fixture-"));
mkdirSync(resolve(fixture, "app"), { recursive: true });
copyFileSync(
    resolve(source, "app/layout.jsx"),
    resolve(fixture, "app/layout.jsx"),
);
copyFileSync(resolve(source, "app/page.jsx"), resolve(fixture, "app/page.jsx"));
copyFileSync(
    resolve(source, "next.config.mjs"),
    resolve(fixture, "next.config.mjs"),
);
writeFileSync(
    resolve(fixture, "package.json"),
    JSON.stringify({ name: "sfsymbols-next-fixture", private: true }),
);

const nextCli = requireFromConsumer.resolve("next/dist/bin/next");
const environment = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };

function build(extraArguments) {
    const result = spawnSync(
        process.execPath,
        [nextCli, "build", ...extraArguments],
        {
            cwd: fixture,
            encoding: "utf8",
            env: environment,
        },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result.stdout;
}

function assertRendered(body, label) {
    const markup = body.replaceAll('\\"', '"');
    assert.match(markup, /server-styled/i, `${label}: styled icon missing`);
    assert.match(markup, /server-unstyled/i, `${label}: unstyled icon missing`);
    assert.match(markup, /Server up/, `${label}: title missing`);
    assert.match(markup, /Styled server icon/, `${label}: description missing`);
    assert.match(
        markup,
        /aria-labelledby(?:=|":)/i,
        `${label}: title link missing`,
    );
    assert.match(
        markup,
        /aria-describedby(?:=|":)/i,
        `${label}: description link missing`,
    );
}

async function waitForServer(child, url) {
    const deadline = Date.now() + 30_000;
    let lastError;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`Next server exited early with ${child.exitCode}`);
        }
        try {
            const response = await fetch(url);
            if (response.ok) return response;
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
    throw lastError || new Error("Timed out waiting for Next server");
}

async function main() {
    build(["--webpack"]);
    const server = spawn(
        process.execPath,
        [nextCli, "start", "-H", "127.0.0.1", "-p", String(port)],
        { cwd: fixture, env: environment, stdio: ["ignore", "pipe", "pipe"] },
    );
    let logs = "";
    server.stdout.on("data", (chunk) => {
        logs += chunk;
    });
    server.stderr.on("data", (chunk) => {
        logs += chunk;
    });
    try {
        const url = `http://127.0.0.1:${port}/`;
        const htmlResponse = await waitForServer(server, url);
        const html = await htmlResponse.text();
        assertRendered(html, "Webpack HTML");
        const rscResponse = await fetch(`${url}?_rsc=verification`, {
            headers: { RSC: "1" },
        });
        assert.equal(rscResponse.status, 200);
        assert.match(
            rscResponse.headers.get("content-type") || "",
            /text\/x-component/,
        );
        assertRendered(await rscResponse.text(), "Webpack RSC");
    } catch (error) {
        if (logs) console.error(logs);
        throw error;
    } finally {
        if (server.exitCode === null) {
            server.kill();
            await Promise.race([
                once(server, "exit"),
                new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000)),
            ]);
        }
    }
    build([]);
    const prerendered = readFileSync(
        resolve(fixture, ".next/server/app/index.html"),
        "utf8",
    );
    assertRendered(prerendered, "Turbopack prerender");
    console.log(
        "Next verification passed: production Webpack HTML/RSC and Turbopack prerender include both packed package entries.",
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => {
        rmSync(fixture, { recursive: true, force: true });
    });
