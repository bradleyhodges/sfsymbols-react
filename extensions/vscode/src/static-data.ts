import { parse } from '@babel/parser';

export interface PreviewIcon { name: string; viewBox: string; paths: readonly { d: string; fill?: string; fillOpacity?: number }[] }
type Value = null | string | number | boolean | Value[] | { [key: string]: Value };
// Babel nodes are checked by their discriminant before reading structural fields.
type Node = { type: string; [key: string]: unknown };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const iconNamePattern = /^sf[A-Za-z0-9_$]+$/;
export const MAX_LEAF_BYTES = 65536;

function validGeometry(source: string): boolean {
  // Empty d is a valid non-rendering SVG path used by the installed catalogue.
  if (source === '') return true;
  if (source.length > 32768 || !/^[Mm]/.test(source)) return false;
  const arity: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const number = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  let offset = 0;
  const separator = () => { while (offset < source.length && /[\s,]/.test(source[offset])) offset++; };
  while (offset < source.length) {
    separator();
    if (offset === source.length) break;
    const command = source[offset++].toUpperCase();
    if (!Object.hasOwn(arity, command)) return false;
    if (command === 'Z') continue;
    let groups = 0;
    do {
      for (let parameter = 0; parameter < arity[command]; parameter++) {
        separator();
        if (command === 'A' && (parameter === 3 || parameter === 4)) {
          if (source[offset] !== '0' && source[offset] !== '1') return false;
          offset++;
        } else {
          number.lastIndex = offset;
          const match = number.exec(source);
          if (!match || !Number.isFinite(Number(match[0])) || Math.abs(Number(match[0])) > 1e9 || (command === 'A' && parameter < 2 && Number(match[0]) < 0)) return false;
          offset = number.lastIndex;
        }
      }
      groups++;
      separator();
    } while (offset < source.length && /[\d.+-]/.test(source[offset]));
    if (!groups) return false;
  }
  return true;
}

/** Decode the deliberately small static-data subset used by generated ESM icons. */
export function parseIcon(source: string, name: string): PreviewIcon {
  if (!iconNamePattern.test(name) || Buffer.byteLength(source) > MAX_LEAF_BYTES) throw new Error('Icon exceeds supported limits.');
  const program = parse(source, { sourceType: 'module' }).program;
  const bindings = new Map<string, Node>();
  const exports = new Map<string, string>();
  function declaration(node: Node) {
    if (node.type !== 'VariableDeclaration' || node.kind !== 'const' || !Array.isArray(node.declarations)) throw new Error('Only static const declarations are supported.');
    for (const item of node.declarations as Node[]) {
      const id = item.id as Node;
      if (id.type !== 'Identifier' || typeof id.name !== 'string' || !record(item.init) || bindings.has(id.name)) throw new Error('Invalid static binding.');
      bindings.set(id.name, item.init as Node);
    }
  }
  for (const statement of program.body) {
    if (statement.type === 'VariableDeclaration') declaration(statement as unknown as Node);
    else if (statement.type === 'ExportNamedDeclaration' && !statement.source) {
      if (statement.declaration) {
        declaration(statement.declaration as unknown as Node);
        if (statement.declaration.type === 'VariableDeclaration') for (const item of statement.declaration.declarations) if (item.id.type === 'Identifier') exports.set(item.id.name, item.id.name);
      }
      for (const item of statement.specifiers) {
        if (item.type !== 'ExportSpecifier' || item.exported.type !== 'Identifier') throw new Error('Unsupported export.');
        exports.set(item.exported.name, item.local.name);
      }
    } else if (statement.type !== 'EmptyStatement') throw new Error('Executable icon modules are not supported.');
  }
  let count = 0;
  const visiting = new Set<string>();
  const memo = new Map<string, Value>();
  function binding(key: string, depth: number): Value {
    if (visiting.has(key) || !bindings.has(key)) throw new Error('Invalid static reference.');
    if (memo.has(key)) return memo.get(key)!;
    visiting.add(key);
    const value = evaluate(bindings.get(key)!, depth + 1);
    visiting.delete(key); memo.set(key, value); return value;
  }
  function evaluate(node: Node, depth: number): Value {
    if (++count > 10000 || depth > 32) throw new Error('Static data exceeds supported limits.');
    if (node.type === 'NullLiteral') return null;
    if (node.type === 'StringLiteral' && typeof node.value === 'string') return node.value;
    if (node.type === 'NumericLiteral' && typeof node.value === 'number' && Number.isFinite(node.value)) return node.value;
    if (node.type === 'BooleanLiteral' && typeof node.value === 'boolean') return node.value;
    if (node.type === 'Identifier' && typeof node.name === 'string') return binding(node.name, depth);
    if (node.type === 'UnaryExpression' && node.operator === '!') {
      const argument = node.argument as Node;
      if (argument.type === 'NumericLiteral' && (argument.value === 0 || argument.value === 1)) return !argument.value;
    }
    if (node.type === 'UnaryExpression' && node.operator === '-') {
      const value = evaluate(node.argument as Node, depth + 1);
      if (typeof value === 'number') return -value;
    }
    if (node.type === 'ArrayExpression' && Array.isArray(node.elements)) return node.elements.map(item => {
      if (!record(item)) throw new Error('Invalid array entry.');
      return evaluate(item as Node, depth + 1);
    });
    if (node.type === 'ObjectExpression' && Array.isArray(node.properties)) {
      const result: { [key: string]: Value } = Object.create(null);
      for (const item of node.properties as Node[]) {
        if (item.type !== 'ObjectProperty' || item.computed || item.method) throw new Error('Unsupported object property.');
        const key = item.key as Node;
        const text = key.type === 'Identifier' ? key.name : key.type === 'StringLiteral' ? key.value : undefined;
        if (typeof text !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(text) || Object.hasOwn(result, text)) throw new Error('Invalid object key.');
        result[text] = evaluate(item.value as Node, depth + 1);
      }
      return result;
    }
    throw new Error('Unsupported static expression.');
  }
  // Validate every declaration, including unused ones, so calls/getters cannot hide nearby.
  for (const key of bindings.keys()) binding(key, 0);
  const target = exports.get(name);
  if (!target) throw new Error('Expected named icon export was not found.');
  const icon = binding(target, 0);
  if (!record(icon) || icon.iconName !== name || typeof icon.viewBox !== 'string' || !Array.isArray(icon.svgPathData)) throw new Error('Invalid icon definition.');
  const coordinates = icon.viewBox.trim().split(/[\s,]+/).map(Number);
  if (coordinates.length !== 4 || coordinates.some(value => !Number.isFinite(value) || Math.abs(value) > 100000) || coordinates[2] <= 0 || coordinates[3] <= 0) throw new Error('Invalid viewBox.');
  if (!icon.svgPathData.length || icon.svgPathData.length > 128) throw new Error('Invalid path count.');
  let geometryLength = 0;
  const paths = icon.svgPathData.map(item => {
    if (!record(item) || typeof item.d !== 'string' || !validGeometry(item.d)) throw new Error('Invalid path geometry.');
    geometryLength += item.d.length;
    if (geometryLength > MAX_LEAF_BYTES) throw new Error('Icon geometry exceeds supported limits.');
    if (item.fill !== undefined && item.fill !== 'currentColor' && item.fill !== 'none') throw new Error('Unsupported path fill.');
    if (item.fillOpacity !== undefined && (typeof item.fillOpacity !== 'number' || item.fillOpacity < 0 || item.fillOpacity > 1)) throw new Error('Invalid path opacity.');
    return { d: item.d, fill: item.fill as string | undefined, fillOpacity: item.fillOpacity as number | undefined };
  });
  return { name, viewBox: coordinates.join(' '), paths };
}

/** Escape every XML attribute even after geometry validation. */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

/** SVG contains only owned markup and validated local path data, with no resources. */
export function renderSvg(icon: PreviewIcon, color: string): string {
  if (!/^#[\da-f]{6}$/i.test(color)) throw new Error('Invalid preview color.');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="${escapeXml(icon.viewBox)}" color="${color}" fill="currentColor">${icon.paths.map(item => `<path d="${escapeXml(item.d)}"${item.fill ? ` fill="${escapeXml(item.fill)}"` : ''}${item.fillOpacity === undefined ? '' : ` fill-opacity="${item.fillOpacity}"`}/>`).join('')}</svg>`;
}
