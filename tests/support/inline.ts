// Test helpers for the inline emitter (US-001): Markdown in, Typst and
// warnings out, through the real parser (US-014) and the real emitter.
import {
  EmitContext,
  emitInline,
  type InlineOptions,
  type Warning,
} from '../../src/core/emit';
import {parse, type BlockNode, type InlineNode} from '../../src/core/parse';

/** The inline children of a block (paragraph, heading, cell). */
export function inlineOf(block: BlockNode | undefined): InlineNode[] {
  if (block === undefined || !('children' in block)) {
    throw new Error('block without inline children');
  }
  return block.children as InlineNode[];
}

export interface Converted {
  typ: string;
  warnings: Warning[];
}

/** Emits the inline content of the first block of `md`. */
export function inline(md: string, options?: InlineOptions): Converted {
  const ctx = new EmitContext();
  const typ = emitInline(inlineOf(parse(md).root[0]), ctx, options);
  return {typ, warnings: ctx.finish()};
}

/** Shorthand: only the Typst of the first block. */
export const typ = (md: string): string => inline(md).typ;

/**
 * Emits every paragraph of `md` with one shared context, as an export does.
 * Returns the Typst of each paragraph and the warnings of the whole export.
 */
export function paragraphs(md: string): {typs: string[]; warnings: Warning[]} {
  const ctx = new EmitContext();
  const typs = parse(md)
    .root.filter((b) => b.kind === 'paragraph')
    .map((b) => emitInline(inlineOf(b), ctx));
  return {typs, warnings: ctx.finish()};
}

/** Emits a hand-built inline list (shapes the parser does not produce). */
export function emitNodes(nodes: InlineNode[]): Converted {
  const ctx = new EmitContext();
  const typ = emitInline(nodes, ctx);
  return {typ, warnings: ctx.finish()};
}

const TAGS: Partial<Record<InlineNode['kind'], string>> = {
  strong: 'strong',
  emph: 'emph',
  delete: 'strike',
  mark: 'highlight',
};

/**
 * What Typst should read from `nodes` (the `plain()` notation of
 * tests/support/typst-node.ts), derived from the tree alone, so that it does
 * not depend on the emitter under test. Covers text, code, emphasis, strike,
 * highlight and breaks; any other node reads as its children's text.
 */
export function reading(nodes: readonly InlineNode[]): string {
  return nodes
    .map((n): string => {
      switch (n.kind) {
        case 'text':
        case 'code-inline':
          return n.value;
        case 'softbreak':
          return ' ';
        case 'break':
          return '\n';
        case 'strong':
        case 'emph':
        case 'delete':
        case 'mark': {
          const inner = reading(n.children);
          return inner === '' ? '' : `<${TAGS[n.kind]}>${inner}</>`;
        }
        case 'link':
        case 'inline-footnote':
          return reading(n.children);
        case 'html-inline':
          return n.name === 'br' && !n.closing ? '\n' : '';
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Typst collapses runs of blanks and ignores blanks at the start of a line
 * (the newline after a `\\` line break reads as a space in the content tree,
 * and layout drops it); compare without them.
 */
export const squash = (s: string): string =>
  s.replace(/ +/g, ' ').replace(/\n /g, '\n');
