// US-030 AC-16, AC-16a, AC-16b, AC-17, AC-23 (amendment for #139) — the text
// wraps around the statblock: blocks fill the column beside it while they
// fit, the first paragraph that does not is split at a word, the rest runs
// at full width below, nothing is lost or doubled. Read from the PDF (the
// words in order, the first full-width line) and from the `<o2t-wrap>`
// facts (tests/support/entries-pdf.ts).
// Source of truth: docs/user-stories/US-030-entry-data-and-statblock.md.
// Red until #139's wrap is implemented (G2, 2026-11-09).
import {afterAll, describe, expect, it} from 'vitest';
import {openPdf} from '../../src/core/pdf/reader';
import {pageRuns, type TextRun} from '../../src/core/pdf/text';
import {filler} from '../support/book';
import {A5_PRINT} from '../support/convert';
import {ENTRIES, entry} from '../support/entries';
import {
  compileEntries,
  disposeEntriesCompiler,
  inOrder,
  type CompiledEntries,
} from '../support/entries-pdf';
import {png} from '../support/images';

afterAll(disposeEntriesCompiler);

// SCAR-030: a compile of a few pages takes 0.3 to 2 s in the full run.
const SLOW = 30_000;

/** `n` distinct short words `<p>0 … <p>(n-1)` (never hyphenated). */
const words = (n: number, p = 'k'): string =>
  Array.from({length: n}, (_, i) => `${p}${i}`).join(' ');

/** A statblock of `attacks` attack lines (its height grows with them). */
const yaml = (attacks: number, extra: string[] = []): string[] => [
  'vigour: 11',
  'might: 4',
  'wits: 2',
  'attacks:',
  ...Array.from({length: attacks}, (_, i) => `  - "Strike ${i}: 1d6"`),
  ...extra,
];

const compile = (
  source: string,
  over: Record<string, unknown> = {},
  images: Record<string, Uint8Array> = {},
): Promise<CompiledEntries> =>
  compileEntries(source, {over: {entries: ENTRIES, ...over}, images});

/** Every word `<p>i` printed exactly once, in order. */
function allOnceInOrder(c: CompiledEntries, n: number, p = 'k'): void {
  const text = c.pages.map((x) => x.text).join(' ');
  let last = -1;
  for (let i = 0; i < n; i++) {
    const re = new RegExp(`(?<![\\w])${p}${i}(?![\\w])`, 'g');
    const hits = [...text.matchAll(re)];
    expect(hits.length, `${p}${i} printed once`).toBe(1);
    const at = hits[0]?.index ?? -1;
    expect(at, `${p}${i} after ${p}${i - 1}`).toBeGreaterThan(last);
    last = at;
  }
}

/** The body runs of a 1-based page (no header or footer). */
function runs(c: CompiledEntries, page: number): TextRun[] {
  return (pageRuns(openPdf(c.pdf))[page - 1] ?? []).filter((r) => !r.furniture);
}
const text = (r: TextRun): string =>
  r.items.map((i) => ('ch' in i ? i.ch : '')).join('');
const MM = 72 / 25.4;

/**
 * SCAR-028 (found at G2): the PDF's text holds glyphs drawn below the page
 * too, so "printed" also means "inside the text area": no body glyph's
 * baseline lies below the text area's foot (PDF y from the page's bottom).
 */
function noTextBelowFoot(c: CompiledEntries): void {
  const foot = A5_PRINT.margins.bottom * MM;
  pageRuns(openPdf(c.pdf)).forEach((page, i) => {
    for (const r of page.filter((x) => !x.furniture))
      expect(
        r.y,
        `page ${i + 1}: "${text(r).slice(0, 20)}"`,
      ).toBeGreaterThanOrEqual(foot - 2);
  });
}

describe('US-030 AC-16a a long paragraph is split at the statblock', () => {
  it(
    'US-030 AC-16a: 150 words beside a short statblock: split, every word once and in order, the rest at full width from the left edge',
    async () => {
      const c = await compile(entry('### Fen Hare', yaml(2), [words(150)]));
      const w = c.wraps[0];
      expect(w, 'one <o2t-wrap> fact').toBeDefined();
      expect(w?.split?.block).toBe(0);
      expect(w?.split?.of).toBe(150);
      const cut = w?.split?.words ?? 0;
      expect(cut).toBeGreaterThan(0);
      expect(cut).toBeLessThan(150);
      expect(w?.column ?? Infinity).toBeLessThanOrEqual(
        (w?.statblock ?? 0) + 0.01,
      );
      allOnceInOrder(c, 150);
      // The first full-width line starts with the word after the cut, at
      // the page's left text edge (the leftmost body run), not indented.
      const page = runs(c, w?.page ?? 1);
      const left = Math.min(...page.map((r) => r.x0));
      const first = page.find((r) => text(r).startsWith(`k${cut}`));
      expect(first, `a run starting with k${cut}`).toBeDefined();
      expect(first?.x0 ?? 0).toBeCloseTo(left, 0);
      // It is below the statblock (PDF y grows upwards).
      const pageH = c.pages[(w?.page ?? 1) - 1]?.height ?? 0;
      const sbBottom = pageH - ((w?.y ?? 0) + (w?.statblock ?? 0)) * MM;
      expect(first?.y ?? Infinity).toBeLessThan(sbBottom);
    },
    SLOW,
  );

  it(
    'US-030 AC-16a, AC-17: a first paragraph of 400 words beside a statblock: every word is printed (before #139 the words below the page foot were lost)',
    async () => {
      const c = await compile(entry('### Fen Hare', yaml(1), [words(400)]));
      allOnceInOrder(c, 400);
      noTextBelowFoot(c);
      expect(c.wraps[0]?.split?.words ?? 0).toBeGreaterThan(0);
    },
    SLOW,
  );

  it(
    'US-030 AC-16a (G0 answer 2): no minimum of lines — a paragraph whose first word alone fits is split, one whose first word does not goes below whole',
    async () => {
      // A statblock taller than a short first paragraph: the next paragraph
      // is split however few of its words fit.
      const c = await compile(
        entry('### Fen Hare', yaml(4), [words(12, 'a'), '', words(120, 'b')]),
      );
      const w = c.wraps[0];
      expect(w?.beside).toBe(1);
      expect(w?.split?.block).toBe(1);
      allOnceInOrder(c, 12, 'a');
      allOnceInOrder(c, 120, 'b');
    },
    SLOW,
  );
});

describe('US-030 AC-16a blocks that fit go beside, the others below', () => {
  it(
    'US-030 AC-16a: a short paragraph and a list fill the column, the next paragraph is split',
    async () => {
      const c = await compile(
        entry('### Fen Hare', yaml(6), [
          words(12, 'a'),
          '',
          '- one',
          '- two',
          '- three',
          '- four',
          '',
          words(80, 'b'),
        ]),
      );
      const w = c.wraps[0];
      expect(w?.beside).toBe(2);
      expect(w?.split?.block).toBe(2);
    },
    SLOW,
  );

  it(
    'US-030 AC-16a (G0 answer 1): an image first, taller than the room beside the statblock, goes full width below; the column stays empty',
    async () => {
      const c = await compile(
        entry('### Fen Hare', yaml(1), ['![](assets/tall.png)', '', words(40)]),
        {},
        {'Sample/assets/tall.png': png(100, 400)},
      );
      const w = c.wraps[0];
      expect(w?.beside).toBe(0);
      expect(w?.split).toBeNull();
      expect(w?.column ?? -1).toBe(0);
      allOnceInOrder(c, 40);
    },
    SLOW,
  );

  it(
    'US-030 AC-16a (decision 5): a list that does not fit whole is not split; it starts the full-width part',
    async () => {
      const items = Array.from({length: 14}, (_, i) => `- item${i}`);
      const c = await compile(
        entry('### Fen Hare', yaml(1), [words(30, 'a'), '', ...items]),
      );
      const w = c.wraps[0];
      expect(w?.beside).toBe(1);
      expect(w?.split).toBeNull();
      allOnceInOrder(c, 14, 'item');
    },
    SLOW,
  );

  it(
    'US-030 AC-16a: a statblock taller than all of the text: every block beside it, nothing split',
    async () => {
      const c = await compile(
        entry('### Fen Hare', yaml(12), [words(10, 'a'), '', words(8, 'b')]),
      );
      const w = c.wraps[0];
      expect(w?.beside).toBe(2);
      expect(w?.split).toBeNull();
      expect(w?.column ?? Infinity).toBeLessThan(w?.statblock ?? 0);
    },
    SLOW,
  );
});

describe('US-030 AC-16a sub-headings', () => {
  it(
    'US-030 AC-16a (G0 answer 4): a sub-heading goes beside only with two lines of what follows; else it starts the full-width part',
    async () => {
      // Sweep the first paragraph's length so the sub-heading meets the
      // column's foot: whenever it is beside, the paragraph after it is
      // beside or split with at least two lines' worth of words in the
      // column; whenever it is not, the column ends before it.
      let beside = 0;
      let below = 0;
      for (const n of [10, 20, 30, 40, 50, 60]) {
        const c = await compile(
          entry('### Fen Hare', yaml(3), [
            words(n, 'a'),
            '',
            '#### Habits',
            '',
            words(60, 'b'),
          ]),
        );
        const w = c.wraps[0];
        if (w === undefined) throw new Error('no <o2t-wrap>');
        if (w.beside >= 2) {
          beside++;
          // The heading (block 1) is beside: block 2 is beside whole, or
          // split with >= 2 lines in the column (a 43 mm column holds at
          // least 4 such words a line); never the heading alone at the
          // column's foot (G4 of #140: a mutant that always set the heading
          // beside survived the weaker check).
          if (w.beside === 2) {
            expect(w.split?.block, `n=${n}`).toBe(2);
            expect(w.split?.words ?? 0, `n=${n}`).toBeGreaterThanOrEqual(8);
          }
        } else {
          below++;
          expect(w.split === null || w.split.block === 0).toBe(true);
        }
        allOnceInOrder(c, 60, 'b');
      }
      // SCAR-023: both branches were reached.
      expect(beside).toBeGreaterThan(0);
      expect(below).toBeGreaterThan(0);
    },
    SLOW * 4,
  );
});

describe('US-030 AC-16b where the wrap reaches', () => {
  it(
    'US-030 AC-16b, AC-20: a nested entry is never set in the column',
    async () => {
      // A statblock tall enough that the nested entry would fit beside it
      // (G4 of #140: with a shorter one a mutant that let it in survived).
      const source = [
        entry('### Fen Hare', yaml(24), [words(10, 'a')]),
        '',
        entry('#### Hare Kit', ['might: 1'], [words(10, 'c')]),
      ].join('\n');
      // Outside a chapter the converter ends the blocks before the nested
      // entry; in a chapter the layout's wrap meets it and must stop.
      for (const chapter of [false, true]) {
        const c = await compile(
          chapter ? `# Menagerie\n\n${source}` : source,
          chapter ? {headingRules: {Menagerie: 'entries'}} : {},
        );
        const outer = c.wraps.find((w) => w.band === 'Fen Hare');
        expect(outer?.beside, `chapter ${chapter}`).toBe(1);
        expect(c.wraps.some((w) => w.band === 'Hare Kit')).toBe(true);
      }
    },
    SLOW,
  );

  it(
    'US-030 AC-16b (G0 answer 5): an entry in an entries chapter wraps as one outside it',
    async () => {
      const body = [words(150)];
      const inside = await compile(
        ['# Menagerie', '', entry('### Fen Hare', yaml(2), body)].join('\n'),
        {headingRules: {Menagerie: 'entries'}},
      );
      const outside = await compile(entry('### Fen Hare', yaml(2), body));
      expect(inside.wraps[0]?.split?.words).toBeGreaterThan(0);
      expect(inside.wraps[0]?.split?.words).toBe(
        outside.wraps[0]?.split?.words,
      );
      allOnceInOrder(inside, 150);
    },
    SLOW,
  );

  it(
    'US-030 AC-16b: outside a chapter, a heading with a US-025 page break ends the wrap; its text starts on a new page',
    async () => {
      const source = [
        entry('### Fen Hare', yaml(8), [
          words(10, 'a'),
          '',
          '#### Habits',
          '',
          words(10, 'b'),
        ]),
      ].join('\n');
      const c = await compile(source, {breakBefore: {h4: 'page'}});
      expect(c.wraps[0]?.beside).toBe(1);
      const aPage = c.pages.findIndex((p) => p.text.includes('a0'));
      const bPage = c.pages.findIndex((p) => p.text.includes('b0'));
      expect(bPage).toBe(aPage + 1);
    },
    SLOW,
  );
});

describe('US-030 AC-16a with other stories (SCAR-002)', () => {
  const REAL = [
    'Fen hares are *quick* and **shy**; see [[#Habits]] and the note[^1] — they flee at the first "sound" of a #tag, a $5 coin, an @name or a `code` span. ' +
      filler(1, 'Reeds'),
    '',
    words(60, 'r'),
    '',
    '#### Habits',
    '',
    'They gather at dusk.',
    '',
    '[^1]: A footnote of the hare.',
  ];
  for (const pageNumbers of [false, true]) {
    it(
      `US-030 AC-16a: the converter's real paragraph through the split, linkPageNumbers ${pageNumbers}: every word once, in order`,
      async () => {
        const c = await compile(entry('### Fen Hare', yaml(2), REAL), {
          linkPageNumbers: pageNumbers,
        });
        expect(c.diagnostics.filter((d) => /error/i.test(d))).toEqual([]);
        allOnceInOrder(c, 60, 'r');
        const all = c.pages.map((p) => p.text).join(' ');
        expect(
          inOrder(all, [
            'quick',
            'shy',
            'Habits',
            'flee',
            'sound',
            '$5',
            '@name',
            'code',
          ]),
        ).toBe(true);
        expect(c.wraps[0]).toBeDefined();
      },
      SLOW,
    );
  }

  it(
    'US-030 AC-16a, US-023: a template that justifies and indents: the column is filled, the continuation below is not indented',
    async () => {
      const c = await compileEntries(
        entry('### Fen Hare', yaml(2), [words(150)]),
        {
          over: {entries: ENTRIES, template: true, templateHook: true},
          files: {
            'template.typ': new TextEncoder().encode(
              '#let template(body) = { set par(justify: true, first-line-indent: (amount: 1.5em, all: true)); body }\n',
            ),
          },
        },
      );
      const w = c.wraps[0];
      const cut = w?.split?.words ?? 0;
      expect(cut).toBeGreaterThan(0);
      const page = runs(c, w?.page ?? 1);
      const left = Math.min(...page.map((r) => r.x0));
      const first = page.find((r) => text(r).startsWith(`k${cut}`));
      expect(first?.x0 ?? 0).toBeCloseTo(left, 0);
      allOnceInOrder(c, 150);
    },
    SLOW,
  );
});
