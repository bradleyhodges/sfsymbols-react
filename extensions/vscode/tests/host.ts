import assert from "node:assert/strict";
import * as vscode from "vscode";
import { PreviewCache } from "../src/preview-cache";

export async function run(): Promise<void> {
    const extension = vscode.extensions.getExtension(
        "bradleyhodges.sfsymbols-preview",
    );
    assert.ok(extension, "development extension exists");
    await extension.activate();
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder);
    const uri = vscode.Uri.joinPath(folder.uri, "example.tsx");
    const source = `"use client";\nimport {sfCircle as ring} from '@bradleyhodges/sfsymbols/sfCircle';\nconst icon = ring;\n`;
    await vscode.workspace.fs.writeFile(uri, Buffer.from(source));
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        uri,
        document.positionAt(source.lastIndexOf("ring")),
    );
    const preview = hovers
        .flatMap((hover) => hover.contents)
        .find(
            (item) =>
                typeof item !== "string" &&
                "value" in item &&
                item.value.includes("![SF Symbol]"),
        ) as vscode.MarkdownString | undefined;
    assert.ok(preview, "actual hover provider returns local image");
    assert.equal(preview.isTrusted, false);
    assert.equal(preview.supportHtml, false);
    assert.ok(!preview.value.includes("https:"));
    const image = preview.value.match(/!\[SF Symbol\]\(<([^>]+)>\)/)?.[1];
    assert.ok(image);
    const svg = Buffer.from(
        await vscode.workspace.fs.readFile(vscode.Uri.parse(image)),
    ).toString();
    assert.match(svg, /<svg/);
    assert.match(svg, /fill-opacity="0.5"/);
    // Invoke the same command path used after QuickPick selection with its public optional name.
    await vscode.commands.executeCommand("sfsymbols.insertIcon", "sfSquare");
    assert.match(
        document.getText(),
        /import \{ sfSquare \} from '@bradleyhodges\/sfsymbols\/sfSquare';/,
    );
    const inserted = document.getText();
    await vscode.commands.executeCommand("sfsymbols.insertIcon", "sfSquare");
    assert.equal(
        document.getText(),
        inserted,
        "duplicate command does not edit",
    );
    await editor.edit((edit) =>
        edit.insert(
            document.positionAt(document.getText().length),
            "\n// host edit",
        ),
    );
    assert.ok(document.isDirty);
    const blank = await vscode.workspace.openTextDocument({
        language: "typescript",
        content: "",
    });
    const blankUri = vscode.Uri.joinPath(folder.uri, "picker.ts");
    await vscode.workspace.fs.writeFile(
        blankUri,
        Buffer.from("const value = 1;\n"),
    );
    const pickerDocument = await vscode.workspace.openTextDocument(blankUri);
    const pickerEditor = await vscode.window.showTextDocument(pickerDocument);
    const settlePicker = () =>
        new Promise((resolve) => setTimeout(resolve, 300));
    const cancelled = vscode.commands.executeCommand("sfsymbols.insertIcon");
    await settlePicker();
    await vscode.commands.executeCommand("workbench.action.closeQuickOpen");
    await cancelled;
    assert.equal(
        pickerDocument.getText(),
        "const value = 1;\n",
        "cancelling picker leaves source unchanged",
    );
    const stale = vscode.commands.executeCommand("sfsymbols.insertIcon");
    await settlePicker();
    await pickerEditor.edit((edit) =>
        edit.insert(new vscode.Position(0, 0), "// changed\n"),
    );
    await vscode.commands.executeCommand(
        "workbench.action.acceptSelectedQuickOpenItem",
    );
    await stale;
    assert.ok(
        !pickerDocument.getText().includes("import "),
        "stale picker cannot edit changed document",
    );
    const picked = vscode.commands.executeCommand("sfsymbols.insertIcon");
    await settlePicker();
    await vscode.commands.executeCommand(
        "workbench.action.acceptSelectedQuickOpenItem",
    );
    await picked;
    assert.match(
        pickerDocument.getText(),
        /import \{ sfCircle \}/,
        "actual QuickPick acceptance inserts icon",
    );
    const bounded = new PreviewCache(
        vscode.Uri.joinPath(folder.uri, ".cache-test"),
    );
    let last: vscode.Uri | undefined;
    for (let index = 0; index < 130; index++)
        last = await bounded.image({
            name: "sfCircle",
            viewBox: `0 0 ${index + 1} 20`,
            paths: [{ d: "M0 0h1v1z" }],
        });
    assert.ok(last);
    const cacheDirectory = vscode.Uri.joinPath(last, "..");
    assert.equal(
        (await vscode.workspace.fs.readDirectory(cacheDirectory)).length,
        128,
        "disk cache is bounded",
    );
    await bounded.close();
    await assert.rejects(async () => vscode.workspace.fs.stat(cacheDirectory));
    await assert.rejects(
        bounded.image({
            name: "sfCircle",
            viewBox: "0 0 20 20",
            paths: [{ d: "" }],
        }),
    );
    assert.equal(blank.getText(), "");
    console.log(
        "HOST PASS: activation, actual hover/local SVG safety, imports/duplicates, QuickPick accept/cancel/stale document guard, 128-file eviction and disposal.",
    );
}
