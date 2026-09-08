import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

test("failed eviction never writes beyond the 128-file cache bound", async () => {
    const stored = new Map<string, number>();
    let deleteCalls = 0;
    const vscode = {
        Uri: {
            joinPath: (base: { fsPath: string }, ...parts: string[]) => ({
                fsPath: path.join(base.fsPath, ...parts),
            }),
        },
        window: { activeColorTheme: { kind: 1 } },
        ColorThemeKind: { Dark: 2, HighContrast: 3 },
        workspace: {
            fs: {
                async createDirectory() {},
                async writeFile(uri: { fsPath: string }, bytes: Uint8Array) {
                    stored.set(uri.fsPath, bytes.length);
                },
                async delete() {
                    deleteCalls++;
                    throw Object.assign(new Error("Locked oldest preview"), {
                        code: "EBUSY",
                    });
                },
            },
        },
    };
    const result = await build({
        entryPoints: ["src/preview-cache.ts"],
        bundle: true,
        write: false,
        platform: "node",
        format: "cjs",
        external: ["vscode"],
        logLevel: "silent",
    });
    type LoadedModule = {
        exports: {
            PreviewCache: new (uri: { fsPath: string }) => {
                image(icon: unknown): Promise<unknown>;
            };
        };
    };
    const loadedModule: LoadedModule = {
        exports: {} as LoadedModule["exports"],
    };
    const load = vm.runInThisContext(
        `(function(require,module,exports){${result.outputFiles[0].text}\n})`,
    ) as (
        loader: (name: string) => unknown,
        module: LoadedModule,
        exports: LoadedModule["exports"],
    ) => void;
    load(
        (name) => (name === "vscode" ? vscode : require(name)),
        loadedModule,
        loadedModule.exports,
    );
    const cache = new loadedModule.exports.PreviewCache({
        fsPath: "memory-only",
    });
    let rejected = 0;
    for (let index = 0; index < 150; index++) {
        try {
            await cache.image({
                name: "sfProbe",
                viewBox: "0 0 20 20",
                paths: [{ d: `M0 0L${index} 1` }],
            });
        } catch {
            rejected++;
        }
    }
    assert.equal(deleteCalls, 22);
    assert.equal(rejected, 22);
    assert.ok(stored.size <= 128, `stored ${stored.size} preview files`);
});
