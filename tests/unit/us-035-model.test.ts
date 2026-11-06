// US-035 AC-1, AC-2, AC-4, AC-5, AC-9 — the statblock's drawing model in
// src/core, shared by the PDF emitter (US-030) and the Obsidian preview:
// the parts and their values, the preview's differences (— for a missing
// value, attacks without dice flagged, warnings as notices), the band text,
// and the cases where no statblock is drawn. Loaded at run time.
// Source of truth: docs/user-stories/US-035-entry-block-preview-in-obsidian.md.
// Red until US-035 is implemented (G2, 2026-11-06).
import {describe, expect, it} from 'vitest';
import {ENTRIES} from '../support/entries';

/** The model module the tickets add. */
const MODEL = '../../src/core/entries/model';
export interface StatblockModel {
  band: string;
  boxes: number;
  rows: number;
  cells: {label: string; icon: string}[];
  parts: string[];
  attributes: string;
  traits: string;
  attacks: {name: string; dice: string; noDice: boolean}[];
  skills: string;
  tags: string;
  /** The warnings of US-030 for this block, as `CODE: detail`. */
  notices: string[];
}
interface ModelModule {
  /**
   * US-035 AC-1, AC-2: the model for one block's data and the `entries`
   * settings; `heading` is the nearest heading above, `fileName` the note's.
   * `missing: 'dash'` shows a missing value as `—` (the preview); `'omit'`
   * leaves it out (the PDF). Returns null when there is no statblock.
   */
  statblockModel(
    data: Record<string, unknown>,
    entries: unknown,
    context: {
      heading: string | null;
      fileName: string;
      missing: 'dash' | 'omit';
    },
  ): StatblockModel | null;
}
const model = async (): Promise<ModelModule> => {
  const path: string = MODEL;
  return (await import(/* @vite-ignore */ path)) as ModelModule;
};

const FEN = {
  vigour: 11,
  might: 4,
  wits: 2,
  speed: 5,
  attacks: ['Kick: 2d6', '**Bite**: 1d6'],
  skills: ['Quick Step', 'Keen Nose'],
  tags: ['beast'],
};
const CTX = {heading: 'Fen Hare', fileName: 'Rules', missing: 'dash'} as const;

describe('US-035 AC-1 the parts', () => {
  it('US-035 AC-1: the example block gives the parts of US-030 AC-10', async () => {
    const {statblockModel} = await model();
    const m = statblockModel(FEN, ENTRIES, CTX);
    expect(m).toMatchObject({
      band: 'Fen Hare',
      boxes: 11,
      rows: 1,
      parts: [
        'band',
        'boxes',
        'track',
        'attributes',
        'attacks',
        'skills',
        'tags',
      ],
      attributes: 'Might 4 · Wits 2 · Speed 5',
      skills: 'Skills: Quick Step, Keen Nose',
      tags: 'Beast',
    });
    expect(m?.cells.map((c) => c.label)).toEqual([
      'Fine',
      'Hurt',
      'Down',
      'Gone',
    ]);
    expect(m?.cells[0]?.icon).toBe('Icons/fine.svg');
  });

  it("US-035 AC-1 (decision 3): with no heading above, the band is the note's file name", async () => {
    const {statblockModel} = await model();
    expect(
      statblockModel(FEN, ENTRIES, {
        ...CTX,
        heading: null,
        fileName: 'Fen Hare',
      })?.band,
    ).toBe('Fen Hare');
  });
});

describe("US-035 AC-2 the preview's differences", () => {
  it('US-035 AC-2: a missing stat is — in the preview and left out in the PDF', async () => {
    const {statblockModel} = await model();
    const data = {might: 4, attacks: ['Kick: 2d6']};
    expect(statblockModel(data, ENTRIES, CTX)?.attributes).toBe(
      'Might 4 · Wits — · Speed —',
    );
    expect(
      statblockModel(data, ENTRIES, {...CTX, missing: 'omit'})?.attributes,
    ).toBe('Might 4');
  });

  it('US-035 AC-2: an attack without dice is flagged; one with dice is not', async () => {
    const {statblockModel} = await model();
    const m = statblockModel(
      {might: 4, attacks: ['Glare: frightens', 'Kick: 2d6']},
      ENTRIES,
      CTX,
    );
    expect(m?.attacks).toEqual([
      {name: 'Glare', dice: 'frightens', noDice: true},
      {name: 'Kick', dice: '2d6', noDice: false},
    ]);
  });

  it('US-035 AC-2: the warnings of US-030 become notices', async () => {
    const {statblockModel} = await model();
    const m = statblockModel(
      {might: 4, vigour: 46, tags: ['rare']},
      ENTRIES,
      CTX,
    );
    expect(m?.notices).toEqual(['STAT_BOXES_MANY: 46', 'TAG_UNMAPPED: rare']);
  });
});

describe('US-035 AC-3 icons recoloured (as US-030 AC-13)', () => {
  it('US-035 AC-3: every fill and stroke colour other than none becomes the frame colour', async () => {
    const path: string = MODEL;
    const {recolourSvg} = (await import(/* @vite-ignore */ path)) as {
      recolourSvg(svg: string, colour: string): string;
    };
    const svg =
      '<svg><path fill="#000" stroke="#123456"/><rect fill="none" stroke="none"/></svg>';
    expect(recolourSvg(svg, '#7a4a2e')).toBe(
      '<svg><path fill="#7a4a2e" stroke="#7a4a2e"/><rect fill="none" stroke="none"/></svg>',
    );
  });
});

describe('US-035 AC-4 no statblock', () => {
  it('US-035 AC-4: empty entries settings, or no stats and no attacks → null', async () => {
    const {statblockModel} = await model();
    expect(statblockModel(FEN, {}, CTX)).toBeNull();
    expect(
      statblockModel({skills: ['Swift'], tags: ['beast']}, ENTRIES, CTX),
    ).toBeNull();
    expect(statblockModel(FEN, ENTRIES, CTX)).not.toBeNull();
  });
});
