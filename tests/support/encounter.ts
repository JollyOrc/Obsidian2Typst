// Test support for US-043 (prefilled encounter rows): the example block of
// docs/technical/encounter-block.md, a builder for blocks, the codes of the
// story, and a short way to convert with US-030's example `entries`.
// Source of truth: docs/user-stories/US-043-prefilled-encounter-rows.md.
// All names are invented (SCAR-035).
import {type ConvertResult} from '../../src/core/convert';
import {ENTRIES, runEntries} from './entries';

/** The YAML lines of one row: `name`, `count`, then `note` and `data` lines. */
export function row(
  name: string,
  count: string,
  note?: string,
  data?: readonly string[],
): string[] {
  const lines = [`  - name: ${name}`, `    count: "${count}"`];
  if (note !== undefined) lines.push(`    note: ${note}`);
  if (data !== undefined) {
    lines.push('    data:');
    for (const d of data) lines.push(`      ${d}`);
  }
  return lines;
}

/** A fenced `o2t-encounter` block with `rows` (and an optional `title`). */
export function encounter(
  rows: readonly (readonly string[])[],
  title?: string,
  fence = '```',
): string {
  return [
    `${fence}o2t-encounter`,
    ...(title === undefined ? [] : [`title: ${title}`]),
    'rows:',
    ...rows.flat(),
    fence,
  ].join('\n');
}

/** `Fen Hare`'s data, US-030's example values (no image key: the writer leaves it out). */
export const FEN_HARE_DATA = [
  'vigour: 11',
  'might: 4',
  'wits: 1',
  'speed: 5',
  'move: 5',
  'attacks:',
  '  - "Kick: 2d6"',
];

/** `Bog Wight`'s data: its own three-cell track and an attack with a long rest. */
export const BOG_WIGHT_DATA = [
  'vigour: 20',
  'might: 6',
  'states: [Fine, Down, Gone]',
  'attacks:',
  '  - "Claw: 3d8"',
  '  - "Wail: Wits check, 2 successes"',
];

/** The contract page's example block, under its room heading. */
export const MIRE_HOLLOW = [
  '## Mire Hollow',
  encounter(
    [
      row('Fen Hare', '2', 'nibbling reeds', FEN_HARE_DATA),
      row('Bog Wight', '1d4', undefined, BOG_WIGHT_DATA),
      row('Lost Pilgrim', '1', 'no stats'),
    ],
    'Night watch',
  ),
  '',
  'The reeds rustle.',
].join('\n');

/** Every warning code of US-043. */
export const US043_CODES = [
  'ENCOUNTER_YAML_INVALID',
  'ENCOUNTER_KEY_UNKNOWN',
  'ENCOUNTER_COUNT_INVALID',
  'ENCOUNTER_COUNT_CAPPED',
  'ENCOUNTER_BOXES_CAPPED',
  'ENCOUNTER_IN_CONTAINER',
  'ENCOUNTER_NO_STATBLOCK',
] as const;

/** The Typst helper that draws one block's rows (a plugin name, US-016 AC-11). */
export const ENCOUNTER_HELPER = 'o2t-encounter';
export const encounterCalls = (typ: string): number =>
  typ.split(`#${ENCOUNTER_HELPER}(`).length - 1;

/** Converts `source` with US-030's example `entries` plus `over`. */
export const runEncounter = (
  source: string,
  over: Record<string, unknown> = {},
): Promise<ConvertResult> => runEntries(source, over);

/** US-030's example `entries` with another `statblock` part. */
export const withStatblock = (
  statblock: Record<string, unknown>,
): Record<string, unknown> => ({
  entries: {...ENTRIES, statblock: {...ENTRIES.statblock, ...statblock}},
});

/**
 * What the row helper records about each row it drew, as `metadata`
 * labelled `<o2t-encounter-row>` (the test interface of US-043, read with
 * `world.query` as US-030's `<o2t-statblock>`). Rectangles are in mm from the
 * row's top left corner, measured on the laid-out parts (their frames, not
 * the ink: SCAR-023, the manual check looks at the ink).
 */
export interface EncounterRowFact {
  label: string;
  note: string | null;
  blank: boolean;
  stats: string[];
  traits: string[];
  boxes: number;
  cells: string[];
  attacks: [string, string][];
  /** Blank rows: the number of write-in attack slots (US-036's three). */
  slots: number;
  /** The writing space: tick boxes, track cells, the notes line's clear height. */
  zones: {x: number; y: number; w: number; h: number}[];
  /** Every text frame of the row. */
  texts: {x: number; y: number; w: number; h: number}[];
}

/** What the block helper records once per block, labelled `<o2t-encounter>`. */
export interface EncounterFact {
  title: string | null;
  rows: number;
  columns: number;
  /** The width of one row in mm. */
  rowMm: number;
  /** The page each row starts on, in order. */
  pages: number[];
  /** The height of each row in mm, in order. */
  heightsMm: number[];
}
