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
import {
  emitTermAlone,
  emitTermRunIn,
  emitUnlistedHeading,
  emitUnnumberedHeading,
} from './glossary';
import {escapeMarkup} from './escape-markup';
import {Notes} from './footnote';
import type {PageRefEnv} from './page-refs';
import {
  emitInline,
  isImageNode,
  type InlineFit,
  type InlineOptions,
  type LinkEnv,
  type Where,
} from './inline';
import {breakLines, mergeRules, ruleOf, type BreakOptions} from './breaks';
import {ptLength} from './length';
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
  /** US-025: the break rules; undefined when no level breaks. */
  breaks: BreakOptions | undefined;
  /** US-026 AC-2: headings written as their label marker only. */
  hidden: ReadonlySet<BlockNode>;
  /** US-026 AC-3 to AC-6: the book's page lines; undefined without parts. */
  book: BookLines | undefined;
  /** US-027 AC-3: nested headings are kept out of the contents. */
  unlistNested: boolean;
  /** US-028: the image fit; undefined when the rule is off or in a footnote. */
  fit: BlockFit | undefined;
}

/** US-028 AC-3, AC-6: a reserve with its pt and em parts kept apart. */
interface Reserve {
  pt: number;
  em: number;
}

/**
 * US-028 | AC-2, AC-3, AC-6: the image fit of a level of blocks. `reserve`
 * is null at the top level (floats allowed, unless the block is in
 * `noFloat`), the sum of the enclosing containers' reserves inside them.
 */
interface BlockFit {
  min: number;
  sides: boolean;
  /** Top-level blocks whose images never float (the back notes, decision 7). */
  noFloat: ReadonlySet<BlockNode>;
  reserve: Reserve | null;
}

const NO_RESERVE: Reserve = {pt: 0, em: 0};

/**
 * US-028 | AC-6: the measured reserve of a quote (`#quote(block: true)`):
 * 2.4 em held at text sizes 9, 11, 14 pt and block spacings 0.6 em and 2 em
 * (2026-10-28, 2026-10-29); why is not verified (SCAR-024).
 */
const QUOTE_RESERVE: Reserve = {pt: 0, em: 2.4};

/** A sum of reserves without the noise of binary fractions (4 decimals). */
const round = (n: number): number => Number(n.toFixed(4));

/**
 * US-028 | AC-3: a reserve as written: the pt part, then the em part, a zero
 * part left out, `0pt` when both are zero (`8.75pt + 2.4em`, `17.5pt`,
 * `4.8em`).
 */
function reserveText(reserve: Reserve): string {
  const parts: string[] = [];
  if (reserve.pt !== 0) parts.push(ptLength(reserve.pt));
  if (reserve.em !== 0) parts.push(`${reserve.em}em`);
  return parts.length === 0 ? '0pt' : parts.join(' + ');
}

/**
 * US-028 | AC-6 (decision 3): the environment inside a container (callout,
 * quote, list item): floats off, the container's reserve added to the
 * enclosing ones, pt and em apart. Unchanged without the rule.
 */
function within(env: BlockEnv, add: Reserve): BlockEnv {
  if (env.fit === undefined) return env;
  const outer = env.fit.reserve ?? NO_RESERVE;
  return {
    ...env,
    fit: {
      ...env.fit,
      reserve: {pt: round(outer.pt + add.pt), em: round(outer.em + add.em)},
    },
  };
}

/**
 * US-028 | AC-2 to AC-4, AC-6 (decisions 5, 7): the fit of the images of one
 * paragraph: at the top level they may float, except in `noFloat` (written
 * `floats: false, reserve: 0pt`); in a container never, with the summed
 * reserve. `breakAfter` (top level only) keeps the paragraph's last image
 * from floating before a written page break.
 */
function fitOf(
  env: BlockEnv,
  block: BlockNode,
  breakAfter: boolean,
): InlineFit | undefined {
  if (env.fit === undefined) return undefined;
  const reserve =
    env.fit.reserve ?? (env.fit.noFloat.has(block) ? NO_RESERVE : null);
  return {
    min: env.fit.min,
    sides: env.fit.sides,
    floats: reserve === null,
    reserve: reserve === null ? null : reserveText(reserve),
    breakAfter: reserve === null && breakAfter,
  };
}

/**
 * US-026 | AC-3 to AC-6: The lines the book parts put between top-level
 * blocks (written by `breaks.ts`, placed by the conversion).
 */
export interface BookLines {
  /** Lines in front of a top-level block (a part's or the first chapter's heading). */
  before: ReadonlyMap<BlockNode, string>;
  /** Lines after the last top-level block, or null. */
  end: string | null;
  /**
   * Top-level headings that never get a US-025 break: the part headings
   * (their pages are set by AC-3, AC-5) and the first chapter (its rule
   * replaces the `h1` rule, AC-3).
   */
  noBreak: ReadonlySet<BlockNode>;
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
      // US-028 AC-6: a list item reserves nothing; its images never float.
      const body = renderBlocks(
        item.children,
        ctx,
        true,
        within(env, NO_RESERVE),
        lead,
      );
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
  // US-025, US-026, US-027: the lines put in front of the top-level blocks
  // of the body and after the last one; US-028 reads them before the blocks
  // are written (a page break after an image's paragraph).
  const top =
    !nested && outer.where === 'body' ? topLines(blocks, outer) : null;
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
          // US-028 AC-2: the paragraph's own images follow the rule.
          fit: fitOf(
            env,
            block,
            top !== null && pageBreakAfter(blocks, position, top),
          ),
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
        // US-027 AC-3 (decision 4): with the contents on, a heading in a
        // callout, quote or list item is a `#heading(…)` call, too.
        const unlisted = nested && env.unlistNested && role === undefined;
        // US-002: the children go through emitInline even for an empty heading,
        // so that a comment in it is still counted.
        let text = emitInline(children, ctx, {
          ...inlineOf(env),
          atBlockStart: role !== undefined || unlisted,
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
        // US-026 AC-2: a hidden part heading keeps its label for links and
        // page references; nothing is printed.
        if (env.hidden.has(block)) {
          return {
            text: [`#metadata(none) <${info.label}>`, ...figures].join('\n\n'),
            kind: 'other',
          };
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
        } else if (unlisted) {
          line = emitUnlistedHeading(block.depth, text, info.label);
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
          // US-028 AC-6: the box's bottom inset and border are reserved.
          const inner = renderBlocks(
            callout.body,
            ctx,
            true,
            within(env, {pt: choice.reserve, em: 0}),
          );
          const text = emitCallout(
            choice.name,
            title,
            inner === '' ? '' : indent(inner, 2),
          );
          return {text: marked(env, block.line, text), kind: 'other'};
        }
        const body = renderBlocks(
          block.children,
          ctx,
          true,
          within(env, QUOTE_RESERVE),
        );
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
  if (top !== null) {
    pieces.forEach((piece, i) => {
      const lines = top.before[i];
      if (lines === undefined) return;
      pieces[i] = {
        ...piece,
        text: piece.text === '' ? lines : `${lines}\n${piece.text}`,
      };
    });
    if (top.end !== null) pieces.push({text: top.end, kind: 'other'});
  }
  if (lead !== undefined && blocks[0]?.kind !== 'paragraph') {
    // The first block is not a paragraph (or there is none): marker alone.
    pieces.unshift({text: lead, kind: 'paragraph'});
  }
  return join(pieces, nested);
}

/** US-025, US-026, US-027: the lines in front of each top-level block and after the last. */
interface TopLines {
  before: (string | undefined)[];
  end: string | null;
}

/**
 * US-025 | AC-2 to AC-5, US-026 | AC-3 to AC-6: The lines in front of the
 * top-level blocks of the body: the book's lines (`book.before`) first, then
 * the break lines of the headings that break, and the book's lines after the
 * last block. A heading breaks when it is not empty and is neither a glossary
 * term nor a heading inside a term (`env.glossary.roles`; the heading of a
 * glossary section itself breaks by its level), nor hidden, nor in
 * `book.noBreak` (the book's own lines set its page, so the two never meet).
 * Headings that follow each other with no block between them form a run that
 * gets one break, before its first heading, with the strongest of their rules
 * (AC-4). The first block of the body is no exception (decision 1). Called
 * only for the top level of the body: a break in a container cannot compile.
 */
function topLines(blocks: readonly BlockNode[], env: BlockEnv): TopLines {
  const before: (string | undefined)[] = blocks.map(() => undefined);
  const {breaks, book} = env;
  if (breaks !== undefined) {
    const breaking = (block: BlockNode | undefined): number | null =>
      block?.kind === 'heading' &&
      !env.glossary.roles.has(block) &&
      !env.hidden.has(block) &&
      book?.noBreak.has(block) !== true &&
      env.headings.byNode.has(block)
        ? block.depth
        : null;
    let i = 0;
    while (i < blocks.length) {
      const first = breaking(blocks[i]);
      if (first === null) {
        i++;
        continue;
      }
      const run = [ruleOf(breaks.rules, first)];
      let j = i + 1;
      for (let depth = breaking(blocks[j]); depth !== null;) {
        run.push(ruleOf(breaks.rules, depth));
        j++;
        depth = breaking(blocks[j]);
      }
      const lines = breakLines(mergeRules(run), breaks.facingPages);
      if (lines !== null) before[i] = lines;
      i = j;
    }
  }
  if (book !== undefined) {
    blocks.forEach((block, i) => {
      const lines = book.before.get(block);
      if (lines === undefined) return;
      const known = before[i];
      before[i] = known === undefined ? lines : `${lines}\n${known}`;
    });
  }
  return {before, end: book?.end ?? null};
}

/** A line that breaks the page (`breaks.ts` is its only writer). */
const PAGE_BREAK_LINE = /^#pagebreak\(/m;

/**
 * US-028 | AC-3, AC-4 (decisions 5, 10): true when nothing after `position`
 * can fill the page below an image: the next top-level block (comments and
 * footnote definitions write nothing and are skipped) starts with a written
 * page break — a US-025 heading break, the first chapter after the front
 * matter, the back notes' start, contents in the body — or no top-level
 * block follows (the note's end, also before the end padding or contents at
 * the end). The one decider of "a page break follows" (SCAR-017): it reads
 * the lines `topLines` puts in front of the blocks.
 */
function pageBreakAfter(
  blocks: readonly BlockNode[],
  position: number,
  top: TopLines,
): boolean {
  for (let j = position + 1; j < blocks.length; j++) {
    const kind = blocks[j]?.kind;
    if (kind === 'comment' || kind === 'footnote-def') continue;
    return PAGE_BREAK_LINE.test(top.before[j] ?? '');
  }
  return true;
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
   * US-025 AC-2: the break rules of the top-level headings and the facing
   * pages. Default: no breaks.
   */
  breaks?: BreakOptions;
  /**
   * US-026 AC-2: top-level headings written as `#metadata(none) <label>`
   * only (a hidden colophon or back-notes heading). Default: none.
   */
  hidden?: ReadonlySet<BlockNode>;
  /** US-026 AC-3 to AC-6: the book's page lines. Default: none. */
  book?: BookLines;
  /**
   * US-027 AC-3 (decision 4): write headings inside a callout, quote or list
   * item unlisted and bookmarked (set while the contents are on). Default:
   * false (they are written as every other heading).
   */
  unlistNested?: boolean;
  /**
   * US-026 AC-8: labels of headings that are not written at all (an empty
   * part left out); links to them are unresolved. Default: none.
   */
  gone?: ReadonlySet<string>;
  /**
   * US-028 AC-2, AC-3: write the images of the body's paragraphs with the
   * `fit-flow` call (`min` = `images.minScale` / 100, `sides` = facing
   * pages); the images of the `noFloat` top-level blocks (the back notes)
   * never float. Default: none (today's output).
   */
  fit?: {min: number; sides: boolean; noFloat: ReadonlySet<BlockNode>};
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
    gone: options.gone,
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
    breaks: options.breaks,
    hidden: options.hidden ?? new Set<BlockNode>(),
    book: options.book,
    unlistNested: options.unlistNested ?? false,
  };
  const fit: BlockFit | undefined =
    options.fit === undefined ? undefined : {...options.fit, reserve: null};
  // US-018 AC-2: a footnote called from an explanation is part of it; the
  // definitions are not top-level blocks of a term, so nothing else sets it.
  const notes: Notes = new Notes(blocks, ctx, (def, inExplanation, noteCtx) =>
    renderBlocks(def.children, noteCtx, false, {
      ...base,
      notes,
      where: 'footnote',
      mark: NO_MARK,
      inExplanation,
      // US-028 AC-2: an image in a footnote is written as today.
      fit: undefined,
    }),
  );
  const text = renderBlocks(blocks, ctx, false, {
    ...base,
    notes,
    where: 'body',
    inExplanation: false,
    fit,
  });
  notes.finish();
  return text;
}
