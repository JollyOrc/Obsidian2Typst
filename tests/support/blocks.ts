// Test helpers for the block emitter (US-001): Markdown in, Typst and
// warnings out, through the real parser (US-014) and the real emitter.
import {
  EmitContext,
  emitBlocks,
  type BlockOptions,
  type Warning,
} from '../../src/core/emit';
import {parse, type BlockNode} from '../../src/core/parse';
import {reading} from './inline';
import type {InlineNode} from '../../src/core/parse';

export interface BlockResult {
  typ: string;
  warnings: Warning[];
}

/** Emits all blocks of `md` (frontmatter is not part of the blocks). */
export function blocks(md: string, options?: BlockOptions): BlockResult {
  const ctx = new EmitContext();
  const typ = emitBlocks(parse(md).root, ctx, options);
  return {typ, warnings: ctx.finish()};
}

/** Shorthand: only the Typst. */
export const typ = (md: string): string => blocks(md).typ;

/**
 * What Typst should read from `nodes`, derived from the tree alone (the
 * `plain()` notation of tests/support/typst-node.ts, with every run of blanks
 * and paragraph breaks squashed by {@link squashBlocks}). Lists read as
 * `<item>` or `<nN>`, headings as `<heading>`, quotes as `<quote>`, rules as `<line>`, code as its text.
 */
export function blockReading(nodes: readonly BlockNode[]): string {
  return nodes
    .map((n): string => {
      switch (n.kind) {
        case 'paragraph':
          return reading(n.children as InlineNode[]);
        case 'heading':
          return `<heading>${reading(n.children as InlineNode[])}</>`;
        case 'list':
          return n.children
            .map((item, i) => {
              const open = n.ordered ? `<n${(n.start ?? 1) + i}>` : '<item>';
              return `${open}${blockReading(item.children)}</>`;
            })
            .join(' ');
        case 'blockquote':
          return `<quote>${blockReading(n.children)}</>`;
        case 'code':
          return n.value;
        case 'thematic-break':
          return '<line>';
        case 'table':
          return n.children
            .flatMap((row) => row.children)
            .map((cell) => `<cell>${reading(cell.children)}</>`)
            .join('');
        default:
          return '';
      }
    })
    .join(' ');
}

/**
 * Structure and characters are compared without any blank or paragraph break:
 * where Typst puts a space or a break between blocks is layout, and the exact
 * strings are checked by the unit tests.
 */
export const squashBlocks = (s: string): string =>
  s.replace(/<parbreak>/g, '').replace(/\s+/g, '');
