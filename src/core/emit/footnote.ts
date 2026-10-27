// US-005: footnotes. Pure: no Obsidian, Node, or I/O imports.
//
// A definition emits nothing at its own place; every reference writes the text
// of its definition in place (`#footnote[...]`). The body of a definition is
// rendered once per export, so a warning inside it is reported once. US-018:
// a footnote called from a glossary explanation is a second variant (its
// links follow the explanation rule); it is rendered once more, with a
// context whose warnings are dropped, so each warning is still reported once.
import type {BlockNode, FootnoteDefNode} from '../parse';
import {EmitContext} from './context';

/** US-005 AC-4b: footnote numbers restart at every level-1 heading. */
export const FOOTNOTE_RESTART_RULE =
  '#show heading.where(level: 1): it => { counter(footnote).update(0); it }';

/**
 * US-005 AC-4: `#footnote[...]` around a rendered body. A body of one line is
 * written inline; a body with a line break (several blocks, a list, code) in
 * the block form, indented by two blanks.
 */
export function footnoteCall(body: string): string {
  if (!body.includes('\n')) return `#footnote[${body}]`;
  const indented = body
    .split('\n')
    .map((line) => (line === '' ? line : `  ${line}`))
    .join('\n');
  return `#footnote[\n${indented}\n]`;
}

/** What `emitInline` needs to write the footnotes of a document. */
export interface NoteEnv {
  /**
   * The Typst of the footnote `label`, or null if there is none (undefined
   * label, or `nested`: a footnote inside a footnote is omitted). Marks the
   * definition as used. US-018 AC-2: `inExplanation` (default false) is true
   * when the call is in a glossary explanation.
   */
  reference(
    label: string,
    line: number,
    nested: boolean,
    inExplanation?: boolean,
  ): string | null;
}

/** Every footnote definition of `blocks`, in document order. */
function definitions(blocks: readonly BlockNode[]): FootnoteDefNode[] {
  const out: FootnoteDefNode[] = [];
  const visit = (nodes: readonly BlockNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'footnote-def') out.push(node);
      else if (
        node.kind === 'blockquote' ||
        node.kind === 'list' ||
        node.kind === 'item'
      ) {
        visit(node.children);
      }
    }
  };
  visit(blocks);
  return out;
}

/** The footnotes of one export (US-005 AC-4, AC-4d). */
export class Notes implements NoteEnv {
  private readonly first = new Map<string, FootnoteDefNode>();
  private readonly repeated: FootnoteDefNode[] = [];
  private readonly used = new Set<string>();
  private readonly text = new Map<string, string>();

  constructor(
    blocks: readonly BlockNode[],
    private readonly ctx: EmitContext,
    /**
     * Renders the blocks of a definition as the body of a footnote, in or out
     * of a glossary explanation (US-018), reporting into `ctx`.
     */
    private readonly body: (
      def: FootnoteDefNode,
      inExplanation: boolean,
      ctx: EmitContext,
    ) => string,
  ) {
    for (const def of definitions(blocks)) {
      if (this.first.has(def.label)) this.repeated.push(def);
      else this.first.set(def.label, def);
    }
  }

  reference(
    label: string,
    line: number,
    nested: boolean,
    inExplanation = false,
  ): string | null {
    const def = this.first.get(label);
    if (def === undefined) {
      if (!nested) {
        this.ctx.warn(
          'FOOTNOTE_UNDEFINED',
          `Footnote "${label}" has no definition`,
          line,
        );
      }
      return null;
    }
    this.used.add(label);
    if (nested) return null;
    const key = `${inExplanation ? 'e' : 'b'}:${label}`;
    let call = this.text.get(key);
    if (call === undefined) {
      const other = `${inExplanation ? 'b' : 'e'}:${label}`;
      // The second variant reports nothing: the first one did (US-018).
      const ctx = this.text.has(other) ? new EmitContext() : this.ctx;
      call = footnoteCall(this.body(def, inExplanation, ctx));
      this.text.set(key, call);
    }
    return call;
  }

  /** Reports the definitions that were never used (call after all text). */
  finish(): void {
    for (const [label, def] of this.first) {
      if (!this.used.has(label)) {
        this.ctx.warn(
          'FOOTNOTE_UNUSED',
          `Footnote "${label}" is never referenced`,
          def.line,
        );
      }
    }
    for (const def of this.repeated) {
      this.ctx.warn(
        'FOOTNOTE_UNUSED',
        `Footnote "${def.label}" is defined again; the later definition is not used`,
        def.line,
      );
    }
  }
}
