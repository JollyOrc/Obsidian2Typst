// Test support for US-030 to US-036 (epic #121): the `entries` settings of
// US-030's examples, the `Fen Hare` note, and a short way to convert with them.
// Source of truth: docs/user-stories/US-030-entry-data-and-statblock.md.
import {type ConvertResult, type ConvertSettings} from '../../src/core/convert';
import {type Warning} from '../../src/core/emit/context';
import {SETTINGS, run} from './convert';

/** US-030's example preset, `entries` group (synthetic field names). */
export const ENTRIES = {
  statblock: {
    stats: [
      {key: 'might', label: 'Might'},
      {key: 'wits', label: 'Wits'},
      {key: 'speed', label: 'Speed'},
    ],
    traits: [
      {key: 'move', label: 'Move'},
      {key: 'guard', label: 'Guard'},
    ],
    boxes: 'vigour',
    track: [
      {label: 'Fine', icon: 'Icons/fine.svg'},
      {label: 'Hurt', icon: 'Icons/hurt.svg'},
      {label: 'Down', icon: 'Icons/down.svg'},
      {label: 'Fading', icon: 'Icons/fading.svg'},
      {label: 'Gone', icon: 'Icons/gone.svg'},
    ],
    trackKey: 'states',
    trackLabel: 'STATE',
    trackDefault: ['Fine', 'Hurt', 'Down', 'Gone'],
  },
  tagLabels: {beast: 'Beast', magical: 'Magical'},
} as const;

/** The YAML of US-030's example block (`Fen Hare`). */
export const FEN_HARE_YAML = [
  'vigour: 11',
  'might: 4',
  'wits: 2',
  'speed: 5',
  'attacks:',
  '  - "Kick: 2d6"',
  '  - "**Bite**: 1d6"',
  'skills:',
  '  - Quick Step',
  '  - Keen Nose',
  'tags:',
  '  - beast',
  'illustration: "![Drawn by A. Nobody](assets/hare.png)"',
  'layout: auto',
];

/** An entry: heading, block (with `fence`), then the body lines. */
export function entry(
  heading: string,
  yaml: readonly string[],
  body: readonly string[] = [
    'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
  ],
  fence = '```',
): string {
  return [heading, `${fence}o2t-entry`, ...yaml, fence, ...body].join('\n');
}

/** US-030's example note. */
export const FEN_HARE = [
  entry('### Fen Hare', FEN_HARE_YAML),
  '',
  '#### Habits',
  '',
  'They gather at dusk.',
].join('\n');

/** Converts `source` with the example `entries` settings plus `over`. */
export function runEntries(
  source: string,
  over: Record<string, unknown> = {},
): Promise<ConvertResult> {
  const settings = {
    ...SETTINGS,
    entries: ENTRIES,
    ...over,
  } as unknown as ConvertSettings;
  return run(source, {settings});
}

/** The warnings of `codes` only, as `CODE message`, in order. */
export const warningsOf = (
  warnings: readonly Warning[],
  codes: readonly string[],
): string[] =>
  warnings
    .filter((w) => codes.includes(w.code))
    .map((w) => `${w.code} ${w.message}`);

/** Every code of US-030 (AC-19). */
export const US030_CODES = [
  'ENTRY_YAML_INVALID',
  'ENTRY_ORPHAN_BLOCK',
  'ENTRY_BLOCK_TWICE',
  'ENTRY_BLOCK_IN_CONTAINER',
  'ENTRY_VALUE_NOT_TEXT',
  'ENTRY_TRACK_UNKNOWN',
  'ENTRY_NO_LEDE',
  'ENTRY_LEDE_SHORT',
  'STAT_BOXES_MANY',
  'STAT_BOXES_NOT_NUMBER',
  'TAG_UNMAPPED',
  'STAT_SUM_MISMATCH',
  'STAT_ATTACK_NO_DICE',
  'ENTRY_IN_GLOSSARY',
] as const;

/**
 * The Typst helper that draws a statblock (US-030 AC-15: a plugin name).
 * A call of it in the `.typ` means a statblock is drawn.
 */
export const STATBLOCK_HELPER = 'o2t-statblock';
export const statblockCalls = (typ: string): number =>
  typ.split(`#${STATBLOCK_HELPER}(`).length - 1;

/**
 * What the statblock helper records about each statblock it drew, as
 * `metadata` labelled `<o2t-statblock>` (the test interface of US-030, read
 * with `world.query` as US-028's decisions are): the band text, the box
 * count and rows, the state track's cell labels, and the parts in order.
 */
export interface StatblockFact {
  band: string;
  boxes: number;
  rows: number;
  cells: string[];
  parts: string[];
}
