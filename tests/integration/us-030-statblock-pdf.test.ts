// US-030 AC-10, AC-12, AC-13, AC-15 to AC-17, AC-23 — the statblock in the
// PDF: its text in order, what the helper drew (boxes, rows, track cells, the
// parts) as recorded in `<o2t-statblock>` metadata, colours in colour and
// grayscale, the icons recoloured, and a tall statblock never split.
// Source of truth: docs/user-stories/US-030-entry-data-and-statblock.md.
// Red until US-030 is implemented (G2, 2026-11-06).
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {TypstSnippet} from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import {loadFonts} from '@myriaddreamin/typst.ts/dist/esm/options.init.mjs';
import {afterAll, describe, expect, it} from 'vitest';
import {convert, type ConvertSettings} from '../../src/core/convert';
import {BOOK_FONTS, bookSettings, compileSource} from '../support/book';
import {FakeIndex, NOTE_PATH} from '../support/convert';
import {
  ENTRIES,
  FEN_HARE,
  FEN_HARE_YAML,
  entry,
  type StatblockFact,
} from '../support/entries';
import {readPdfPages, type PdfPage} from '../support/pdf';

/** The five track icons at the preset's vault paths: simple shapes, #000. */
const ICONS: Record<string, string> = {
  'Icons/fine.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#000"/></svg>',
  'Icons/hurt.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="#000"/></svg>',
  'Icons/down.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M5 1L9 9H1z" fill="#000"/></svg>',
  'Icons/fading.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 4h8v2H1z" fill="#000"/></svg>',
  'Icons/gone.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9" stroke="#000"/></svg>',
};
const ICON_BYTES = Object.fromEntries(
  Object.entries(ICONS).map(([p, s]) => [p, new TextEncoder().encode(s)]),
);

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

interface Compiled {
  pages: PdfPage[];
  facts: StatblockFact[];
  diagnostics: string[];
}

let snippet: TypstSnippet | undefined;
afterAll(() => {
  snippet = undefined;
});
let count = 0;

/** Converts `source` with the entries settings, compiles it, reads PDF and facts. */
async function compileEntries(
  source: string,
  over: Record<string, unknown> = {},
): Promise<Compiled> {
  const index = new FakeIndex([NOTE_PATH, ...Object.keys(ICON_BYTES)]);
  for (const [path, bytes] of Object.entries(ICON_BYTES))
    index.images.set(path, bytes);
  const settings = {
    ...bookSettings(),
    entries: COLOUR,
    ...over,
  } as unknown as ConvertSettings;
  const result = await convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings,
    assets: index,
  });
  const files: Record<string, Uint8Array> = {...ICON_BYTES};
  for (const use of result.assets) {
    const bytes = ICON_BYTES[use.from];
    if (bytes !== undefined) files[use.to] = bytes;
  }
  const pdf = await compileSource(result.typ, files);
  if (snippet === undefined) {
    snippet = new TypstSnippet();
    snippet.setCompilerInitOptions({
      getModule: () =>
        readFileSync(
          join(
            process.cwd(),
            'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
          ),
        ),
      beforeBuild: [loadFonts([...BOOK_FONTS], {assets: false})],
    });
  }
  for (const [name, data] of Object.entries(files))
    await snippet.mapShadow(`/${name}`, data);
  const path = `/us030-${count++}.typ`;
  await snippet.addSource(path, result.typ);
  const compiler = (await snippet.getCompiler()) as unknown as {
    runWithWorld<T>(
      o: {mainFilePath: string},
      cb: (w: {
        compile(o: {diagnostics: 'unix'}): Promise<{diagnostics?: string[]}>;
        query(o: {selector: string; field: string}): Promise<unknown>;
      }) => Promise<T>,
    ): Promise<T>;
  };
  const [diagnostics, raw] = await compiler.runWithWorld(
    {mainFilePath: path},
    async (w) => [
      (await w.compile({diagnostics: 'unix'})).diagnostics ?? [],
      await w.query({selector: '<o2t-statblock>', field: 'value'}),
    ],
  );
  const facts = (
    typeof raw === 'string' ? JSON.parse(raw) : raw
  ) as StatblockFact[];
  return {
    pages: readPdfPages(pdf),
    facts,
    diagnostics: diagnostics as string[],
  };
}

/** True when `needles` occur in `text` in this order. */
function inOrder(text: string, needles: readonly string[]): boolean {
  let at = 0;
  for (const n of needles) {
    const i = text.indexOf(n, at);
    if (i < 0) return false;
    at = i + n.length;
  }
  return true;
}

const LEDE = [
  'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
];

describe('US-030 AC-10 the parts in order', () => {
  it('US-030 AC-10: the example statblock reads in the order of the story', async () => {
    const {pages, facts} = await compileEntries(FEN_HARE);
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
    const {facts, pages} = await compileEntries(FEN_HARE, {
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
      const {facts} = await compileEntries(
        entry('### A', ['might: 4', `vigour: ${value}`], LEDE),
      );
      expect(facts.map((f) => [f.boxes, f.rows])).toEqual([[boxes, lines]]);
    });
  }
});

describe('US-030 AC-13 the state track in the PDF', () => {
  it('US-030 AC-13: default, full in track order, none', async () => {
    const def = await compileEntries(entry('### A', ['might: 4'], LEDE));
    expect(def.facts[0]?.cells).toEqual(['Fine', 'Hurt', 'Down', 'Gone']);
    const full = await compileEntries(
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
    const none = await compileEntries(
      entry('### A', ['might: 4', 'states: none'], LEDE),
    );
    expect(none.facts[0]?.cells).toEqual([]);
    expect(none.facts[0]?.parts).not.toContain('track');
  });

  it('US-030 AC-13: the icons are recoloured to the frame colour', async () => {
    const {pages} = await compileEntries(FEN_HARE);
    expect(pages.flatMap((p) => p.fills)).toContain('#7a4a2e');
    expect(pages.flatMap((p) => p.fills)).not.toContain('#000000');
  });
});

describe('US-030 AC-15 look', () => {
  it('US-030 AC-15: colour — the statblock fill and the box fill are drawn', async () => {
    const fills = (await compileEntries(FEN_HARE)).pages.flatMap(
      (p) => p.fills,
    );
    expect(fills).toContain('#fbe2c5');
    expect(fills).toContain('#fefcf0');
  });

  it('US-030 AC-15 (G0-C7): grayscale — no fill, frame and icons #4d4d4d, boxes white', async () => {
    const fills = (
      await compileEntries(FEN_HARE, {colorMode: 'grayscale'})
    ).pages.flatMap((p) => p.fills);
    expect(fills).not.toContain('#fbe2c5');
    expect(fills).toContain('#4d4d4d');
    expect(fills).toContain('#ffffff');
  });
});

describe('US-030 AC-16 and AC-17 position and never split', () => {
  it('US-030 AC-16: the opening paragraph comes before the sub-heading, beside the statblock', async () => {
    const compiled = await compileEntries(FEN_HARE);
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
    const {pages, facts} = await compileEntries(source);
    expect(facts[0]?.rows).toBe(3);
    const band = pages.findIndex((p) => p.text.includes('Tall'));
    const last = pages.findIndex((p) => p.text.includes('Attack number 8'));
    expect(band).toBeGreaterThanOrEqual(0);
    expect(last).toBe(band);
  });
});

describe('US-030 AC-23 the example compiles cleanly', () => {
  it('US-030 AC-23: no Typst diagnostics for the example', async () => {
    const {diagnostics, facts} = await compileEntries(FEN_HARE);
    expect(facts).toHaveLength(1);
    expect(diagnostics).toEqual([]);
    expect(FEN_HARE_YAML.length).toBeGreaterThan(0);
  });
});
