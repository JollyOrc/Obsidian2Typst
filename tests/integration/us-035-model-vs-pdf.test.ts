// US-035 AC-2 (SCAR-017) — the preview and the PDF can't drift: for the same
// data, the core model's parts, boxes, rows and cells equal what the PDF's
// statblock helper recorded (`<o2t-statblock>`, US-030).
// Source of truth: docs/user-stories/US-035-entry-block-preview-in-obsidian.md.
// Red until US-030 and US-035 are implemented (G2, 2026-11-06).
import {afterAll, describe, expect, it} from 'vitest';
import {ENTRIES, entry} from '../support/entries';
import {compileEntries, disposeEntriesCompiler} from '../support/entries-pdf';

afterAll(disposeEntriesCompiler);

const MODEL = '../../src/core/entries/model';
interface ModelModule {
  statblockModel(
    data: Record<string, unknown>,
    entries: unknown,
    context: {
      heading: string | null;
      fileName: string;
      missing: 'dash' | 'omit';
    },
  ): {
    band: string;
    boxes: number;
    rows: number;
    cells: {label: string}[];
    parts: string[];
  } | null;
}

const SETS: [string, Record<string, unknown>, string[]][] = [
  [
    'full',
    {
      vigour: 16,
      might: 4,
      wits: 2,
      speed: 5,
      attacks: ['Kick: 2d6'],
      skills: ['Swift'],
      tags: ['beast'],
      states: ['Fine', 'Hurt', 'Down', 'Fading', 'Gone'],
    },
    [
      'vigour: 16',
      'might: 4',
      'wits: 2',
      'speed: 5',
      'attacks: ["Kick: 2d6"]',
      'skills: [Swift]',
      'tags: [beast]',
      'states: [Fine, Hurt, Down, Fading, Gone]',
    ],
  ],
  [
    'partial',
    {might: 4, attacks: ['Kick: 2d6']},
    ['might: 4', 'attacks: ["Kick: 2d6"]'],
  ],
  [
    'no track',
    {might: 4, vigour: 45, states: 'none'},
    ['might: 4', 'vigour: 45', 'states: none'],
  ],
];

describe('US-035 AC-2 the same rules as the PDF', () => {
  for (const [name, data, yaml] of SETS) {
    it(`US-035 AC-2: ${name} — the model's parts, boxes, rows and cells equal the PDF's`, async () => {
      const path: string = MODEL;
      const {statblockModel} = (await import(
        /* @vite-ignore */ path
      )) as ModelModule;
      const m = statblockModel(data, ENTRIES, {
        heading: 'A',
        fileName: 'Rules',
        missing: 'omit',
      });
      const c = await compileEntries(
        entry('### A', yaml, [
          'A lede paragraph that is long enough to count.',
        ]),
      );
      const pdf = c.statblocks[0];
      expect(pdf).toBeDefined();
      expect({
        band: m?.band,
        boxes: m?.boxes,
        rows: m?.rows,
        cells: m?.cells.map((x) => x.label),
        parts: m?.parts,
      }).toEqual({
        band: pdf?.band,
        boxes: pdf?.boxes,
        rows: pdf?.rows,
        cells: pdf?.cells,
        parts: pdf?.parts,
      });
    });
  }
});
