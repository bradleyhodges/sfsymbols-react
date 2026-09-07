import { open, opendir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { iconNamePattern, MAX_LEAF_BYTES, parseIcon, type PreviewIcon } from './static-data';

/** Limit bytes before parsing, including files that grow while being read. */
export async function readBounded(file: string, limit: number): Promise<string> {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error('Package file exceeds supported limits.');
    const buffer = Buffer.alloc(limit + 1);
    let bytes = 0;
    while (bytes <= limit) {
      const read = await handle.read(buffer, bytes, buffer.length - bytes, null);
      if (!read.bytesRead) break;
      bytes += read.bytesRead;
    }
    if (bytes > limit) throw new Error('Package file exceeds supported limits.');
    return buffer.subarray(0, bytes).toString('utf8');
  } finally { await handle.close(); }
}
function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return !!relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
async function ownedPath(root: string, relative: string): Promise<string> {
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw new Error('Package path escapes its root.');
  const actual = await realpath(target);
  if (!inside(root, actual)) throw new Error('Package symlink escapes its root.');
  return actual;
}
export interface Catalogue { root: string; names: readonly string[]; load(name: string): Promise<PreviewIcon> }

/** Find node_modules upward without resolving or evaluating package JavaScript. */
export async function resolveCatalogue(documentPath: string): Promise<Catalogue> {
  let directory = path.dirname(path.resolve(documentPath));
  for (let depth = 0; depth < 64; depth++) {
    const candidate = path.join(directory, 'node_modules/@bradleyhodges/sfsymbols');
    let root: string | undefined;
    try { root = await realpath(candidate); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (root) return catalogueAt(root);
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error('Install @bradleyhodges/sfsymbols in this project to preview icons.');
}
async function catalogueAt(root: string): Promise<Catalogue> {
  const manifest: unknown = JSON.parse(await readBounded(await ownedPath(root, 'package.json'), 262144));
  if (!manifest || typeof manifest !== 'object' || !('name' in manifest) || manifest.name !== '@bradleyhodges/sfsymbols') throw new Error('Invalid SF Symbols package manifest.');
  // Support the published conditional per-icon export contract, not arbitrary module layouts.
  const target = (manifest as { exports?: Record<string, { import?: { default?: unknown } }> }).exports?.['./sf*']?.import?.default;
  if (typeof target !== 'string' || !/^\.\/(?:[A-Za-z0-9_-]+\/)+sf\*\.js$/.test(target)) throw new Error('This package needs the supported ./sf* ESM export layout.');
  const leafDirectory = await ownedPath(root, path.dirname(target));
  const names: string[] = [];
  const directory = await opendir(leafDirectory);
  let count = 0;
  for await (const entry of directory) {
    if (++count > 40000) throw new Error('Package contains too many files.');
    if (entry.name.endsWith('.js') && iconNamePattern.test(entry.name.slice(0, -3))) {
      if (!entry.isFile()) throw new Error('Icon leaves must be regular files.');
      names.push(entry.name.slice(0, -3));
      if (names.length > 20000) throw new Error('Package contains too many icons.');
    }
  }
  names.sort();
  const known = new Set(names);
  return { root, names, async load(name) {
    if (!known.has(name) || !iconNamePattern.test(name)) throw new Error('Unknown icon.');
    const file = await ownedPath(root, target.replace('sf*', name));
    return parseIcon(await readBounded(file, MAX_LEAF_BYTES), name);
  } };
}
