// US-043 AC-1, AC-4, AC-9: the encounter block. Finds every block, empties
// it in the tree (its YAML is data, never printed; the emptied node marks
// where the rows are drawn, read only by the encounter emitter), drops blocks
// inside containers, and reads the YAML. Pure: no Obsidian, Node, or I/O
// imports; nothing is emitted here. With `entries.ts` and `details.ts` the
// only place in `src` that reads code nodes with an `o2t-` language
// (SCAR-039); the contract is docs/technical/encounter-block.md.
import {isMap, isSeq, parseDocument} from 'yaml';
import type {BlockNode, CodeNode, HeadingNode} from '../parse';

/** The info string of an encounter block (AC-1). */
export const ENCOUNTER_BLOCK_LANG = 'o2t-encounter';

/** A warning of this module, with its 1-based source line. */
export interface EncounterWarning {
  code:
    | 'ENCOUNTER_YAML_INVALID'
    | 'ENCOUNTER_KEY_UNKNOWN'
    | 'ENCOUNTER_COUNT_INVALID'
    | 'ENCOUNTER_COUNT_CAPPED'
    | 'ENCOUNTER_BOXES_CAPPED'
    | 'ENCOUNTER_IN_CONTAINER'
    | 'ENCOUNTER_NO_STATBLOCK'
    | 'ENTRY_VALUE_NOT_TEXT'
    | 'ENTRY_TRACK_UNKNOWN';
  message: string;
  line: number;
}

/** AC-1: one block at the top level, and the heading above it (null: none). */
export interface FoundEncounterBlock {
  /** The block as written (its YAML). */
  block: CodeNode;
  /** The emptied node left in the tree at the block's place. */
  marker: CodeNode;
  owner: HeadingNode | null;
}

/** AC-1, AC-9: the tree with emptied blocks, the blocks found, the warnings. */
export interface EncounterBlockScan {
  root: BlockNode[];
  found: FoundEncounterBlock[];
  warnings: EncounterWarning[];
}

const isEncounterBlock = (block: BlockNode | undefined): block is CodeNode =>
  block?.kind === 'code' && block.lang === ENCOUNTER_BLOCK_LANG;

/** AC-9: the warning of a block inside a container or a glossary term. */
export const encounterInContainer = (line: number): EncounterWarning => ({
  code: 'ENCOUNTER_IN_CONTAINER',
  message:
    'An o2t-encounter block inside a quote, callout, list item or glossary term is left out',
  line,
});

const same = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * US-043 | AC-1, AC-9: every `o2t-encounter` block of `root`. At the top
 * level the block stays in place, emptied (`value: ''`: its YAML is never
 * printed) as the marker of where its rows are drawn; its owner is the last
 * heading before it. Inside a quote, callout, list item or footnote, at any
 * depth, it is taken out with `ENCOUNTER_IN_CONTAINER` (SCAR-041: the
 * container is known from the tree). Runs right after `parse`, before every
 * other step (SCAR-034, SCAR-039).
 */
export function scanEncounterBlocks(
  root: readonly BlockNode[],
): EncounterBlockScan {
  const found: FoundEncounterBlock[] = [];
  const warnings: EncounterWarning[] = [];

  const inner = (blocks: readonly BlockNode[]): BlockNode[] => {
    const out: BlockNode[] = [];
    for (const block of blocks) {
      if (isEncounterBlock(block)) {
        warnings.push(encounterInContainer(block.line));
        continue;
      }
      out.push(nested(block));
    }
    return out;
  };
  const nested = (block: BlockNode): BlockNode => {
    switch (block.kind) {
      case 'blockquote':
      case 'item':
      case 'footnote-def': {
        const children = inner(block.children);
        return same(children, block.children) ? block : {...block, children};
      }
      case 'list': {
        const children = block.children.map(
          (item) => nested(item) as typeof item,
        );
        return same(children, block.children) ? block : {...block, children};
      }
      default:
        return block;
    }
  };

  const out: BlockNode[] = [];
  let owner: HeadingNode | null = null;
  for (const block of root) {
    if (block.kind === 'heading') owner = block;
    if (isEncounterBlock(block)) {
      const marker: CodeNode = {...block, value: ''};
      found.push({block, marker, owner});
      out.push(marker);
      continue;
    }
    out.push(nested(block));
  }
  return {root: out, found, warnings};
}

/** AC-1: one line of a block, as written. */
export interface EncounterLine {
  name: string;
  /** As written: a text for a valid block; anything else is a bad count. */
  count: unknown;
  note: string | null;
  /** The creature's properties (an `o2t-entry` map); null without. */
  data: Record<string, unknown> | null;
  /** The block's first line (rule 8). */
  line: number;
}

/** AC-1: one block read. */
export interface EncounterRead {
  found: FoundEncounterBlock;
  title: string | null;
  lines: EncounterLine[];
  warnings: EncounterWarning[];
}

const TOP_KEYS = new Set(['title', 'rows']);
const ROW_KEYS = new Set(['name', 'count', 'note', 'data']);

/**
 * US-043 | AC-1 (contract items 2 to 5): reads one block's YAML (`yaml`
 * 2.9.1, YAML 1.2). Not a map with a list `rows` → no lines and
 * `ENCOUNTER_YAML_INVALID`. Unknown keys (top level and rows, in the order
 * met, each once) → one `ENCOUNTER_KEY_UNKNOWN`. A row without a text `name`
 * is left out with `ENCOUNTER_YAML_INVALID`. `title`, `note` empty → null;
 * `data` not a map → null.
 */
export function readEncounterBlock(found: FoundEncounterBlock): EncounterRead {
  const line = found.block.line;
  const invalid = (reason: string): EncounterRead => ({
    found,
    title: null,
    lines: [],
    warnings: [
      {
        code: 'ENCOUNTER_YAML_INVALID',
        message: `The o2t-encounter block is not a map with a list of rows: ${reason}`,
        line,
      },
    ],
  });
  const doc = parseDocument(found.block.value, {version: '1.2'});
  if (doc.errors.length > 0)
    return invalid(doc.errors[0]?.message.split('\n')[0] ?? 'YAML error');
  if (!isMap(doc.contents)) return invalid('not a map');
  if (!isSeq(doc.contents.get('rows', true))) return invalid('no list "rows"');
  const raw = doc.toJS() as Record<string, unknown>;
  const warnings: EncounterWarning[] = [];
  const unknown: string[] = [];
  const unknownKey = (key: string) => {
    if (!unknown.includes(key)) unknown.push(key);
  };
  for (const key of Object.keys(raw)) if (!TOP_KEYS.has(key)) unknownKey(key);
  const text = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() !== ''
      ? v.trim()
      : typeof v === 'number'
        ? String(v)
        : null;
  const lines: EncounterLine[] = [];
  for (const item of raw.rows as unknown[]) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      warnings.push({
        code: 'ENCOUNTER_YAML_INVALID',
        message: 'A row is not a map',
        line,
      });
      continue;
    }
    const row = item as Record<string, unknown>;
    for (const key of Object.keys(row)) if (!ROW_KEYS.has(key)) unknownKey(key);
    const name = text(row.name);
    if (name === null) {
      warnings.push({
        code: 'ENCOUNTER_YAML_INVALID',
        message: 'A row has no name',
        line,
      });
      continue;
    }
    const data = row.data;
    lines.push({
      name,
      count: row.count,
      note: text(row.note),
      data:
        data !== null && typeof data === 'object' && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : null,
      line,
    });
  }
  if (unknown.length > 0) {
    warnings.unshift({
      code: 'ENCOUNTER_KEY_UNKNOWN',
      message: `Unknown keys in the o2t-encounter block: ${unknown.join(', ')}`,
      line,
    });
  }
  return {found, title: text(raw.title), lines, warnings};
}
