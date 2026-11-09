// US-038 AC-1 to AC-3: the details block. Finds every block, takes it out of
// the tree (it is data, never printed), decides which heading it belongs to
// and reads its YAML. Pure: no Obsidian, Node, or I/O imports; nothing is
// emitted here. With `entries.ts` the only place in `src` that reads code
// nodes with an `o2t-` language (SCAR-039); the contract is
// docs/technical/details-block.md.
import {isMap, parseDocument} from 'yaml';
import {visibleText} from '../parse';
import {ENTRY_BLOCK_LANG, linkShown, lowerKeys} from './entries';
import type {BlockNode, CodeNode, HeadingNode, InlineNode} from '../parse';

/** The info string of a details block (AC-1). */
export const DETAILS_BLOCK_LANG = 'o2t-details';

/** US-038 AC-5: one badge of the row: a key of the block and what it shows. */
export interface DetailItem {
  key: string;
  /** The vault path of an SVG file for every value. */
  icon?: string;
  /** The vault path of an SVG file per value (wins over `icon`). */
  icons?: Readonly<Record<string, string>>;
  /** The label for every value (flags: the label shown when true). */
  label?: string;
  /** The label per value (wins over `label`). */
  labels?: Readonly<Record<string, string>>;
}

/** US-038 AC-5: the `details` group of a preset note (preset notes only). */
export interface DetailsSettings {
  items?: readonly DetailItem[];
  /** `#rrggbb` of the row's text and icons. */
  color?: string;
  /** The row's size in pt. */
  size?: number;
}

/** US-038 AC-6: the built-in look of the row, in one place. */
export const DETAILS_BUILTINS = Object.freeze({
  color: '#7a4a2e',
  size: 9.5,
  gray: '#4d4d4d',
});

/** A warning of this module, with its 1-based source line. */
export interface DetailWarning {
  code:
    | 'DETAIL_YAML_INVALID'
    | 'DETAIL_ORPHAN_BLOCK'
    | 'DETAIL_BLOCK_TWICE'
    | 'DETAIL_BLOCK_IN_CONTAINER'
    | 'DETAIL_IN_GLOSSARY'
    | 'DETAIL_BLOCK_WITH_ENTRY';
  message: string;
  line: number;
}

/** AC-1: one block that stands right under its heading. */
export interface FoundDetailsBlock {
  heading: HeadingNode;
  block: CodeNode;
}

/** AC-1, AC-3: the tree without details blocks, the blocks found, the warnings. */
export interface DetailsBlockScan {
  root: BlockNode[];
  found: FoundDetailsBlock[];
  warnings: DetailWarning[];
}

const isDetailsBlock = (block: BlockNode | undefined): block is CodeNode =>
  block?.kind === 'code' && block.lang === DETAILS_BLOCK_LANG;

const isEntryBlock = (block: BlockNode): boolean =>
  block.kind === 'code' && block.lang === ENTRY_BLOCK_LANG;

/** The heading's text as a reader sees it, for the messages. */
const headingText = (heading: HeadingNode): string =>
  visibleText(heading.children, {dropImages: true});

const same = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * US-038 | AC-1, AC-3: takes every `o2t-details` block out of `root` (at any
 * depth, so none is ever printed) and decides its place:
 * - right after a heading (blank lines make no node) → the heading's block;
 *   an `o2t-entry` block between them does not count (it is the entry scan's);
 * - right after such a block → `DETAIL_BLOCK_TWICE` (the first counts);
 * - inside a quote or callout, at any depth → `DETAIL_BLOCK_IN_CONTAINER`
 *   (SCAR-041: the container is known from the tree, not from line starts);
 * - anywhere else (text before it, no heading above) → `DETAIL_ORPHAN_BLOCK`.
 * Containers without a details block keep their identity; the others are
 * copied with the blocks left out. Runs right after `parse`, before the entry
 * scan and every other step (SCAR-034, SCAR-039).
 */
export function scanDetailsBlocks(
  root: readonly BlockNode[],
): DetailsBlockScan {
  const found: FoundDetailsBlock[] = [];
  const warnings: DetailWarning[] = [];

  const level = (
    blocks: readonly BlockNode[],
    inContainer: boolean,
  ): BlockNode[] => {
    const out: BlockNode[] = [];
    let previous: BlockNode | undefined;
    // The heading whose block (or blocks) directly precede this one.
    let owner: HeadingNode | null = null;
    for (const block of blocks) {
      if (isDetailsBlock(block)) {
        if (inContainer) {
          warnings.push({
            code: 'DETAIL_BLOCK_IN_CONTAINER',
            message:
              'o2t-details block inside a quote or callout; not read and not printed',
            line: block.line,
          });
        } else if (previous?.kind === 'heading') {
          found.push({heading: previous, block});
          owner = previous;
        } else if (owner !== null && isDetailsBlock(previous)) {
          warnings.push({
            code: 'DETAIL_BLOCK_TWICE',
            message: `"${headingText(owner)}"`,
            line: block.line,
          });
        } else {
          warnings.push({
            code: 'DETAIL_ORPHAN_BLOCK',
            message:
              'o2t-details block not directly under a heading; not read and not printed',
            line: block.line,
          });
        }
        previous = block;
        continue;
      }
      if (!inContainer && isEntryBlock(block)) {
        // The entry scan's block: it does not move the details block's place.
        out.push(block);
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

/** AC-1, AC-2: one block's data, read from its YAML. */
export interface DetailsData {
  heading: HeadingNode;
  /** The heading's visible text (the messages). */
  text: string;
  /** The block's first line (the fence). */
  line: number;
  /** Every key of the block, lower-cased (first of a case pair wins). */
  fields: ReadonlyMap<string, unknown>;
}

/** One block read, before the entry and the glossary decide whether it counts. */
export interface DetailsRead {
  found: FoundDetailsBlock;
  /** null when the YAML is invalid (AC-2). */
  data: DetailsData | null;
  warnings: DetailWarning[];
}

/**
 * US-038 | AC-2: reads one block's YAML (`yaml` 2.9.1, YAML 1.2; any valid
 * mapping, not only the fixed form). A parse error or a value that is not a
 * mapping gives `DETAIL_YAML_INVALID` and no data; an empty block is an
 * empty mapping. Keys are compared lower-cased (`lowerKeys`: the first of a
 * case pair wins); the values are read by the model, not here.
 */
export function readDetailsBlock(found: FoundDetailsBlock): DetailsRead {
  const {heading, block} = found;
  const text = headingText(heading);
  const doc = parseDocument(block.value, {version: '1.2'});
  if (
    doc.errors.length > 0 ||
    (doc.contents !== null && !isMap(doc.contents))
  ) {
    return {
      found,
      data: null,
      warnings: [
        {code: 'DETAIL_YAML_INVALID', message: `"${text}"`, line: block.line},
      ],
    };
  }
  return {
    found,
    data: {
      heading,
      text,
      line: block.line,
      fields: lowerKeys(doc.toJS()),
    },
    warnings: [],
  };
}

/** US-038: the rows of a note, by heading, and the warnings in order. */
export interface DetailsPlan {
  rows: ReadonlyMap<HeadingNode, DetailsData>;
  warnings: DetailWarning[];
}

/**
 * US-038 | AC-3: the details blocks that count. A block under a heading that
 * also has an entry block is dropped (`DETAIL_BLOCK_WITH_ENTRY "<heading>"`,
 * the entry wins); one under a glossary term or inside a term
 * (`inGlossary`) is dropped (`DETAIL_IN_GLOSSARY "<term>"`); both at the
 * block's line, with the block's own warnings dropped.
 */
export function planDetails(
  reads: readonly DetailsRead[],
  is: {
    hasEntry: (heading: HeadingNode) => boolean;
    inGlossary: (heading: HeadingNode) => boolean;
  },
): DetailsPlan {
  const rows = new Map<HeadingNode, DetailsData>();
  const warnings: DetailWarning[] = [];
  for (const read of reads) {
    const {heading, block} = read.found;
    if (is.hasEntry(heading)) {
      warnings.push({
        code: 'DETAIL_BLOCK_WITH_ENTRY',
        message: `"${headingText(heading)}"`,
        line: block.line,
      });
      continue;
    }
    if (is.inGlossary(heading)) {
      warnings.push({
        code: 'DETAIL_IN_GLOSSARY',
        message: `"${headingText(heading)}"`,
        line: block.line,
      });
      continue;
    }
    warnings.push(...read.warnings);
    if (read.data !== null) rows.set(heading, read.data);
  }
  return {rows, warnings};
}

/**
 * US-038 | AC-9: link markup in a value: links and wikilinks stay (the row
 * prints them as links); an image or an embed prints its alt text or its
 * shown name, never a picture or a note (`linkShown`); bold, italic and the
 * other marks keep their children treated the same way.
 */
export function keepLinks(nodes: readonly InlineNode[]): InlineNode[] {
  return nodes.flatMap((node): InlineNode[] => {
    switch (node.kind) {
      case 'link':
        return [{...node, children: keepLinks(node.children)}];
      case 'embed':
        return [{kind: 'text', value: linkShown(node), line: node.line}];
      case 'image':
        return [{kind: 'text', value: node.alt, line: node.line}];
      case 'strong':
      case 'emph':
      case 'delete':
      case 'mark':
        return [{...node, children: keepLinks(node.children)}];
      default:
        return [node];
    }
  });
}
