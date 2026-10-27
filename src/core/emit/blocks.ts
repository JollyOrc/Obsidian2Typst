// US-001: the block emitter. Turns the block nodes of a document, a list item
// or a quote into Typst. Pure: no Obsidian, Node, or I/O imports.
//
// Layout (measured with the compiler, probes s23, s24, s25; US-001 AC-5b, AC-6b,
// AC-7b): blocks of one level are separated by one blank line; item content is
// indented by the width of its marker and quote content by 2; the first block of
// an item is on the marker line; a list that directly follows a paragraph inside
// an item or a quote starts on the next line. Code goes through rawBlock and is
// never escaped; Typst removes the indentation relative to the fence, so code
// text stays exact.
//
// Transforms used (shared-utility register): rawBlock; escapeMarkup, wrapEmphasis,
// rawInline and callSeparator through emitInline.
import type {AssetResolver} from '../assets';
import {EMPTY_GLOSSARY_PLAN, findCallout, type GlossaryPlan} from '../markers';
import {indexHeadings} from '../parse';
import type {BlockNode, HeadingIndex, InlineNode} from '../parse';
import {
  createCalloutRecorder,
  emitCallout,
  type CalloutRecorder,
} from './callout';
import type {EmitContext} from './context';
import {emitTermAlone, emitTermRunIn, emitUnnumberedHeading} from './glossary';
import {escapeMarkup} from './escape-markup';
import {Notes} from './footnote';
import type {PageRefEnv} from './page-refs';
import {
  emitInline,
  isImageNode,
  type InlineOptions,
  type LinkEnv,
  type Where,
} from './inline';
import {rawBlock} from './raw';
import {emitTable} from './table';
import {TaskMarkers, type FontInfo} from './tasks';

/** What every block of one export shares (US-002, US-004, US-005). */
interface BlockEnv {
  headings: HeadingIndex;
  links: LinkEnv;
  notes: Notes;
  tasks: TaskMarkers;
  assets: AssetResolver | undefined;
  /** `'footnote'` inside the body of a footnote definition. */
  where: Where;
  /** The mark that starts a block of the line map (US-015 AC-8). */
  mark: Mark;
  /** US-016: resolves callout types and records the used styles. */
  callouts: CalloutRecorder;
  /** US-017: the roles of the top-level headings under a heading rule. */
  glossary: GlossaryPlan;
  /** US-018 AC-2: page numbers after links; undefined when they are off. */
  pageRefs: Omit<PageRefEnv, 'inExplanation'> | undefined;
  /** US-018 AC-2: the blocks are inside a glossary term's explanation. */
  inExplanation: boolean;
}

type Mark = (line: number) => string;
const NO_MARK: Mark = () => '';

/** `text` with the mark of `line` in front; an empty text stays empty. */
const marked = (env: BlockEnv, line: number, text: string): string =>
  text === '' ? text : env.mark(line) + text;

/** The options every `emitInline` call of a block gets. */
const inlineOf = (env: BlockEnv): InlineOptions => ({
  links: env.links,
  notes: env.notes,
  assets: env.assets,
  where: env.where,
  pageRefs:
    env.pageRefs === undefined
      ? undefined
      : {...env.pageRefs, inExplanation: env.inExplanation},
});

/** What a rendered block is, for the separator that precedes the next block. */
type Kind = 'paragraph' | 'list' | 'other';
interface Piece {
  text: string;
  kind: Kind;
}

/** Indents every non-empty line by `n` blanks; empty lines stay empty. */
function indent(text: string, n: number): string {
  const pad = ' '.repeat(n);
  return text
    .split('\n')
    .map((line) => (line === '' ? line : pad + line))
    .join('\n');
}

/** Reports a node that no emitter converts yet (US-015 AC-12). */
function unsupported(ctx: EmitContext, kind: string, line: number): void {
  ctx.warn(
    'NODE_UNSUPPORTED',
    `No emitter for ${kind}; its text is kept`,
    line,
  );
}

/**
 * US-003 AC-1d: takes the images out of the inline nodes of a heading (also
 * from marks and links) and returns what is left, with the blanks that stood
 * around an image collapsed. Marks that become empty are dropped.
 */
function stripImages(
  nodes: readonly InlineNode[],
  found: InlineNode[],
): InlineNode[] {
  const out: InlineNode[] = [];
  let dropped = false;
  for (const node of nodes) {
    if (isImageNode(node)) {
      found.push(node);
      dropped = true;
      continue;
    }
    let kept: InlineNode = node;
    if ('children' in node && Array.isArray(node.children)) {
      const before = found.length;
      const children = stripImages(node.children as InlineNode[], found);
      if (found.length > before && children.length === 0) {
        dropped = true;
        continue;
      }
      kept = {...node, children} as InlineNode;
    }
    const last = out.at(-1);
    if (
      dropped &&
      kept.kind === 'text' &&
      last?.kind === 'text' &&
      /\s$/.test(last.value)
    ) {
      kept = {...kept, value: kept.value.replace(/^\s+/, '')};
    }
    dropped = false;
    out.push(kept);
  }
  return out;
}

const TAG = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g;

/**
 * US-001 AC-9d: the inline nodes of an HTML block. Text lines become text and
 * soft breaks, tags and comments become the nodes the parser gives for inline
 * HTML, each with the line it starts on.
 */
function htmlNodes(value: string, firstLine: number): InlineNode[] {
  const nodes: InlineNode[] = [];
  let line = firstLine;
  const text = (chunk: string): void => {
    chunk.split('\n').forEach((part, i) => {
      if (i > 0) {
        nodes.push({kind: 'softbreak', line});
        line += 1;
      }
      if (part !== '') nodes.push({kind: 'text', line, value: part});
    });
  };
  let last = 0;
  for (const match of value.matchAll(TAG)) {
    const raw = match[0];
    text(value.slice(last, match.index));
    if (raw.startsWith('<!--')) {
      nodes.push({kind: 'comment', line, value: raw});
    } else {
      const name = /^<\/?([A-Za-z][A-Za-z0-9-]*)/.exec(raw)?.[1] ?? '';
      nodes.push({
        kind: 'html-inline',
        line,
        name: name.toLowerCase(),
        closing: raw.startsWith('</'),
        value: raw,
      });
    }
    line += raw.split('\n').length - 1;
    last = match.index + raw.length;
  }
  text(value.slice(last));
  return nodes;
}

/** Joins non-empty pieces; see AC-1d and AC-5b for the separators. */
function join(pieces: readonly Piece[], nested: boolean): string {
  let out = '';
  let previous: Piece | undefined;
  for (const piece of pieces) {
    if (piece.text === '') continue;
    if (previous !== undefined) {
      const tight =
        nested && previous.kind === 'paragraph' && piece.kind === 'list';
      out += tight ? '\n' : '\n\n';
    }
    out += piece.text;
    previous = piece;
  }
  return out;
}

/** One list: marker, first block on the marker line, the rest indented. */
function renderList(
  list: Extract<BlockNode, {kind: 'list'}>,
  ctx: EmitContext,
  env: BlockEnv,
): string {
  return list.children
    .map((item, index) => {
      const lead =
        item.checked === null
          ? undefined
          : env.tasks.marker(item.checked, item.line);
      const marker = list.ordered ? `${(list.start ?? 1) + index}. ` : '- ';
      const body = renderBlocks(item.children, ctx, true, env, lead);
      const at = env.mark(item.line);
      if (body === '') return at + marker.trimEnd();
      return at + marker + indent(body, marker.length).slice(marker.length);
    })
    .join('\n');
}

/** A row of a table as text: the cells separated by ` | ` (AC-16). */
function rowText(
  row: Extract<BlockNode, {kind: 'row'}>,
  ctx: EmitContext,
  env: BlockEnv,
): string {
  return row.children
    .map((cell) => emitInline(cell.children, ctx, inlineOf(env)))
    .join(' | ');
}

/**
 * US-001 AC-1d, AC-5b, AC-6b, AC-7b, AC-8, AC-9d, AC-15b, AC-16: renders one
 * level of blocks. `nested` is true inside a list item or a quote, where a list
 * directly after a paragraph is not separated by a blank line.
 */
function renderBlocks(
  blocks: readonly BlockNode[],
  ctx: EmitContext,
  nested: boolean,
  outer: BlockEnv,
  lead?: string,
): string {
  const pieces: Piece[] = blocks.map((block, position): Piece => {
    // US-018 AC-2: a top-level block of a term's explanation, and everything
    // inside it, is in the explanation.
    const env =
      !nested && outer.glossary.explanations.has(block)
        ? {...outer, inExplanation: true}
        : outer;
    switch (block.kind) {
      case 'paragraph': {
        // US-017 AC-4: printed by the run-in term before it.
        if (env.glossary.consumed.has(block)) {
          return {text: '', kind: 'paragraph'};
        }
        // US-005 AC-6: the marker of a task item starts its first paragraph.
        const first = lead !== undefined && position === 0;
        const text = emitInline(block.children, ctx, {
          ...inlineOf(env),
          atBlockStart: !first,
        });
        const joined = first ? [lead, text].filter((p) => p !== '') : [text];
        return {
          text: marked(env, block.line, joined.join(' ')),
          kind: 'paragraph',
        };
      }
      case 'heading': {
        if (env.where === 'footnote') {
          // US-005 AC-4d: a heading in a note is a plain paragraph.
          const text = emitInline(block.children, ctx, {
            ...inlineOf(env),
            breaks: 'space',
          });
          return {text, kind: 'paragraph'};
        }
        // US-003 AC-1d: an image is not part of the heading line.
        const images: InlineNode[] = [];
        const children =
          env.assets === undefined
            ? block.children
            : stripImages(block.children, images);
        // US-017 AC-4, AC-14: a term and a heading inside a term start a
        // content block, so their text is escaped at block start.
        const role = env.glossary.roles.get(block);
        // US-002: the children go through emitInline even for an empty heading,
        // so that a comment in it is still counted.
        let text = emitInline(children, ctx, {
          ...inlineOf(env),
          atBlockStart: role !== undefined,
          breaks: 'space',
          where: 'heading',
        });
        if (images.length > 0) text = text.trim();
        const figures = images.map((image) => {
          ctx.warn(
            'IMAGE_IN_HEADING',
            'Image in a heading placed after the heading',
            image.line,
          );
          return emitInline([image], ctx, inlineOf(env));
        });
        const info = env.headings.byNode.get(block);
        if (info === undefined) {
          ctx.warn('HEADING_EMPTY', 'Empty heading omitted', block.line);
          return {text: figures.join('\n\n'), kind: 'other'};
        }
        if (info.skippedFrom !== null) {
          ctx.warn(
            'HEADING_LEVEL_SKIPPED',
            `Heading level jumps from ${info.skippedFrom} to ${info.depth}`,
            block.line,
          );
        }
        let line: string;
        if (role?.kind === 'term') {
          // US-017 AC-4, AC-5: the paragraph after a run-in term is emitted
          // here, as at the start of a paragraph; the loop skips it.
          line =
            role.runIn === null
              ? emitTermAlone(text, info.label)
              : emitTermRunIn(
                  text,
                  info.label,
                  // US-018 AC-2: the run-in paragraph is in the explanation.
                  emitInline(role.runIn.children, ctx, {
                    ...inlineOf({...env, inExplanation: true}),
                    atBlockStart: true,
                  }),
                );
        } else if (role?.kind === 'in-term') {
          line = emitUnnumberedHeading(block.depth, text, info.label);
        } else {
          line = ['='.repeat(block.depth), text, `<${info.label}>`]
            .filter((part) => part !== '')
            .join(' ');
        }
        return {
          // US-017 AC-8: images of a term follow its run-in paragraph.
          text: [marked(env, block.line, line), ...figures].join('\n\n'),
          kind:
            role?.kind === 'term' && role.runIn !== null
              ? 'paragraph'
              : 'other',
        };
      }
      case 'list':
        return {text: renderList(block, ctx, env), kind: 'list'};
      case 'blockquote': {
        // US-016 AC-1 to AC-6, AC-10: a callout is its own call, also with an
        // empty body; a plain quote is unchanged.
        const callout = findCallout(block);
        if (callout !== null) {
          const {header} = callout;
          const choice = env.callouts.use(header.type, header.typed);
          if (!choice.known) {
            ctx.warn(
              'CALLOUT_TYPE_UNKNOWN',
              `No style for callout type "${header.typed}"; the default box is used`,
              callout.line,
            );
          }
          const title =
            callout.title.length > 0
              ? emitInline(callout.title, ctx, {
                  ...inlineOf(env),
                  atBlockStart: true,
                })
              : choice.defaultTitle === ''
                ? null
                : escapeMarkup(choice.defaultTitle, {atBlockStart: true});
          const inner = renderBlocks(callout.body, ctx, true, env);
          const text = emitCallout(
            choice.name,
            title,
            inner === '' ? '' : indent(inner, 2),
          );
          return {text: marked(env, block.line, text), kind: 'other'};
        }
        const body = renderBlocks(block.children, ctx, true, env);
        const text =
          body === '' ? '' : `#quote(block: true)[\n${indent(body, 2)}\n]`;
        return {text: marked(env, block.line, text), kind: 'other'};
      }
      case 'code':
        return {
          text: marked(env, block.line, rawBlock(block.value, block.lang)),
          kind: 'other',
        };
      case 'thematic-break':
        return {
          text: marked(env, block.line, '#line(length: 100%)'),
          kind: 'other',
        };
      case 'comment':
        ctx.commentDropped(block.line);
        return {text: '', kind: 'other'};
      case 'html-block':
        return {
          text: emitInline(
            htmlNodes(block.value, block.line),
            ctx,
            inlineOf(env),
          ),
          kind: 'paragraph',
        };
      case 'table':
        return {
          text: emitTable(
            block,
            ctx,
            (cell) =>
              emitInline(cell.children, ctx, {
                ...inlineOf(env),
                breaks: 'call',
              }),
            env.mark,
          ),
          kind: 'other',
        };
      case 'footnote-def':
        // US-005 AC-4: a definition is written where it is referenced.
        return {text: '', kind: 'other'};
      case 'item':
        unsupported(ctx, 'item', block.line);
        return {
          text: renderBlocks(block.children, ctx, true, env),
          kind: 'other',
        };
      case 'row':
        unsupported(ctx, 'row', block.line);
        return {text: rowText(block, ctx, env), kind: 'paragraph'};
      case 'cell':
        unsupported(ctx, 'cell', block.line);
        return {
          text: emitInline(block.children, ctx, inlineOf(env)),
          kind: 'paragraph',
        };
      default: {
        // US-015 AC-12: a kind added to the tree later is never lost silently.
        const node = block as unknown as {
          kind: string;
          line: number;
          children?: unknown;
          value?: unknown;
        };
        unsupported(ctx, node.kind, node.line);
        const text = Array.isArray(node.children)
          ? emitInline(node.children as InlineNode[], ctx, inlineOf(env))
          : typeof node.value === 'string'
            ? escapeMarkup(node.value, {atBlockStart: true})
            : '';
        return {text, kind: 'paragraph'};
      }
    }
  });
  if (lead !== undefined && blocks[0]?.kind !== 'paragraph') {
    // The first block is not a paragraph (or there is none): marker alone.
    pieces.unshift({text: lead, kind: 'paragraph'});
  }
  return join(pieces, nested);
}

/** Options of {@link emitBlocks}. */
export interface BlockOptions {
  /**
   * Labels and levels of all headings of the document (US-002). Default: the
   * index of `blocks`. The pipeline passes one index for the whole document,
   * so that nested calls and the link resolver (US-004) use the same labels.
   */
  headings?: HeadingIndex;
  /** US-004 AC-1c: spell out external addresses in footnotes (default true). */
  externalLinkFootnotes?: boolean;
  /** US-005 AC-6: answers whether the body font has the task-list glyphs. */
  fonts?: FontInfo;
  /** US-005 AC-6: the effective body font family (default: Typst's own). */
  bodyFamily?: string;
  /**
   * US-003 AC-8: finds and checks image files. Without it images keep their
   * alt text and report `NODE_UNSUPPORTED`. A `headings` index passed with it
   * must be made with `indexHeadings(blocks, {dropImages: true})`.
   */
  assets?: AssetResolver;
  /**
   * US-016 AC-8, AC-10: resolves callout types and records the used styles.
   * Default: a recorder over the built-in styles only.
   */
  callouts?: CalloutRecorder;
  /**
   * US-018 AC-2, AC-3: write `#page-ref(<label>)` after the selected internal
   * links (`level`; `record` is called for each call). Default: none.
   */
  pageRefs?: Omit<PageRefEnv, 'inExplanation'>;
  /**
   * US-017: the glossary plan of `blocks` (`findGlossary` over the same
   * `headings`). Default: no rule applies.
   */
  glossary?: GlossaryPlan;
  /**
   * US-015 AC-8: text put at the start of every heading, paragraph, item, quote,
   * code block, rule, table and table row (not inside a footnote definition),
   * given the source line. The pipeline uses it to build the line map and
   * removes it again. Default: none.
   */
  mark?: (line: number) => string;
}

/**
 * US-001 (block part of AC-1 to AC-16) | US-015 AC-12: Typst for the blocks of
 * a document.
 *
 * Reports dropped or unsupported markup into `ctx` and keeps the text of every
 * node. Assumes `blocks` come from `parse` (US-014); the frontmatter is not part
 * of them (AC-10). The result has no blank line at its start or end. Never
 * changes `blocks`; the same input gives the same output.
 */
export function emitBlocks(
  blocks: readonly BlockNode[],
  ctx: EmitContext,
  options: BlockOptions = {},
): string {
  const headings =
    options.headings ??
    indexHeadings(blocks, {dropImages: options.assets !== undefined});
  const links = {
    headings,
    externalLinkFootnotes: options.externalLinkFootnotes ?? true,
  };
  const tasks = new TaskMarkers(ctx, options.fonts, options.bodyFamily);
  const mark = options.mark ?? NO_MARK;
  const callouts = options.callouts ?? createCalloutRecorder();
  const glossary = options.glossary ?? EMPTY_GLOSSARY_PLAN;
  const base = {
    headings,
    links,
    tasks,
    assets: options.assets,
    mark,
    callouts,
    glossary,
    pageRefs: options.pageRefs,
  };
  // US-018 AC-2: a footnote called from an explanation is part of it; the
  // definitions are not top-level blocks of a term, so nothing else sets it.
  const notes: Notes = new Notes(blocks, ctx, (def, inExplanation, noteCtx) =>
    renderBlocks(def.children, noteCtx, false, {
      ...base,
      notes,
      where: 'footnote',
      mark: NO_MARK,
      inExplanation,
    }),
  );
  const text = renderBlocks(blocks, ctx, false, {
    ...base,
    notes,
    where: 'body',
    inExplanation: false,
  });
  notes.finish();
  return text;
}
