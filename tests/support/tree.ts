// Test helpers for the Markdown tree of US-014 (core/parse).
import {parse, type TreeNode} from '../../src/core/parse';

export const children = (n: TreeNode): TreeNode[] =>
  'children' in n ? (n.children as TreeNode[]) : [];

/** Every node, parents before children, in document order. */
export function all(nodes: readonly TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const visit = (n: TreeNode) => {
    out.push(n);
    children(n).forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

export const root = (md: string) => parse(md).root;

export const nodesOf = (md: string, kind: string) =>
  all(root(md)).filter((n) => n.kind === kind);

export const has = (
  md: string,
  kind: string,
  pred: (n: TreeNode) => boolean = () => true,
) => nodesOf(md, kind).some(pred);

/** Kinds from the top to the first node of `kind`, e.g. heading > link. */
export function chain(md: string, kind: string): string[] {
  const walk = (n: TreeNode, path: string[]): string[] | null => {
    const here = [...path, n.kind];
    if (n.kind === kind) return here;
    for (const c of children(n)) {
      const r = walk(c, here);
      if (r) return r;
    }
    return null;
  };
  for (const n of root(md)) {
    const r = walk(n, []);
    if (r) return r;
  }
  throw new Error(`no ${kind} in ${JSON.stringify(md)}`);
}

/** Reading text of a node: text, code, and image alt text. */
export function textOf(n: TreeNode): string {
  switch (n.kind) {
    case 'text':
    case 'code-inline':
    case 'code':
      return n.value;
    case 'image':
      return n.alt;
    case 'softbreak':
    case 'break':
      return ' ';
    default:
      return children(n).map(textOf).join('');
  }
}
