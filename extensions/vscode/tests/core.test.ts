import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseIcon, renderSvg, escapeXml } from '../src/static-data';
import { planImport, findIconAt } from '../src/imports';
import { resolveCatalogue } from '../src/catalogue';

const data = '{iconName:"sfCircle",viewBox:"0 0 20 20",svgPathData:[{d:"M0 0h20v20z",fillOpacity:.5}]}';
const leaf = `const a=${data};export{a as sfCircle};`;
test('parses real static aliases and preserves geometry/opacity', () => {
  const icon = parseIcon(leaf, 'sfCircle');
  assert.equal(icon.paths[0].d, 'M0 0h20v20z');
  assert.match(renderSvg(icon, '#dddddd'), /fill-opacity="0.5"/);
});
test('supports generated minified boolean metadata without allowing arbitrary unary expressions', () => {
  assert.equal(parseIcon(leaf.replace('iconName:', 'keywords:[{generic:!0}],iconName:'), 'sfCircle').name, 'sfCircle');
  assert.throws(() => parseIcon(leaf.replace('iconName:', 'keywords:[{generic:!call()}],iconName:'), 'sfCircle'));
});
test('rejects executable or unsupported code anywhere, cycles and hostile SVG', () => {
  for (const source of [leaf+';alert(1)', leaf.replace(data, 'makeIcon()'), leaf.replace(data, '{get iconName(){return "sfCircle"}}'), leaf.replace('M0 0h20v20z', '<script>'), leaf.replace('20 20', '0 -1'), leaf.replace('fillOpacity:.5', 'fill:"url(https://evil)"'), 'const a=b,b=a;export{a as sfCircle};', leaf.replace('const a=', 'let a=')]) assert.throws(() => parseIcon(source, 'sfCircle'));
  assert.throws(() => parseIcon(' '.repeat(65537), 'sfCircle'));
  assert.equal(escapeXml('<"&\'>'), '&lt;&quot;&amp;&apos;&gt;');
});
test('recognizes TSX direct and root aliases and ignores strings and type-only imports', () => {
  const source = `import type {sfCircle as T} from '@bradleyhodges/sfsymbols';\nimport {sfCircle as ring} from '@bradleyhodges/sfsymbols/sfCircle';\nconst x: string = 'ring'; const a = <X icon={ring}/>;`;
  assert.equal(findIconAt(source, source.lastIndexOf('ring'), 'typescriptreact'), 'sfCircle');
  assert.equal(findIconAt(source, source.indexOf("'ring'")+1, 'typescriptreact'), undefined);
  assert.equal(findIconAt(source, source.indexOf('as T')+3, 'typescriptreact'), undefined);
});
test('hover excludes shadowed parameters and unrelated object keys', () => {
  const source = `import {sfCircle as ring} from '@bradleyhodges/sfsymbols'; function f(ring: number) {return ring;} const x={ring: 2};`;
  assert.equal(findIconAt(source, source.indexOf('return ring')+7, 'typescript'), undefined);
  assert.equal(findIconAt(source, source.lastIndexOf('ring'), 'typescript'), undefined);
});
test('rejects malformed SVG commands and nonfinite path coordinates', () => {
  for (const d of ['Mz', 'M0 0L1', 'M0 0A1 1 0 4 0 2 2', 'M1e999 0']) assert.throws(() => parseIcon(leaf.replace('M0 0h20v20z', d), 'sfCircle'));
});
test('preserves empty non-rendering paths present in the current corpus', () => {
  assert.equal(parseIcon(leaf.replace('M0 0h20v20z', ''), 'sfCircle').paths[0].d, '');
});
test('imports preserve alias/namespace duplicates and type-only collisions', () => {
  assert.equal(planImport(`import {sfCircle as ring} from '@bradleyhodges/sfsymbols';`, 'sfCircle', 'typescript').binding, 'ring');
  assert.equal(planImport(`import * as icons from '@bradleyhodges/sfsymbols';`, 'sfCircle', 'typescript').binding, 'icons.sfCircle');
  const edit = planImport(`import type {sfCircle} from '@bradleyhodges/sfsymbols';`, 'sfCircle', 'typescript');
  assert.equal(edit.binding, 'sfCircle2');
  assert.match(edit.text, /import \{ sfCircle as sfCircle2 \} from '@bradleyhodges\/sfsymbols\/sfCircle';/);
});
test('insertion follows shebang, directives and imports without changing original text', () => {
  const source = '#!/usr/bin/env node\r\n"use client";\r\nimport x from "x";\r\nconst sfCircle = 1;';
  const edit = planImport(source, 'sfCircle', 'typescript');
  assert.equal(edit.offset, source.indexOf('\r\nconst'));
  assert.equal(edit.binding, 'sfCircle2');
  assert.ok(edit.text.startsWith('\r\nimport'));
  assert.throws(() => planImport('const x =', 'sfCircle', 'typescript'));
});
test('resolves installed pnpm-style package and rejects escaping manifest targets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sf-catalogue-'));
  try {
    const pkg = path.join(root, 'store/pkg');
    await mkdir(path.join(pkg, 'dist/module'), {recursive:true});
    await mkdir(path.join(root, 'node_modules/@bradleyhodges'), {recursive:true});
    await symlink(pkg, path.join(root, 'node_modules/@bradleyhodges/sfsymbols'), 'junction');
    const manifest = {name:'@bradleyhodges/sfsymbols', exports:{'./sf*':{import:{default:'./dist/module/sf*.js'}}}};
    await writeFile(path.join(pkg, 'package.json'), JSON.stringify(manifest));
    await writeFile(path.join(pkg, 'dist/module/sfCircle.js'), leaf);
    const catalogue = await resolveCatalogue(path.join(root, 'src/app.tsx'));
    assert.deepEqual(catalogue.names, ['sfCircle']);
    assert.equal((await catalogue.load('sfCircle')).paths.length, 1);
    await assert.rejects(catalogue.load('../evil'));
    manifest.exports['./sf*'].import.default = './../sf*.js';
    await writeFile(path.join(pkg, 'package.json'), JSON.stringify(manifest));
    await assert.rejects(resolveCatalogue(path.join(root, 'src/app.tsx')));
  } finally { await rm(root, {recursive:true,force:true}); }
});
