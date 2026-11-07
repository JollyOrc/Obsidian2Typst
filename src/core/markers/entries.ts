// US-030 AC-1 to AC-7, AC-20, AC-21: the `o2t-entry` block. Finds every
// block, takes it out of the tree (it is data, never printed), decides which
// heading it belongs to and reads its YAML into the values the preset uses.
// Pure: no Obsidian, Node, or I/O imports; nothing is emitted here. The only
// place in `src` that reads `o2t-entry` code nodes (SCAR-039); the contract
// is docs/technical/entry-block.md.
import {isMap, parseDocument} from 'yaml';
import {parseInline, visibleText} from '../parse';
import {headingRuleKey, type HeadingRule} from './heading-rules';
import type {
  BlockNode,
  CodeNode,
  HeadingNode,
  ImageNode,
  InlineNode,
  WikilinkNode,
} from '../parse';

/** The info string of an entry block (AC-1). */
export const ENTRY_BLOCK_LANG = 'o2t-entry';

/** A preset field of `entries.statblock.stats` or `.traits` (AC-8). */
export interface EntryField {
  key: string;
  label: string;
}

/** A cell of `entries.statblock.track` (AC-8, AC-13). */
export interface TrackCell {
  label: string;
  /** Vault path of an SVG file. */
  icon: string;
}

/** A frame or rule line (AC-8): colour `#rrggbb`, width in pt. */
export interface LineStyle {
  color?: string;
  width?: number;
}

/** US-030 AC-8: the fonts of the statblock's parts (family names). */
export const STATBLOCK_FONT_ROLES = [
  'band',
  'values',
  'text',
  'skills',
  'tags',
] as const;
/** US-030 AC-8: the sizes of the statblock's parts, in pt. */
export const STATBLOCK_SIZE_ROLES = [
  'band',
  'value',
  'label',
  'text',
  'attacks',
  'skills',
] as const;

/** US-030 AC-8: `entries.statblock` as a preset note sets it. */
export interface StatblockSettings {
  stats?: readonly EntryField[];
  traits?: readonly EntryField[];
  boxes?: string;
  track?: readonly TrackCell[];
  trackKey?: string;
  trackLabel?: string;
  trackDefault?: readonly string[];
  sum?: {total: string; of: readonly string[]};
  fill?: string;
  frame?: LineStyle;
  rules?: LineStyle;
  boxFill?: string;
  fonts?: Partial<Record<(typeof STATBLOCK_FONT_ROLES)[number], string>>;
  sizes?: Partial<Record<(typeof STATBLOCK_SIZE_ROLES)[number], number>>;
}

/**
 * US-030 AC-8: the `entries` group of a preset note (preset notes only,
 * G0-C9). Later stories of epic #121 add their fields here.
 */
export interface EntriesSettings {
  statblock?: StatblockSettings;
  tagLabels?: Readonly<Record<string, string>>;
  /** US-031 AC-6: a `full-image` page keeps its header and folio. */
  fullImageHeader?: boolean;
  /** US-032 AC-1: the smallest illustration scale inside entries (percent). */
  image?: {minScale?: number};
  /** US-032 AC-1, AC-9: the unused right-page share that warns (0 = off). */
  emptyWarn?: number;
  /** US-033 AC-12: the quick reference after each entries chapter, its title. */
  quickReference?: boolean;
  quickReferenceTitle?: string;
  /** US-034 AC-5: the justification limits of narrow columns. */
  narrowJustification?: NarrowJustification;
  /** US-034 AC-5: the widest word gap in percent before a warning (0 = no scan). */
  maxWordGap?: number;
}

/**
 * US-034 AC-5, AC-6: Typst's `justification-limits` for narrow columns:
 * `spacing` in percent of the normal space, `tracking` in em. Each field
 * the preset leaves out keeps its built-in.
 */
export interface NarrowJustification {
  spacing?: {min?: number; max?: number};
  tracking?: {min?: number; max?: number};
}

/** US-032 AC-1, US-034 AC-5: the built-in values of the entry fit (G0-C8, one place). */
export const ENTRY_BUILTINS = Object.freeze({
  imageMinScale: 70,
  emptyWarn: 50,
  maxWordGap: 200,
  narrowJustification: Object.freeze({
    spacing: Object.freeze({min: 80, max: 150}),
    tracking: Object.freeze({min: -0.01, max: 0.03}),
  }),
});

/** US-034 AC-6: a column narrower than this share of the text width (percent) is narrow. */
export const NARROW_COLUMN_SHARE = 60;

/**
 * US-034 AC-5, AC-6: the narrow-column limits in effect, as the Typst
 * dictionary `par(justification-limits: …)` takes.
 */
export function narrowLimits(narrow: NarrowJustification | undefined): string {
  const b = ENTRY_BUILTINS.narrowJustification;
  const n = (v: number): string => String(Number(v.toFixed(4)));
  const sp = {...b.spacing, ...narrow?.spacing};
  const tr = {...b.tracking, ...narrow?.tracking};
  return `(spacing: (min: ${n(sp.min)}%, max: ${n(sp.max)}%), tracking: (min: ${n(tr.min)}em, max: ${n(tr.max)}em))`;
}

/**
 * US-030 AC-8 (G0-C8): the built-in look of the statblock, in one place.
 * Fields not listed here are empty or unset when the preset does not set
 * them; the fonts are the body font.
 */
export const STATBLOCK_BUILTINS = Object.freeze({
  fill: 'none',
  frame: Object.freeze({color: '#000000', width: 0.75}),
  rules: Object.freeze({color: '#000000', width: 0.4}),
  boxFill: '#ffffff',
  sizes: Object.freeze({
    band: 11.5,
    value: 11,
    label: 5.5,
    text: 7,
    attacks: 7.5,
    skills: 9,
  }),
});

/** US-030 AC-8, AC-15: `colorMode` (top level of a preset note). */
export type ColorMode = 'color' | 'grayscale';
export const COLOR_MODES: readonly ColorMode[] = ['color', 'grayscale'];

/** The fixed list keys of the block (AC-5); the track key comes from the preset. */
export const ENTRY_LIST_KEYS = ['attacks', 'skills', 'tags'] as const;

/** A warning of this module, with its 1-based source line. */
export interface EntryWarning {
  code:
    | 'ENTRY_YAML_INVALID'
    | 'ENTRY_ORPHAN_BLOCK'
    | 'ENTRY_BLOCK_TWICE'
    | 'ENTRY_BLOCK_IN_CONTAINER'
    | 'ENTRY_VALUE_NOT_TEXT'
    | 'ENTRY_IN_GLOSSARY';
  message: string;
  line: number;
}

/** AC-1: one block that stands right under its heading. */
export interface FoundEntryBlock {
  heading: HeadingNode;
  block: CodeNode;
}

/** AC-1, AC-4: the tree without entry blocks, the blocks found, the warnings. */
export interface EntryBlockScan {
  root: BlockNode[];
  found: FoundEntryBlock[];
  warnings: EntryWarning[];
}

const isEntryBlock = (block: BlockNode | undefined): block is CodeNode =>
  block?.kind === 'code' && block.lang === ENTRY_BLOCK_LANG;

/** The heading's text as a reader sees it, for the messages. */
const headingText = (heading: HeadingNode): string =>
  visibleText(heading.children, {dropImages: true});

/**
 * US-030 | AC-1, AC-4: takes every `o2t-entry` block out of `root` (at any
 * depth, so none is ever printed) and decides its place:
 * - right after a heading (blank lines make no node) → the heading's block;
 * - right after such a block → `ENTRY_BLOCK_TWICE` (the first counts);
 * - inside a quote or callout, at any depth → `ENTRY_BLOCK_IN_CONTAINER`
 *   (SCAR-041: the container is known from the tree, not from line starts);
 * - anywhere else (text before it, no heading above) → `ENTRY_ORPHAN_BLOCK`.
 * Containers without an entry block keep their identity; the others are
 * copied with the blocks left out. Runs right after `parse`, before any
 * other step reads the tree (SCAR-034).
 */
export function scanEntryBlocks(root: readonly BlockNode[]): EntryBlockScan {
  const found: FoundEntryBlock[] = [];
  const warnings: EntryWarning[] = [];

  const level = (
    blocks: readonly BlockNode[],
    inContainer: boolean,
  ): BlockNode[] => {
    const out: BlockNode[] = [];
    let previous: BlockNode | undefined;
    // The heading whose block (or blocks) directly precede this one.
    let owner: HeadingNode | null = null;
    for (const block of blocks) {
      if (isEntryBlock(block)) {
        if (inContainer) {
          warnings.push({
            code: 'ENTRY_BLOCK_IN_CONTAINER',
            message:
              'o2t-entry block inside a quote or callout; not read and not printed',
            line: block.line,
          });
        } else if (previous?.kind === 'heading') {
          found.push({heading: previous, block});
          owner = previous;
        } else if (owner !== null && isEntryBlock(previous)) {
          warnings.push({
            code: 'ENTRY_BLOCK_TWICE',
            message: `"${headingText(owner)}"`,
            line: block.line,
          });
        } else {
          warnings.push({
            code: 'ENTRY_ORPHAN_BLOCK',
            message:
              'o2t-entry block not directly under a heading; not read and not printed',
            line: block.line,
          });
        }
        previous = block;
        continue;
      }
      owner = null;
      const kept = inner(block, inContainer);
      out.push(kept);
      previous = kept;
    }
    return out;
  };

  const inner = (block: BlockNode, inContainer: boolean): BlockNode => {
    switch (block.kind) {
      case 'blockquote': {
        const children = level(block.children, true);
        return same(children, block.children) ? block : {...block, children};
      }
      case 'item':
      case 'footnote-def': {
        const children = level(block.children, inContainer);
        return same(children, block.children) ? block : {...block, children};
      }
      case 'list': {
        const children = block.children.map((item) => {
          const kept = inner(item, inContainer);
          return kept as typeof item;
        });
        return same(children, block.children) ? block : {...block, children};
      }
      default:
        return block;
    }
  };

  return {root: level(root, false), found, warnings};
}

const same = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** AC-7: the illustration value as an image node, with its credit. */
export interface EntryIllustration {
  /** The image as the block names it; its line is the block's line. */
  node: ImageNode | (WikilinkNode & {kind: 'embed'});
  /** The alt text (`![alt](path)`) or the alias that is not a size. */
  credit: string | null;
  /** The vault file, set once the pipeline has found it (US-003). */
  path?: string;
}

/** US-031 AC-3: the seven layouts; `auto` is decided by US-032. */
export const ENTRY_LAYOUTS = [
  'full-image',
  'spread-landscape',
  'spread-portrait',
  'spread-text',
  'page-landscape',
  'page-portrait',
  'page-text',
] as const;
export type EntryLayout = (typeof ENTRY_LAYOUTS)[number] | 'auto';

/** US-031 AC-1 to AC-3: where an entry stands in the book. */
export interface EntryPlace {
  /** The entries chapter's heading text; null outside every chapter (AC-2). */
  chapter: string | null;
  /** US-033 AC-9: the chapter's heading node; null outside. */
  chapterHeading?: BlockNode | null;
  /** The section heading (a non-entry heading holding entries) or null. */
  section: string | null;
  /** An entry inside another entry (AC-1, decision 3): inline, no page. */
  nested: boolean;
  /** The layout asked for (`auto` when missing or unknown). */
  layout: EntryLayout;
}

/** AC-1, AC-5: one entry's data, read from its block. */
export interface EntryData {
  heading: HeadingNode;
  /** The heading's visible text (the messages and the band). */
  text: string;
  /** The block's first line (the fence). */
  line: number;
  /** Every key of the block, lower-cased (first of a case pair wins). */
  fields: ReadonlyMap<string, unknown>;
  /** The single values the preset uses, as text (`4` and `"4"` alike). */
  single: ReadonlyMap<string, string>;
  /** The list values the preset uses (one text is a one-item list). */
  lists: ReadonlyMap<string, readonly string[]>;
  illustration: EntryIllustration | null;
  /** US-031: set by `placeEntries`. */
  place?: EntryPlace;
}

/** One block read, before the glossary decides whether it counts. */
export interface EntryRead {
  found: FoundEntryBlock;
  /** null when the YAML is invalid (AC-3). */
  data: EntryData | null;
  warnings: EntryWarning[];
}

/** AC-5: the single and list keys the preset uses, lower-cased. */
export function entryKeys(settings: EntriesSettings | undefined): {
  single: string[];
  lists: string[];
} {
  if (settings === undefined) return {single: [], lists: []};
  const sb = settings.statblock ?? {};
  const single = [
    ...(sb.stats ?? []).map((f) => f.key),
    ...(sb.traits ?? []).map((f) => f.key),
    ...(sb.boxes === undefined ? [] : [sb.boxes]),
  ].map((k) => k.toLowerCase());
  const lists = [
    ...ENTRY_LIST_KEYS,
    ...(sb.trackKey === undefined ? [] : [sb.trackKey.toLowerCase()]),
  ];
  return {
    single: [...new Set(single)],
    lists: [...new Set(lists)].filter((k) => !single.includes(k)),
  };
}

const isText = (v: unknown): v is string | number =>
  typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));

/** AC-5: `null` and empty text are not set. */
const isUnset = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** AC-5: the keys of a mapping in lower case; the first of a case pair wins. */
export function lowerKeys(raw: unknown): Map<string, unknown> {
  const fields = new Map<string, unknown>();
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      const lower = key.toLowerCase();
      if (!fields.has(lower)) fields.set(lower, value);
    }
  }
  return fields;
}

/**
 * US-030 | AC-5: the values of the keys the preset uses: single values as
 * text (`4` and `"4"` alike), lists (one text is a one-item list), and the
 * keys whose value has the wrong shape (left out; in a list the wrong items
 * only). `null` and empty text are not set. The one reader of values, used
 * by the block reader and the statblock model (SCAR-017).
 */
export function readEntryValues(
  fields: ReadonlyMap<string, unknown>,
  settings: EntriesSettings | undefined,
): {
  single: Map<string, string>;
  lists: Map<string, string[]>;
  wrong: string[];
} {
  const wrong: string[] = [];
  const keys = entryKeys(settings);
  const single = new Map<string, string>();
  for (const key of keys.single) {
    const value = fields.get(key);
    if (isUnset(value)) continue;
    if (isText(value)) single.set(key, String(value));
    else wrong.push(key);
  }
  const lists = new Map<string, string[]>();
  for (const key of keys.lists) {
    const value = fields.get(key);
    if (isUnset(value)) continue;
    if (isText(value)) {
      lists.set(key, [String(value)]);
      continue;
    }
    if (!Array.isArray(value)) {
      wrong.push(key);
      continue;
    }
    const items: string[] = [];
    let bad = false;
    for (const item of value as unknown[]) {
      if (isUnset(item)) continue;
      if (isText(item)) items.push(String(item));
      else bad = true;
    }
    if (bad) wrong.push(key);
    if (items.length > 0) lists.set(key, items);
  }
  return {single, lists, wrong};
}

/**
 * US-030 | AC-3, AC-5, AC-7: reads one block's YAML (`yaml` 2.9.1, YAML
 * 1.2; any valid mapping, not only the fixed form). A parse error or a
 * value that is not a mapping gives `ENTRY_YAML_INVALID` and no data; an
 * empty block is an empty mapping. Keys are compared lower-cased; a value
 * of a key the preset uses with the wrong shape gives `ENTRY_VALUE_NOT_TEXT`
 * once per key and is left out (in a list: the wrong items only).
 */
export function readEntryBlock(
  found: FoundEntryBlock,
  settings: EntriesSettings | undefined,
): EntryRead {
  const {heading, block} = found;
  const text = headingText(heading);
  const warnings: EntryWarning[] = [];
  const invalid = (): EntryRead => ({
    found,
    data: null,
    warnings: [
      {code: 'ENTRY_YAML_INVALID', message: `"${text}"`, line: block.line},
    ],
  });
  const doc = parseDocument(block.value, {version: '1.2'});
  if (doc.errors.length > 0) return invalid();
  if (doc.contents !== null && !isMap(doc.contents)) return invalid();
  const raw: unknown = doc.toJS();
  const fields = lowerKeys(raw);
  const {single, lists, wrong} = readEntryValues(fields, settings);
  for (const key of wrong) {
    warnings.push({
      code: 'ENTRY_VALUE_NOT_TEXT',
      message: `"${text}": ${key}`,
      line: block.line,
    });
  }
  return {
    found,
    data: {
      heading,
      text,
      line: block.line,
      fields,
      single,
      lists,
      illustration: illustrationOf(fields.get('illustration'), block.line),
    },
    warnings,
  };
}

/**
 * US-030 | AC-7: the illustration value: `![alt](path)`, `![[path|alt]]` or
 * a bare path. The alt text is the credit; in the wikilink form an alias of
 * digits or digits `x` digits is a size (US-003 AC-2c), not a credit. Not
 * text, or no image in it → none.
 */
export function illustrationOf(
  value: unknown,
  line: number,
): EntryIllustration | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const written = value.trim();
  if (!written.startsWith('!')) {
    return {
      node: {kind: 'image', src: written, alt: '', title: null, line},
      credit: null,
    };
  }
  const image = parseInline(written, line).find(
    (n): n is ImageNode | (WikilinkNode & {kind: 'embed'}) =>
      n.kind === 'image' || n.kind === 'embed',
  );
  if (image === undefined) return null;
  if (image.kind === 'image') {
    const credit = image.alt.trim();
    return {node: {...image, line}, credit: credit === '' ? null : credit};
  }
  const credit =
    (image.alias ?? '')
      .split('|')
      .map((part) => part.trim())
      .find((part) => part !== '' && !/^\d+(?:x\d+)?$/.test(part)) ?? null;
  return {node: {...image, line}, credit};
}

/** US-030: the entries of a note, by heading, and the warnings in order. */
export interface EntryPlan {
  entries: ReadonlyMap<HeadingNode, EntryData>;
  warnings: EntryWarning[];
}

export const EMPTY_ENTRY_PLAN: EntryPlan = {
  entries: new Map(),
  warnings: [],
};

/**
 * US-030 | AC-21 (decision 3): the entries of the read blocks; a block
 * under a glossary term or inside a term (`inGlossary`) is not an entry:
 * `ENTRY_IN_GLOSSARY "<term>"` with the block's line, its own warnings
 * dropped.
 */
export function planEntries(
  reads: readonly EntryRead[],
  inGlossary: (heading: HeadingNode) => boolean,
): EntryPlan {
  const entries = new Map<HeadingNode, EntryData>();
  const warnings: EntryWarning[] = [];
  for (const read of reads) {
    const {heading, block} = read.found;
    if (inGlossary(heading)) {
      warnings.push({
        code: 'ENTRY_IN_GLOSSARY',
        message: `"${headingText(heading)}"`,
        line: block.line,
      });
      continue;
    }
    warnings.push(...read.warnings);
    if (read.data !== null) entries.set(heading, read.data);
  }
  return {entries, warnings};
}

/**
 * US-030 | AC-6: link markup in a value prints its display text: a link its
 * text, a wikilink its alias (else the target as written), an image its alt
 * text; never a link, never a page number.
 */
export function flattenLinks(nodes: readonly InlineNode[]): InlineNode[] {
  return nodes.flatMap((node): InlineNode[] => {
    switch (node.kind) {
      case 'link':
        return flattenLinks(node.children);
      case 'wikilink':
      case 'embed': {
        const shown =
          node.alias ??
          (node.anchor === null
            ? node.file
            : node.file === ''
              ? node.anchor
              : `${node.file} > ${node.anchor}`);
        return [{kind: 'text', value: shown, line: node.line}];
      }
      case 'image':
        return [{kind: 'text', value: node.alt, line: node.line}];
      case 'strong':
      case 'emph':
      case 'delete':
      case 'mark':
        return [{...node, children: flattenLinks(node.children)}];
      default:
        return [node];
    }
  });
}

/** A warning of the placement (US-031 AC-1 to AC-3). */
export interface PlaceWarning {
  code:
    'ENTRY_OUTSIDE_CHAPTER' | 'ENTRY_NESTED_LAYOUT' | 'ENTRY_LAYOUT_UNKNOWN';
  message: string;
  line: number;
}

/**
 * US-031 | AC-1 to AC-3, AC-13: places the entries of `plan` among the
 * top-level headings of `root`. A heading whose text matches a key with the
 * rule `entries` (US-017 AC-2's matching, `headingRuleKey`) starts an entries
 * chapter running to the next heading of the same or a higher level; a
 * chapter without entries changes nothing. Inside it a heading holding no
 * block but entries below it is a section, and an entry inside another
 * entry is nested. Sets `place` on every entry and returns:
 * - the warnings: `ENTRY_OUTSIDE_CHAPTER` for an entry outside every
 *   chapter (also one in a container), `ENTRY_NESTED_LAYOUT` for a nested
 *   entry with a layout other than `auto`, `ENTRY_LAYOUT_UNKNOWN` for a
 *   value that is not a layout (it counts as `auto`), all at the block's line;
 * - `bodies`: the top-level blocks of the chapter entries, heading included
 *   (their images are written without US-028's fit, G0-C5).
 */
export function placeEntries(
  root: readonly BlockNode[],
  entries: ReadonlyMap<HeadingNode, EntryData>,
  rules: ReadonlyMap<string, HeadingRule>,
): {
  warnings: PlaceWarning[];
  bodies: Set<BlockNode>;
  chapters: Set<BlockNode>;
  sections: Set<BlockNode>;
} {
  const warnings: PlaceWarning[] = [];
  const bodies = new Set<BlockNode>();
  // US-033 AC-1, AC-2: the chapter headings that hold entries, and the
  // section headings that do.
  const chapters = new Set<BlockNode>();
  const sections = new Set<BlockNode>();
  let chapter: {depth: number; text: string; node: BlockNode} | null = null;
  // The non-entry headings above the current block; an entry's section is
  // the nearest one above it (a heading of the entry's own level holds no
  // entry and never replaces it).
  const headingsAbove: {depth: number; text: string; node: BlockNode}[] = [];
  const open: {depth: number}[] = [];
  for (const block of root) {
    if (block.kind !== 'heading') {
      if (chapter !== null && open.length > 0) bodies.add(block);
      continue;
    }
    if (chapter !== null && block.depth <= chapter.depth) {
      chapter = null;
      headingsAbove.length = 0;
      open.length = 0;
    }
    while (open.length > 0 && (open.at(-1)?.depth ?? 0) >= block.depth)
      open.pop();
    while (
      headingsAbove.length > 0 &&
      (headingsAbove.at(-1)?.depth ?? 0) >= block.depth
    )
      headingsAbove.pop();
    const entry = entries.get(block);
    if (chapter === null) {
      const text = headingText(block);
      if (rules.get(headingRuleKey(text)) === 'entries') {
        chapter = {depth: block.depth, text, node: block};
        continue;
      }
    }
    if (entry === undefined) {
      if (chapter !== null && open.length === 0)
        headingsAbove.push({
          depth: block.depth,
          text: headingText(block),
          node: block,
        });
      else if (chapter !== null) bodies.add(block);
      continue;
    }
    if (chapter === null) continue;
    chapters.add(chapter.node);
    const section = open.length === 0 ? (headingsAbove.at(-1) ?? null) : null;
    if (section !== null) sections.add(section.node);
    entry.place = {
      chapter: chapter.text,
      chapterHeading: chapter.node,
      section: open.length === 0 ? (headingsAbove.at(-1)?.text ?? null) : null,
      nested: open.length > 0,
      layout: 'auto',
    };
    bodies.add(block);
    open.push({depth: block.depth});
  }
  for (const entry of entries.values()) {
    const value = entry.fields.get('layout');
    const written =
      value === undefined || value === null ? null : String(value).trim();
    if (entry.place === undefined) {
      entry.place = {
        chapter: null,
        section: null,
        nested: false,
        layout: 'auto',
      };
      warnings.push({
        code: 'ENTRY_OUTSIDE_CHAPTER',
        message: `"${entry.text}"`,
        line: entry.line,
      });
    } else if (entry.place.nested) {
      if (written !== null && written !== '' && written !== 'auto')
        warnings.push({
          code: 'ENTRY_NESTED_LAYOUT',
          message: `"${entry.text}": ${written}`,
          line: entry.line,
        });
    } else if (written !== null && written !== '' && written !== 'auto') {
      const known = ENTRY_LAYOUTS.find((l) => l === written);
      if (known === undefined)
        warnings.push({
          code: 'ENTRY_LAYOUT_UNKNOWN',
          message: `"${entry.text}: ${written}"`,
          line: entry.line,
        });
      else entry.place.layout = known;
    }
  }
  return {warnings, bodies, chapters, sections};
}
