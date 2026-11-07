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
import type {StatblockModel} from '../entries/model';
import {
  EMPTY_GLOSSARY_PLAN,
  findCallout,
  flattenLinks,
  type GlossaryPlan,
} from '../markers';
import {indexHeadings, parseInline, visibleText} from '../parse';
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
import {bookSheetCall} from '../entries/sheet';
import {statblockCall, type StatblockWriter} from './entry';
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
import {typstString} from './typst-string';
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
  /** US-030: the statblocks of the entry headings; undefined without any. */
  statblocks: StatblockEnv | undefined;
  /** US-031: the entry layout; undefined when no chapter places an entry. */
  entryLayout: EntryLayoutEnv | undefined;
  /** US-031 AC-11, AC-12: the heading of the chapter entry being written. */
  entryHeading: BlockNode | null;
}

/** US-031 AC-3, AC-4, AC-7: what the layout knows of one entry. */
export interface EntryLayoutInfo {
  /** The heading's text (the facts and the messages). */
  text: string;
  /** `page` / `spread` placement in a chapter, or `inline` (AC-1, AC-2). */
  inline: boolean;
  /** The layout to use (`auto` for the measured choice). */
  layout: string;
  /** AC-4: the layout asked for when it was replaced, and why. */
  asked: string | null;
  reason: string | null;
  /** US-033 AC-1: the section this entry is the first entry of, or null. */
  opensSection: string | null;
  /** US-033 AC-9: the entries chapter's heading; null outside chapters. */
  chapter: BlockNode | null;
  /** US-033 AC-9 to AC-11: the entry's row of the quick reference. */
  quick: QuickRow | null;
  /** US-032 AC-2: the layout is chosen in the compile (`auto` or replaced). */
  auto: boolean;
  /** The block's line (the warnings made from the facts). */
  line: number;
  /** The illustration's Typst path, size in px and credit; null without. */
  image: {
    path: string;
    width: number;
    height: number;
    credit: string | null;
  } | null;
}

/** US-031: what the emitter needs to place entries. */
export interface EntryLayoutEnv {
  entries: ReadonlyMap<BlockNode, EntryLayoutInfo>;
  /** Text width and height, top margin in mm, facing pages, `entries.fullImageHeader`. */
  textWidth: number;
  textHeight: number;
  marginTop: number;
  /** US-032 AC-4: `entries.image.minScale`. */
  minScale: number;
  /** US-034 AC-6: the narrow columns' justification limits (a Typst dictionary). */
  narrow: string;
  facingPages: boolean;
  fullImageHeader: boolean;
  /** The top-level blocks of the chapter entries (headings included). */
  bodies: ReadonlySet<BlockNode>;
  /** US-033 AC-1, AC-2: the chapter headings and section headings. */
  chapters: ReadonlySet<BlockNode>;
  sections: ReadonlySet<BlockNode>;
  /** US-033 AC-6: `toc.depth` when a contents is written, else 0. */
  tocDepth: number;
  /** US-033 AC-9, AC-12: the quick reference; null when it is off. */
  quick: QuickReference | null;
  /**
   * US-036 AC-6: the encounter sheet page after each chapter (its data as a
   * Typst dictionary, its title); null when it is off or empty.
   */
  sheet?: {data: string; title: string} | null;
}

/** US-033 AC-9: the columns of the quick reference. */
export interface QuickReference {
  /** The heading text (built-in `Quick Reference`); '' → no heading. */
  title: string;
  /** The box column's label (the stats label, else the key); null without boxes. */
  boxLabel: string | null;
  statLabels: string[];
  /** A Track column (`entries.statblock.track` set). */
  track: boolean;
}

/** US-033 AC-9, AC-10: one entry's row (values as written; null → —). */
export interface QuickRow {
  section: string | null;
  box: string | null;
  stats: (string | null)[];
  /** AC-10: '' for the default, `+ …`, `− …`, `none` or the cells. */
  track: string;
}

/** US-031 AC-12: lists of up to this many items are never broken (D26). */
export const LIST_KEEP_ITEMS = 10;

/**
 * US-031 | AC-12 (D26): a list inside an entry: up to 10 items in one
 * unbreakable block; a longer one as three parts — the first two items
 * sticky to the rest, the middle free to break, the last two unbreakable —
 * so a break leaves at least two items on each side.
 */
function keptList(items: readonly string[]): string {
  const part = (list: readonly string[], opts: string): string =>
    `#block(${opts})[\n${indent(list.join('\n'), 2)}\n]`;
  if (items.length <= LIST_KEEP_ITEMS)
    return part(items, 'breakable: false, width: 100%');
  return [
    part(
      items.slice(0, 2),
      'breakable: false, sticky: true, width: 100%, below: 0.65em',
    ),
    part(items.slice(2, -2), 'width: 100%, above: 0.65em, below: 0.65em'),
    part(items.slice(-2), 'breakable: false, width: 100%, above: 0.65em'),
  ].join('\n');
}

/**
 * US-031 | AC-5 to AC-10, AC-14: the call that places one run of chapter
 * entries (`o2t-entries`, breaks.ts): per entry its heading text, layout,
 * replacement, illustration, the head (heading and statblock), the body and
 * the body's top-level blocks (the portrait split).
 */
function entriesCall(
  run: readonly {info: EntryLayoutInfo; head: string; body: string[]}[],
  layout: EntryLayoutEnv,
  then: {opener: boolean; left: boolean; closes: boolean},
): string {
  const content = (text: string): string =>
    text === '' ? '[]' : `[\n${indent(text, 4)}\n  ]`;
  const str = (v: string | null): string =>
    v === null ? 'none' : typstString(v);
  const entries = run.map(({info, head, body}) => {
    const img =
      info.image === null
        ? 'none'
        : `(path: ${typstString(info.image.path)}, w: ${info.image.width}, h: ${info.image.height}, credit: ${
            info.image.credit === null
              ? 'none'
              : `[${escapeMarkup(info.image.credit, {atBlockStart: true})}]`
          })`;
    const blocks = body.map(content);
    return [
      `  (heading: ${typstString(info.text)}, layout: ${typstString(info.layout)}, chosen: ${info.auto}, line: ${info.line}, asked: ${str(info.asked)}, reason: ${str(info.reason)}, img: ${img}, orient: ${
        info.image === null
          ? 'none'
          : info.image.width >= info.image.height
            ? '"landscape"'
            : '"portrait"'
      },`,
      `  head: ${content(head)},`,
      `  blocks: ${blocks.length === 1 ? `(${blocks[0]},)` : `(${blocks.join(', ')})`}),`,
    ].join('\n');
  });
  // US-033 AC-1, AC-4: the end of the section's intro, before its entries.
  const intro = run[0]?.info.opensSection != null ? '#o2t-section-end()\n' : '';
  return `${intro}#o2t-entries((\n${entries.join('\n')}\n), next-opener: ${then.opener}, next-left: ${then.left}, closes: ${then.closes}, tw: ${layout.textWidth}mm, th: ${layout.textHeight}mm, top: ${layout.marginTop}mm, facing: ${layout.facingPages}, full-header: ${layout.fullImageHeader}, min-scale: ${layout.minScale}, narrow: ${layout.narrow})`;
}

/** US-030 AC-10, AC-16: what the emitter needs to write statblocks. */
export interface StatblockEnv {
  /** The model of each entry heading that gets a statblock. */
  models: ReadonlyMap<BlockNode, StatblockModel & {line: number}>;
  /** The look (`statblockLook`). */
  look: string;
  /** The Typst path of a track icon, or null when it is missing. */
  icon: (path: string, line: number) => string | null;
  /** Called for every call written (the prelude gets the helper). */
  written: () => void;
}

/** US-030 AC-16: the minimum words of an opening paragraph (G0-C8). */
export const LEDE_MIN_WORDS = 10;

/**
 * US-030 | AC-16: the kind of a first block that is not an opening
 * paragraph, as the warning names it; null for a plain paragraph.
 */
function ledeKind(block: BlockNode): string | null {
  switch (block.kind) {
    case 'paragraph': {
      const shown = block.children.filter(
        (n) =>
          !(n.kind === 'text' && n.value.trim() === '') &&
          n.kind !== 'softbreak' &&
          n.kind !== 'break',
      );
      return shown.length > 0 && shown.every((n) => isImageNode(n))
        ? 'image'
        : null;
    }
    case 'list':
      return 'list';
    case 'blockquote':
      return findCallout(block) === null ? 'quote' : 'callout';
    case 'heading':
      return 'heading';
    case 'table':
      return 'table';
    case 'code':
      return 'code';
    case 'thematic-break':
      return 'rule';
    default:
      return 'html';
  }
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
  /** US-031 AC-13: top-level blocks whose images are written without fit. */
  plain?: ReadonlySet<BlockNode>;
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
  return listItems(list, ctx, env).join('\n');
}

/** The items of one list, each with its marker (US-031 AC-12 splits them). */
function listItems(
  list: Extract<BlockNode, {kind: 'list'}>,
  ctx: EmitContext,
  env: BlockEnv,
): string[] {
  return list.children.map((item, index) => {
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
  });
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
  return join(renderPieces(blocks, ctx, nested, outer, lead), nested);
}

/**
 * US-031 | AC-5 to AC-10: the runs of chapter entries among the top-level
 * blocks: each run (consecutive entries; a section heading or other text
 * ends it) is written as one `o2t-entries` call at its first block.
 */
function entryRuns(
  blocks: readonly BlockNode[],
  ctx: EmitContext,
  env: BlockEnv,
): {at: Map<number, string>; covered: Set<number>} {
  const at = new Map<number, string>();
  const covered = new Set<number>();
  const layout = env.entryLayout;
  if (layout === undefined) return {at, covered};
  const isChapterEntry = (block: BlockNode | undefined): boolean =>
    block !== undefined &&
    block.kind === 'heading' &&
    layout.entries.get(block)?.inline === false;
  let i = 0;
  while (i < blocks.length) {
    if (!isChapterEntry(blocks[i])) {
      i++;
      continue;
    }
    const start = i;
    const run: {info: EntryLayoutInfo; head: string; body: string[]}[] = [];
    while (isChapterEntry(blocks[i])) {
      const heading = blocks[i] as Extract<BlockNode, {kind: 'heading'}>;
      let j = i + 1;
      while (
        j < blocks.length &&
        !(
          blocks[j]?.kind === 'heading' &&
          (blocks[j] as {depth: number}).depth <= heading.depth
        )
      )
        j++;
      const pieces = renderPieces(blocks.slice(i, j), ctx, false, {
        ...env,
        entryHeading: heading,
        fit: undefined,
      });
      const [head, ...rest] = pieces;
      run.push({
        info: layout.entries.get(heading) as EntryLayoutInfo,
        head: head?.text ?? '',
        body: rest.map((p) => p.text).filter((t) => t !== ''),
      });
      for (let k = i; k < j; k++) covered.add(k);
      i = j;
    }
    // US-033 AC-3: a section opener after the run reuses a free right page;
    // AC-7: the run that ends the chapter closes its pages.
    const next = blocks[i];
    const closes = chapterEndsAt(blocks, i, layout);
    at.set(
      start,
      entriesCall(run, layout, {
        // A section or chapter opener writes its own right-page break.
        opener:
          next !== undefined &&
          (layout.sections.has(next) || layout.chapters.has(next)),
        // US-033 AC-9: the quick reference after the chapter's last run.
        left: closes && layout.quick !== null,
        closes,
      }),
    );
  }
  return {at, covered};
}

/**
 * US-033 AC-7: true when the chapter that holds the block before `i` ends at
 * `i` (the next heading of its level or higher, or the end of the blocks).
 */
function chapterEndsAt(
  blocks: readonly BlockNode[],
  i: number,
  layout: EntryLayoutEnv,
): boolean {
  for (let k = i - 1; k >= 0; k--) {
    const b = blocks[k];
    if (b?.kind === 'heading' && layout.chapters.has(b)) {
      const next = blocks[i];
      return (
        next === undefined || (next.kind === 'heading' && next.depth <= b.depth)
      );
    }
  }
  return false;
}

/**
 * US-033 | AC-1 to AC-3, AC-5, AC-7: the lines in front of the chapter and
 * section headings of the entries chapters and at the end of a chapter not
 * closed by a run: the chapter heading opens a right page (it replaces
 * US-025's rule for it), the first section shares it, every later section
 * opens the next right page (`breakLines`, so an added page is `o2t-blank`);
 * markers for the running header and the section facts.
 */
function openerLines(
  blocks: readonly BlockNode[],
  env: BlockEnv,
  runs: {at: Map<number, string>; covered: Set<number>},
  quick: (chapter: BlockNode) => string,
): {before: Map<number, string>; end: string | null} {
  const before = new Map<number, string>();
  let end: string | null = null;
  const layout = env.entryLayout;
  if (layout === undefined) return {before, end};
  const open = breakLines('right', layout.facingPages) ?? '';
  let chapter: {depth: number; firstSection: boolean; node: BlockNode} | null =
    null;
  const close = (k: number, node: BlockNode): void => {
    // A run that ends the chapter writes its own end marker; US-033 AC-9:
    // the quick reference follows it.
    const lines = [
      ...(runs.covered.has(k - 1) ? [] : [CHAPTER_END_LINE]),
      quick(node),
      // US-036 AC-6: the sheet page after the quick reference.
      sheetPageText(node, layout),
    ].filter((line) => line !== '');
    if (lines.length === 0) return;
    if (k >= blocks.length) end = lines.join('\n');
    else add(k, lines.join('\n'));
  };
  // Lines meeting at one block (a chapter's end, the next chapter's opener)
  // are kept in that order.
  const add = (k: number, lines: string): void => {
    const known = before.get(k);
    before.set(k, known === undefined ? lines : `${known}\n${lines}`);
  };
  blocks.forEach((block, k) => {
    if (block.kind !== 'heading') return;
    if (chapter !== null && block.depth <= chapter.depth) {
      close(k, chapter.node);
      chapter = null;
    }
    if (layout.chapters.has(block)) {
      chapter = {depth: block.depth, firstSection: true, node: block};
      add(k, `${open}\n${CHAPTER_START_LINE}`);
    } else if (layout.sections.has(block) && chapter !== null) {
      const marker = `#metadata((name: ${typstString(headingText(block))}, first: ${chapter.firstSection})) <${SECTION_START_LABEL}>`;
      add(k, chapter.firstSection ? marker : `${open}\n${marker}`);
      chapter.firstSection = false;
    }
  });
  const last = chapter as {node: BlockNode} | null;
  if (last !== null) close(blocks.length, last.node);
  return {before, end};
}

/**
 * US-033 | AC-9 to AC-12: the quick reference of one entries chapter, or ''
 * when it is off or the chapter has no entry: a new left page (US-025's
 * `breakLines`), the heading at the chapter's section level (in the
 * contents; none for an empty title), and a table with a repeated header
 * row — Entry, Section, the box key's label, the stats, Track, Page — one
 * row per entry in the note's order, nested entries left out and a repeated
 * heading once; a missing value is `—`; the page is the entry's first page.
 */
function quickReferenceText(
  chapter: BlockNode,
  env: BlockEnv,
  content: (value: string) => string,
): string {
  const layout = env.entryLayout;
  const quick = layout?.quick ?? null;
  if (layout === undefined || quick === null || chapter.kind !== 'heading')
    return '';
  const seen = new Set<string>();
  const rows: {info: EntryLayoutInfo; row: QuickRow; label: string}[] = [];
  for (const [node, info] of layout.entries) {
    if (info.chapter !== chapter || info.inline || info.quick === null)
      continue;
    if (seen.has(info.text)) continue;
    seen.add(info.text);
    const label = env.headings.byNode.get(
      node as Extract<BlockNode, {kind: 'heading'}>,
    )?.label;
    if (label === undefined) continue;
    rows.push({info, row: info.quick, label});
  }
  if (rows.length === 0) return '';
  const plain = (text: string): string =>
    `[${escapeMarkup(text, {atBlockStart: true})}]`;
  const cell = (value: string | null): string =>
    value === null ? '[—]' : `[${content(value)}]`;
  const head = [
    'Entry',
    'Section',
    ...(quick.boxLabel === null ? [] : [quick.boxLabel]),
    ...quick.statLabels,
    ...(quick.track ? ['Track'] : []),
    'Page',
  ];
  const columns = [
    '1.5fr',
    '1.2fr',
    ...(quick.boxLabel === null ? [] : ['auto']),
    ...quick.statLabels.map(() => 'auto'),
    ...(quick.track ? ['1fr'] : []),
    'auto',
  ];
  const body = rows.map(({info, row, label}) =>
    [
      plain(info.text),
      row.section === null ? '[—]' : plain(row.section),
      ...(quick.boxLabel === null ? [] : [cell(row.box)]),
      ...row.stats.map(cell),
      ...(quick.track ? [plain(row.track)] : []),
      `context numbering("1", ..counter(page).at(<${label}>))`,
    ].join(', '),
  );
  const heading =
    quick.title === ''
      ? []
      : [
          `${'='.repeat(chapter.depth + 1)} ${escapeMarkup(quick.title, {atBlockStart: false})}`,
        ];
  return [
    breakLines('left', layout.facingPages) ?? '',
    ...heading,
    // Set a little smaller, as reference tables are, so the columns fit.
    '#block[',
    '#set text(size: 0.85em)',
    // M21 (2026-11-07): Entry, Section and Track share the width left by
    // the number columns, which take their content's width; a narrow cell
    // inset. With equal columns, words such as "Horrors" ran into the next
    // cell (12 pt body, 100 mm text width).
    `#table(columns: (${columns.join(', ')}), align: left, inset: (x: 3pt, y: 4pt),`,
    `  table.header(repeat: true, ${head.map((h) => `[*${escapeMarkup(h, {atBlockStart: true})}*]`).join(', ')}),`,
    ...body.map((r) => `  ${r},`),
    ')',
    ']',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * US-036 | AC-6 (decision 1): the encounter sheet page of one entries
 * chapter, or '' when it is off: a new page (any side, US-025's
 * `breakLines`), the heading at the chapter's section level (in the
 * contents; none for an empty title) given to the sheet so it is measured,
 * and as many rows as fit the text area.
 */
function sheetPageText(chapter: BlockNode, layout: EntryLayoutEnv): string {
  const sheet = layout.sheet ?? null;
  if (sheet === null || chapter.kind !== 'heading') return '';
  const head =
    sheet.title === ''
      ? ''
      : `${'='.repeat(chapter.depth + 1)} ${escapeMarkup(sheet.title, {atBlockStart: false})}`;
  return [
    breakLines('page', layout.facingPages) ?? '',
    bookSheetCall(sheet.data, layout.textWidth, layout.textHeight, head),
  ]
    .filter((line) => line !== '')
    .join('\n');
}

const CHAPTER_START_LINE = '#metadata(none) <o2t-chapter-start>';
const CHAPTER_END_LINE = '#metadata(none) <o2t-chapter-end>';
const SECTION_START_LABEL = 'o2t-section-start';
const headingText = (block: Extract<BlockNode, {kind: 'heading'}>): string =>
  visibleText(block.children, {dropImages: true});

/** The pieces of one level of blocks (`renderBlocks` joins them). */
function renderPieces(
  blocks: readonly BlockNode[],
  ctx: EmitContext,
  nested: boolean,
  outer: BlockEnv,
  lead?: string,
): Piece[] {
  // US-025, US-026, US-027: the lines put in front of the top-level blocks
  // of the body and after the last one; US-028 reads them before the blocks
  // are written (a page break after an image's paragraph). Not inside a
  // chapter entry, whose layout writes its own breaks (US-031 AC-16).
  const top =
    !nested && outer.where === 'body' && outer.entryHeading === null
      ? topLines(blocks, outer)
      : null;
  // US-031 AC-5 to AC-10: the runs of chapter entries at the top level.
  const runs =
    !nested && outer.where === 'body' && outer.entryHeading === null
      ? entryRuns(blocks, ctx, outer)
      : {at: new Map<number, string>(), covered: new Set<number>()};
  // US-030 AC-16: blocks written beside a statblock, not again in the flow.
  const beside = new Set<number>();
  const pieces: Piece[] = blocks.map((block, position): Piece => {
    const run = runs.at.get(position);
    if (run !== undefined) return {text: run, kind: 'other'};
    if (runs.covered.has(position)) return {text: '', kind: 'other'};
    if (beside.has(position)) return {text: '', kind: 'other'};
    // US-018 AC-2: a top-level block of a term's explanation, and everything
    // inside it, is in the explanation.
    const inTerm =
      !nested && outer.glossary.explanations.has(block)
        ? {...outer, inExplanation: true}
        : outer;
    // US-031 AC-13 (G0-C5): an entry's body is written without image fit.
    const env =
      !nested && inTerm.fit?.plain?.has(block) === true
        ? {...inTerm, fit: undefined}
        : inTerm;
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
        } else if (
          unlisted ||
          // US-033 AC-6: with an entries chapter the outline has no depth;
          // headings deeper than `toc.depth` that are not entries are unlisted.
          (env.entryLayout !== undefined &&
            env.entryLayout.tocDepth > 0 &&
            block.depth > env.entryLayout.tocDepth &&
            !env.entryLayout.entries.has(block))
        ) {
          line = emitUnlistedHeading(block.depth, text, info.label);
        } else if (env.entryHeading !== null && block !== env.entryHeading) {
          // US-031 AC-11: a heading inside a chapter entry: small, no
          // number, not in the contents or the bookmarks, no page break.
          line = `#heading(level: ${block.depth}, outlined: false, bookmarked: false, numbering: none)[${text}] <${info.label}>`;
        } else {
          line = ['='.repeat(block.depth), text, `<${info.label}>`]
            .filter((part) => part !== '')
            .join(' ');
        }
        // US-030 AC-10, AC-16: an entry's statblock right after its heading,
        // with the opening paragraph (or the first block) beside it.
        const model = env.statblocks?.models.get(block);
        let call: string | null = null;
        if (model !== undefined && env.statblocks !== undefined) {
          const sbEnv = env.statblocks;
          let next = position + 1;
          while (
            blocks[next]?.kind === 'comment' ||
            blocks[next]?.kind === 'footnote-def'
          )
            next++;
          const first = blocks[next];
          const nested =
            first?.kind === 'heading' && env.statblocks.models.has(first);
          let lede: string | null = null;
          if (first !== undefined && !nested) {
            const kind = ledeKind(first);
            const name = `"${model.band}"`;
            if (kind !== null) {
              ctx.warn(
                'ENTRY_NO_LEDE',
                `${name}: starts with ${kind}`,
                model.line,
              );
            } else if (first.kind === 'paragraph') {
              const words = visibleText(first.children)
                .split(/\s+/)
                .filter((w) => w !== '').length;
              if (words < LEDE_MIN_WORDS)
                ctx.warn(
                  'ENTRY_LEDE_SHORT',
                  `${name}: ${words} words`,
                  model.line,
                );
            }
            if (kind !== 'heading') {
              lede = renderBlocks([first], ctx, true, within(env, NO_RESERVE));
              beside.add(next);
            }
          }
          const writer: StatblockWriter = {
            content: (value) =>
              emitInline(flattenLinks(parseInline(value, model.line)), ctx, {
                ...inlineOf(env),
                atBlockStart: true,
                breaks: 'space',
              }),
            icon: (path) => sbEnv.icon(path, model.line),
          };
          call = statblockCall(model, sbEnv.look, writer, lede);
          sbEnv.written();
        }
        // US-031 AC-1, AC-2: an entry outside the chapters, or nested, is
        // placed inline; its fact says so.
        const layoutInfo = env.entryLayout?.entries.get(block);
        const inlineMark =
          layoutInfo?.inline === true
            ? `#o2t-entry-mark((heading: ${typstString(layoutInfo.text)}, layout: ${typstString(layoutInfo.layout)}, size: "inline"))`
            : null;
        return {
          // US-017 AC-8: images of a term follow its run-in paragraph.
          text: [
            marked(env, block.line, line),
            ...(inlineMark === null ? [] : [inlineMark]),
            ...(call === null ? [] : [call]),
            ...figures,
          ].join('\n\n'),
          kind:
            role?.kind === 'term' && role.runIn !== null
              ? 'paragraph'
              : 'other',
        };
      }
      case 'list':
        // US-031 AC-12: a list at the top of a chapter entry's body.
        if (!nested && env.entryHeading !== null) {
          return {text: keptList(listItems(block, ctx, env)), kind: 'other'};
        }
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
  // US-033 AC-1 to AC-3, AC-7: the openers of the entries chapters.
  if (!nested && outer.where === 'body' && outer.entryHeading === null) {
    const openers = openerLines(blocks, outer, runs, (chapter) =>
      quickReferenceText(chapter, outer, (value) =>
        emitInline(flattenLinks(parseInline(value, 0)), ctx, {
          ...inlineOf(outer),
          atBlockStart: true,
          breaks: 'space',
        }),
      ),
    );
    pieces.forEach((piece, i) => {
      const lines = openers.before.get(i);
      if (lines === undefined) return;
      pieces[i] = {
        ...piece,
        text: piece.text === '' ? lines : `${lines}\n${piece.text}`,
      };
    });
    if (openers.end !== null) pieces.push({text: openers.end, kind: 'other'});
  }
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
  return pieces;
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
      // US-031 AC-11, AC-16: the entry layout writes the breaks in a chapter.
      env.entryLayout?.bodies.has(block) !== true &&
      // US-033 AC-2: the entries chapter writes its own openers.
      env.entryLayout?.chapters.has(block) !== true &&
      env.entryLayout?.sections.has(block) !== true &&
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
  fit?: {
    min: number;
    sides: boolean;
    noFloat: ReadonlySet<BlockNode>;
    plain?: ReadonlySet<BlockNode>;
  };
  /**
   * US-030 AC-10, AC-16: the statblocks of the entry headings; an entry
   * heading is followed by its statblock call. Default: none.
   */
  statblocks?: StatblockEnv;
  /** US-031: the entry layout of the entries chapters. Default: none. */
  entryLayout?: EntryLayoutEnv;
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
    statblocks: options.statblocks,
    entryLayout: options.entryLayout,
    entryHeading: null,
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
