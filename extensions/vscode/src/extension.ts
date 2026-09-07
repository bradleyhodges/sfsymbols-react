import * as vscode from 'vscode';
import path from 'node:path';
import { resolveCatalogue, type Catalogue } from './catalogue';
import { findIconAt, planImport } from './imports';
import { PreviewCache } from './preview-cache';

const languages = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'];
let cache: PreviewCache | undefined;

/** Register local-only previews and one import command without touching React's runtime. */
export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('SF Symbols');
  const previews = new PreviewCache(context.globalStorageUri);
  cache = previews;
  const catalogues = new Map<string, { expires: number; value: Promise<Catalogue> }>();
  const pickers = new Set<vscode.QuickPick<vscode.QuickPickItem>>();
  function report(error: unknown) { output.appendLine(error instanceof Error ? error.message : 'Unknown preview error.'); }
  function catalogue(document: vscode.TextDocument): Promise<Catalogue> {
    if (document.uri.scheme !== 'file') return Promise.reject(new Error('Save this document in a local project first.'));
    const key = path.dirname(document.uri.fsPath);
    const existing = catalogues.get(key);
    if (existing && existing.expires > Date.now()) return existing.value;
    const value = resolveCatalogue(document.uri.fsPath);
    catalogues.delete(key);
    catalogues.set(key, { expires: Date.now() + 30000, value });
    if (catalogues.size > 8) catalogues.delete(catalogues.keys().next().value!);
    void value.catch(() => { if (catalogues.get(key)?.value === value) catalogues.delete(key); });
    return value;
  }
  context.subscriptions.push(output, { dispose() { for (const picker of pickers) picker.dispose(); pickers.clear(); catalogues.clear(); } });
  context.subscriptions.push(vscode.languages.registerHoverProvider(languages.map(language => ({ language, scheme: 'file' })), {
    async provideHover(document, position, token) {
      const version = document.version;
      try {
        if (token.isCancellationRequested) return;
        const name = findIconAt(document.getText(), document.offsetAt(position), document.languageId);
        if (!name) return;
        const icons = await catalogue(document);
        if (token.isCancellationRequested || document.version !== version || !icons.names.includes(name)) return;
        const icon = await icons.load(name);
        if (token.isCancellationRequested || document.version !== version) return;
        const uri = await previews.image(icon);
        if (token.isCancellationRequested || document.version !== version) return;
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = false;
        markdown.supportHtml = false;
        markdown.appendText(name);
        markdown.appendMarkdown(`\n\n![SF Symbol](<${uri.toString().replace(/[()]/g, character => character === '(' ? '%28' : '%29')}>)\n\n`);
        markdown.appendCodeblock(`import { ${name} } from '@bradleyhodges/sfsymbols/${name}';`, 'typescript');
        return new vscode.Hover(markdown, document.getWordRangeAtPosition(position));
      } catch (error) { report(error); return; }
    },
  }));

  async function choose(icons: Catalogue): Promise<string | undefined> {
    const picker = vscode.window.createQuickPick();
    pickers.add(picker);
    picker.title = 'SF Symbols — preview and import';
    picker.placeholder = 'Search exact sf* names; select to preview, Enter to import';
    picker.matchOnDescription = true;
    picker.items = icons.names.map(label => ({ label, description: `@bradleyhodges/sfsymbols/${label}` }));
    let sequence = 0;
    let activeName: string | undefined;
    return new Promise(resolve => {
      const disposables: vscode.Disposable[] = [];
      let completed = false;
      function finish(name?: string) {
        if (completed) return;
        completed = true; sequence++;
        disposables.forEach(disposable => disposable.dispose());
        pickers.delete(picker); picker.dispose(); resolve(name);
      }
      disposables.push(picker.onDidHide(() => finish()), picker.onDidAccept(() => finish(picker.selectedItems[0]?.label)), picker.onDidChangeActive(items => {
        const selected = items[0];
        if (selected?.label === activeName) return;
        activeName = selected?.label;
        const request = ++sequence;
        if (!selected) return;
        void (async () => {
          const icon = await icons.load(selected.label);
          if (completed || request !== sequence) return;
          const image = await previews.image(icon);
          if (completed || request !== sequence) return;
          selected.iconPath = image;
          picker.items = [...picker.items];
          picker.activeItems = [selected];
        })().catch(error => { report(error); if (!completed && request === sequence) picker.title = 'SF Symbols — preview unavailable for this icon'; });
      }));
      picker.show();
    });
  }

  context.subscriptions.push(vscode.commands.registerCommand('sfsymbols.insertIcon', async (requestedName?: unknown) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !languages.includes(editor.document.languageId)) { void vscode.window.showInformationMessage('Open a JavaScript or TypeScript document first.'); return; }
    const document = editor.document;
    const version = document.version;
    try {
      const icons = await catalogue(document);
      const name = typeof requestedName === 'string' ? requestedName : await choose(icons);
      if (!name) return;
      if (!icons.names.includes(name)) throw new Error('The selected icon is not in this installed package.');
      if (document.isClosed || document.version !== version || vscode.window.activeTextEditor !== editor) { void vscode.window.showInformationMessage('The document changed. Run SF Symbols: Preview and Import Icon again.'); return; }
      const edit = planImport(document.getText(), name, document.languageId);
      if (edit.text) {
        const applied = await editor.edit(builder => builder.insert(document.positionAt(edit.offset), edit.text));
        if (!applied) throw new Error('The document changed before the import could be applied.');
      }
      vscode.window.setStatusBarMessage(`SF Symbols: use ${edit.binding}`, 5000);
    } catch (error) {
      report(error);
      void vscode.window.showWarningMessage(error instanceof SyntaxError ? 'This document has unsupported or incomplete syntax. Finish the statement and try again.' : error instanceof Error ? error.message : 'Unable to import this SF Symbol.');
    }
  }));
}

/** Remove only this activation's owned previews; VS Code disposes all registered UI handles. */
export async function deactivate(): Promise<void> { await cache?.close(); cache = undefined; }
