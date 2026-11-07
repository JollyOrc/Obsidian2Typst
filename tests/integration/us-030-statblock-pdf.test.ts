// US-030 AC-10, AC-12, AC-13, AC-15 to AC-17, AC-23 — the statblock in the
// PDF: its text in order, what the helper drew (boxes, rows, track cells, the
// parts) as recorded in `<o2t-statblock>` metadata, colours in colour and
// grayscale, the icons recoloured, and a tall statblock never split.
// Source of truth: docs/user-stories/US-030-entry-data-and-statblock.md.
// Red until US-030 is implemented (G2, 2026-11-06).
import {afterAll, describe, expect, it} from 'vitest';
import {ENTRIES, FEN_HARE, FEN_HARE_YAML, entry} from '../support/entries';
import {
  compileEntries,
  disposeEntriesCompiler,
  inOrder,
} from '../support/entries-pdf';

/** The colour preset of the story's AC-15 examples. */
const COLOUR = {
  ...ENTRIES,
  statblock: {
    ...ENTRIES.statblock,
    fill: '#fbe2c5',
    frame: {color: '#7a4a2e', width: 0.75},
    rules: {color: '#7a4a2e', width: 0.4},
    boxFill: '#fefcf0',
  },
};

/** US-030's rig over the shared one: the colour preset, its facts. */
async function compileUS030(
  source: string,
  over: Record<string, unknown> = {},
) {
  const c = await compileEntries(source, {over: {entries: COLOUR, ...over}});
  return {pages: c.pages, facts: c.statblocks, diagnostics: c.diagnostics};
}
afterAll(disposeEntriesCompiler);

const LEDE = [
  'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
];

describe('US-030 AC-10 the parts in order', () => {
  it('US-030 AC-10: the example statblock reads in the order of the story', async () => {
    const {pages, facts} = await compileUS030(FEN_HARE);
    const text = pages.map((p) => p.text).join(' ');
    expect(
      inOrder(text, [
        'Fen Hare',
        'VIGOUR',
        '11',
        'STATE',
        'Might 4 · Wits 2 · Speed 5',
        'Kick',
        '2d6',
        'Bite',
        '1d6',
        'Skills: Quick Step, Keen Nose',
        'Beast',
      ]),
      text,
    ).toBe(true);
    expect(facts).toEqual([
      {
        band: 'Fen Hare',
        boxes: 11,
        rows: 1,
        cells: ['Fine', 'Hurt', 'Down', 'Gone'],
        parts: [
          'band',
          'boxes',
          'track',
          'attributes',
          'attacks',
          'skills',
          'tags',
        ],
      },
    ]);
  });

  it('US-030 AC-10 (G0-C12): with numbered headings the band has no number', async () => {
    const {facts, pages} = await compileUS030(FEN_HARE, {
      headingNumbering: '1.1',
    });
    expect(facts[0]?.band).toBe('Fen Hare');
    expect(pages.map((p) => p.text).join(' ')).not.toMatch(
      /◆\s*[\d.]+\s+Fen Hare/,
    );
  });
});

describe('US-030 AC-12 the box row in the PDF', () => {
  const rows: [string, number, number][] = [
    ['0', 0, 0],
    ['1', 1, 1],
    ['15', 15, 1],
    ['16', 16, 2],
    ['45', 45, 3],
    ['46', 0, 0],
    ['varies', 0, 0],
  ];
  for (const [value, boxes, lines] of rows) {
    it(`US-030 AC-12: vigour ${value} → ${boxes} boxes in ${lines} rows`, async () => {
      const {facts} = await compileUS030(
        entry('### A', ['might: 4', `vigour: ${value}`], LEDE),
      );
      expect(facts.map((f) => [f.boxes, f.rows])).toEqual([[boxes, lines]]);
    });
  }
});

describe('US-030 AC-13 the state track in the PDF', () => {
  it('US-030 AC-13: default, full in track order, none', async () => {
    const def = await compileUS030(entry('### A', ['might: 4'], LEDE));
    expect(def.facts[0]?.cells).toEqual(['Fine', 'Hurt', 'Down', 'Gone']);
    const full = await compileUS030(
      entry(
        '### A',
        ['might: 4', 'states: [Gone, Fading, Down, Hurt, Fine]'],
        LEDE,
      ),
    );
    expect(full.facts[0]?.cells).toEqual([
      'Fine',
      'Hurt',
      'Down',
      'Fading',
      'Gone',
    ]);
    const none = await compileUS030(
      entry('### A', ['might: 4', 'states: none'], LEDE),
    );
    expect(none.facts[0]?.cells).toEqual([]);
    expect(none.facts[0]?.parts).not.toContain('track');
  });

  it('US-030 AC-13: the icons are recoloured to the frame colour', async () => {
    const {pages} = await compileUS030(FEN_HARE);
    expect(pages.flatMap((p) => p.fills)).toContain('#7a4a2e');
    expect(pages.flatMap((p) => p.fills)).not.toContain('#000000');
  });
});

describe('US-030 AC-15 look', () => {
  it('US-030 AC-15: colour — the statblock fill and the box fill are drawn', async () => {
    const fills = (await compileUS030(FEN_HARE)).pages.flatMap((p) => p.fills);
    expect(fills).toContain('#fbe2c5');
    expect(fills).toContain('#fefcf0');
  });

  it('US-030 AC-15 (G0-C7): grayscale — no fill, frame and icons #4d4d4d, boxes white', async () => {
    const fills = (
      await compileUS030(FEN_HARE, {colorMode: 'grayscale'})
    ).pages.flatMap((p) => p.fills);
    expect(fills).not.toContain('#fbe2c5');
    expect(fills).toContain('#4d4d4d');
    expect(fills).toContain('#ffffff');
  });
});

describe('US-030 AC-16 and AC-17 position and never split', () => {
  it('US-030 AC-16: the opening paragraph comes before the sub-heading, beside the statblock', async () => {
    const compiled = await compileUS030(FEN_HARE);
    expect(compiled.facts).toHaveLength(1);
    const text = compiled.pages.map((p) => p.text).join(' ');
    expect(
      inOrder(text, ['Fen hares are quick', 'Habits', 'They gather at dusk']),
    ).toBe(true);
  });

  it('US-030 AC-17: a tall statblock (45 boxes, eight attacks) is on one page, after a page of text', async () => {
    const attacks = Array.from(
      {length: 8},
      (_, i) =>
        `  - "Attack number ${i + 1} with a rather long name: ${i + 1}d6"`,
    );
    const filler = Array.from(
      {length: 30},
      (_, i) =>
        `Filler paragraph ${i} with some words to fill the page before the entry.`,
    );
    const source = [
      ...filler,
      '',
      entry(
        '### Tall',
        ['might: 4', 'vigour: 45', 'attacks:', ...attacks],
        LEDE,
      ),
    ].join('\n\n');
    const {pages, facts} = await compileUS030(source);
    expect(facts[0]?.rows).toBe(3);
    const band = pages.findIndex((p) => p.text.includes('Tall'));
    const last = pages.findIndex((p) => p.text.includes('Attack number 8'));
    expect(band).toBeGreaterThanOrEqual(0);
    expect(last).toBe(band);
  });
});

describe('US-030 AC-23 the example compiles cleanly', () => {
  it('US-030 AC-23: no Typst diagnostics for the example', async () => {
    const {diagnostics, facts} = await compileUS030(FEN_HARE);
    expect(facts).toHaveLength(1);
    expect(diagnostics).toEqual([]);
    expect(FEN_HARE_YAML.length).toBeGreaterThan(0);
  });
});
