import { createHash, randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { type PreviewIcon, renderSvg } from "./static-data";

/** Per-activation, bounded owned SVG files; serialized writes avoid eviction races. */
export class PreviewCache {
    private readonly directory: vscode.Uri;
    private readonly files = new Map<string, vscode.Uri>();
    private queue: Promise<unknown> = Promise.resolve();
    private pending = 0;
    private disposed = false;
    constructor(storage: vscode.Uri) {
        this.directory = vscode.Uri.joinPath(
            storage,
            `previews-${randomUUID()}`,
        );
    }
    async image(icon: PreviewIcon): Promise<vscode.Uri> {
        if (this.disposed || this.pending >= 16)
            throw new Error("Preview queue is busy.");
        const dark =
            vscode.window.activeColorTheme.kind ===
                vscode.ColorThemeKind.Dark ||
            vscode.window.activeColorTheme.kind ===
                vscode.ColorThemeKind.HighContrast;
        const svg = renderSvg(icon, dark ? "#dddddd" : "#333333");
        const key = createHash("sha256").update(svg).digest("hex");
        this.pending++;
        const work = this.queue.then(async () => {
            if (this.disposed) throw new Error("Preview cache is closed.");
            const existing = this.files.get(key);
            if (existing) {
                this.files.delete(key);
                this.files.set(key, existing);
                return existing;
            }
            await vscode.workspace.fs.createDirectory(this.directory);
            const uri = vscode.Uri.joinPath(this.directory, `${key}.svg`);
            while (this.files.size >= 128) {
                const first = this.files.entries().next().value!;
                await vscode.workspace.fs.delete(first[1]);
                this.files.delete(first[0]);
            }
            try {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(svg));
            } catch (error) {
                try {
                    await vscode.workspace.fs.delete(uri);
                } catch {
                    /* Keep the original write failure; cleanup is best effort. */
                }
                throw error;
            }
            this.files.set(key, uri);
            return uri;
        });
        this.queue = work
            .catch(() => undefined)
            .finally(() => {
                this.pending--;
            });
        return work;
    }
    async close(): Promise<void> {
        this.disposed = true;
        await this.queue;
        try {
            await vscode.workspace.fs.delete(this.directory, {
                recursive: true,
            });
        } catch (error) {
            if (
                !(
                    error instanceof vscode.FileSystemError &&
                    error.code === "FileNotFound"
                )
            )
                throw error;
        }
        this.files.clear();
    }
}
