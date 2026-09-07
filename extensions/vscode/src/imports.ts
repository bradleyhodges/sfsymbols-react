import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { iconNamePattern } from './static-data';

const packageName = '@bradleyhodges/sfsymbols';
type Tree = ReturnType<typeof parse>;
function syntax(source: string, language: string): Tree {
  if (Buffer.byteLength(source) > 1024 * 1024) throw new Error('Document exceeds the 1 MiB editing limit.');
  return parse(source, { sourceType: 'module', plugins: [...(language.startsWith('typescript') ? ['typescript' as const] : []), ...(language.endsWith('react') || language === 'javascript' ? ['jsx' as const] : [])] });
}
function imports(tree: Tree) {
  const values = new Map<string, string>();
  const namespaces: string[] = [];
  for (const node of tree.program.body) {
    if (node.type !== 'ImportDeclaration' || node.importKind === 'type' || node.importKind === 'typeof') continue;
    const module = node.source.value;
    for (const item of node.specifiers) {
      if (item.type === 'ImportNamespaceSpecifier' && module === packageName) namespaces.push(item.local.name);
      if (item.type !== 'ImportSpecifier' || item.importKind === 'type' || item.importKind === 'typeof') continue;
      const name = item.imported.type === 'Identifier' ? item.imported.name : item.imported.value;
      if (iconNamePattern.test(name) && (module === packageName || module === `${packageName}/${name}`)) values.set(item.local.name, name);
    }
  }
  return { values, namespaces };
}

function nodes(tree: unknown, visit: (node: Record<string, unknown>) => void): void {
  const stack: unknown[] = [tree];
  let count = 0;
  while (stack.length) {
    if (++count > 200000) throw new Error('Document syntax exceeds supported limits.');
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) { stack.push(...value); continue; }
    const node = value as Record<string, unknown>;
    if (typeof node.type === 'string') visit(node);
    for (const [key, item] of Object.entries(node)) if (!['loc', 'comments', 'tokens', 'leadingComments', 'trailingComments', 'innerComments'].includes(key) && item && typeof item === 'object') stack.push(item);
  }
}

/** Recognize exact imported identifiers in parsed source, never text in strings/comments. */
export function findIconAt(source: string, offset: number, language: string): string | undefined {
  const tree = syntax(source, language);
  const { values, namespaces } = imports(tree);
  let name: string | undefined;
  traverse(tree, {
    Identifier(location) {
      const node = location.node;
      if (node.start == null || node.end == null || offset < node.start || offset >= node.end) return;
      const parent = location.parentPath;
      const importDeclaration = parent.isImportSpecifier();
      const binding = location.scope.getBinding(importDeclaration ? parent.node.local.name : node.name);
      if (binding?.path.isImportSpecifier() && (importDeclaration || location.isReferencedIdentifier())) name = values.get(binding.identifier.name);
    },
    MemberExpression(location) {
      const { object, property, computed } = location.node;
      if (computed || object.type !== 'Identifier' || property.type !== 'Identifier' || property.start == null || property.end == null || offset < property.start || offset >= property.end) return;
      const binding = location.scope.getBinding(object.name);
      if (binding?.path.isImportNamespaceSpecifier() && namespaces.includes(object.name) && iconNamePattern.test(property.name)) name = property.name;
    },
  });
  return name;
}

export interface ImportPlan { offset: number; text: string; binding: string }
/** Add one exact leaf import; preserve existing aliases, namespace imports and directives. */
export function planImport(source: string, name: string, language: string): ImportPlan {
  if (!iconNamePattern.test(name)) throw new Error('Invalid icon name.');
  const tree = syntax(source, language);
  const { values, namespaces } = imports(tree);
  for (const [binding, imported] of values) if (imported === name) return {offset:0, text:'', binding};
  if (namespaces.length) return {offset:0, text:'', binding:`${namespaces[0]}.${name}`};
  const occupied = new Set<string>();
  nodes(tree.program, node => { if (node.type === 'Identifier' && typeof node.name === 'string') occupied.add(node.name); });
  let binding = name, suffix = 2;
  while (occupied.has(binding)) binding = `${name}${suffix++}`;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let offset = tree.program.interpreter?.end ?? 0;
  for (const directive of tree.program.directives) offset = Math.max(offset, directive.end ?? 0);
  for (const node of tree.program.body) if (node.type === 'ImportDeclaration') offset = Math.max(offset, node.end ?? 0);
  const specifier = binding === name ? name : `${name} as ${binding}`;
  return { offset, binding, text: `${offset ? newline : ''}import { ${specifier} } from '${packageName}/${name}';${offset ? '' : newline}` };
}
