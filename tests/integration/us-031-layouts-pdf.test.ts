// US-031 AC-4 to AC-12, AC-14 to AC-17 — the entry layouts in the PDF: the
// left-page start and blank pages, the four spread and three page layouts,
// fitted illustrations and captions, pairing, sub-headings and lists inside
// entries, one-compile placement, presets without facing pages, composed
// cases. Placement is read from the `<o2t-entry>` and `<o2t-entry-end>`
// metadata (tests/support/entries-pdf.ts) and from the pages.
// Source of truth: docs/user-stories/US-031-entry-layouts-on-facing-pages.md.
// Red until US-031 is implemented (G2, 2026-11-06).
import {afterAll, describe, expect, it} from 'vitest';
import {filler, isBlank} from '../support/book';
import {A5_PRINT} from '../support/convert';
import {entry} from '../support/entries';
import {
  compileEntries,
  disposeEntriesCompiler,
  type CompiledEntries,
} from '../support/entries-pdf';
import {png} from '../support/images';

afterAll(disposeEntriesCompiler);

const RULES = {headingRules: {Menagerie: 'entries'}};
const LEDE = [
  'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
];
const pt = (mm: number): number => (mm * 72) / 25.4;

/** The text area of the test preset (A5 print), in mm. */
const TEXT_W =
  A5_PRINT.pageWidth - A5_PRINT.margins.inside - A5_PRINT.margins.outside;
const TEXT_H =
  A5_PRINT.pageHeight - A5_PRINT.margins.top - A5_PRINT.margins.bottom;

/** Illustrations by vault path (1 px = 1 pt): width : height. */
const IMAGES = {
  'Sample/assets/e-wide.png': png(300, 200), // 3:2
  'Sample/assets/e-square.png': png(200, 200), // 1:1
  'Sample/assets/e-tall.png': png(100, 200), // 1:2
  'Sample/assets/e-slim.png': png(50, 200), // 1:4
  'Sample/assets/e-long.png': png(400, 100), // 4:1
};

/** An entry with `layout`, an optional illustration and `paragraphs` of filler. */
function e(
  name: string,
  layout: string,
  paragraphs: number,
  image?: string,
  credit = '',
): string {
  const yaml = ['might: 4', `layout: ${layout}`];
  if (image !== undefined)
    yaml.push(`illustration: "![${credit}](assets/${image})"`);
  return entry(`### ${name}`, yaml, [...LEDE, '', filler(paragraphs, name)]);
}

const chapter = (...entries: string[]): string =>
  [
    '# Menagerie',
    '',
    '## Beasts',
    '',
    'Beasts intro.',
    '',
    ...entries.flatMap((x) => [x, '']),
  ].join('\n');

const compile = (
  source: string,
  over: Record<string, unknown> = {},
  facing = true,
): Promise<CompiledEntries> =>
  compileEntries(source, {
    over: {...RULES, ...over},
    images: IMAGES,
    book: {facingPages: facing},
  });

const place = (c: CompiledEntries, heading: string) => {
  const p = c.places.find((x) => x.heading === heading);
  if (p === undefined) throw new Error(`no <o2t-entry> for ${heading}`);
  return p;
};
const end = (c: CompiledEntries, heading: string): number =>
  c.ends.find((x) => x.heading === heading)?.page ?? -1;

describe('US-031 AC-4 layouts the entry cannot support', () => {
  it('US-031 AC-4: full-image without an illustration → the auto choice, with asked and reason', async () => {
    const c = await compile(chapter(e('Bog Wight', 'full-image', 2)));
    expect(place(c, 'Bog Wight')).toMatchObject({
      layout: 'page-text',
      asked: 'full-image',
      reason: 'no illustration',
    });
  });

  it('US-031 AC-4: orientation conflicts; width = height counts as landscape', async () => {
    const c = await compile(
      chapter(
        e('Tall One', 'page-landscape', 2, 'e-tall.png'),
        e('Wide One', 'page-portrait', 2, 'e-wide.png'),
        e('Square One', 'page-landscape', 2, 'e-square.png'),
      ),
    );
    expect(place(c, 'Tall One')).toMatchObject({
      asked: 'page-landscape',
      reason: 'image is portrait',
    });
    expect(place(c, 'Wide One')).toMatchObject({
      asked: 'page-portrait',
      reason: 'image is landscape',
    });
    expect(place(c, 'Square One').asked).toBeUndefined();
    expect(place(c, 'Square One').layout).toBe('page-landscape');
  });
});

describe('US-031 AC-5 and AC-6 spread-sized entries', () => {
  it('US-031 AC-5: a spread starts on a left (even) page; the added page shows the folio only', async () => {
    const c = await compile(
      chapter(e('Fen Hare', 'page-text', 2), e('Cave Wyrm', 'spread-text', 14)),
    );
    const wyrm = place(c, 'Cave Wyrm');
    expect(wyrm.size).toBe('spread');
    expect(wyrm.page % 2).toBe(0);
    for (let p = end(c, 'Fen Hare') + 1; p < wyrm.page; p++) {
      expect(isBlank(c.pages[p - 1]), `page ${p}`).toBe(true);
      expect(c.pages[p - 1]?.footer, `page ${p}`).not.toBe('');
    }
  });

  it('US-031 AC-6: full-image — the right page has one image, no header and no folio', async () => {
    const c = await compile(
      chapter(e('Bog Wight', 'full-image', 2, 'e-wide.png')),
    );
    const p = place(c, 'Bog Wight');
    expect(p.page % 2).toBe(0);
    const right = c.pages[p.page];
    expect(right?.images).toHaveLength(1);
    expect(right?.header.trim()).toBe('');
    expect(right?.footer).toBe('');
    expect(right?.text.trim()).toBe('');
  });

  it('US-031 AC-6: entries.fullImageHeader true keeps header and folio', async () => {
    const c = await compile(
      chapter(e('Bog Wight', 'full-image', 2, 'e-wide.png')),
      {
        entries: {
          ...(await import('../support/entries')).ENTRIES,
          fullImageHeader: true,
        },
      },
    );
    expect(c.pages[place(c, 'Bog Wight').page]?.footer).not.toBe('');
  });

  it('US-031 AC-6 and AC-7: spread-landscape — a 3:2 image at text width on the right page, at most half the text height', async () => {
    const c = await compile(
      chapter(e('Cave Wyrm', 'spread-landscape', 10, 'e-wide.png')),
    );
    const right = c.pages[place(c, 'Cave Wyrm').page];
    const img = right?.images[0];
    expect(img?.width).toBeCloseTo(pt(TEXT_W), 0);
    expect(img?.height).toBeCloseTo(pt((TEXT_W * 2) / 3), 0);
    expect(img?.height ?? Infinity).toBeLessThanOrEqual(pt(TEXT_H / 2) + 1);
  });

  it('US-031 AC-6 and AC-7: spread-portrait — 1:2 width-limited, 1:4 height-limited, on the outer (right) edge', async () => {
    const c = await compile(
      chapter(
        e('Reed Cat', 'spread-portrait', 10, 'e-tall.png'),
        e('Reed Eel', 'spread-portrait', 10, 'e-slim.png'),
      ),
    );
    const cat = c.pages[place(c, 'Reed Cat').page]?.images[0];
    expect(cat?.width).toBeCloseTo(pt(TEXT_W * 0.55), 0);
    expect(cat?.height).toBeCloseTo(pt(TEXT_W * 0.55 * 2), 0);
    const eel = c.pages[place(c, 'Reed Eel').page]?.images[0];
    expect(eel?.height).toBeCloseTo(pt(TEXT_H), 0);
    expect(eel?.width).toBeCloseTo(pt(TEXT_H / 4), 0);
    const pageW = c.pages[0]?.width ?? 0;
    expect((cat?.x ?? 0) + (cat?.width ?? 0) / 2).toBeGreaterThan(pageW / 2);
  });
});

describe('US-031 AC-7 captions', () => {
  it('US-031 AC-7 (decision 2): the credit is a caption under the image; no credit, no caption', async () => {
    const withCredit = await compile(
      chapter(
        e('Marsh Owl', 'page-landscape', 2, 'e-wide.png', 'Drawn by A. Nobody'),
      ),
    );
    const p = withCredit.pages[place(withCredit, 'Marsh Owl').page - 1];
    expect(p?.text).toContain('Drawn by A. Nobody');
    const without = await compile(
      chapter(e('Marsh Owl', 'page-landscape', 2, 'e-wide.png')),
    );
    expect(without.pages.map((x) => x.text).join(' ')).not.toContain(
      'Drawn by',
    );
    expect(place(without, 'Marsh Owl').layout).toBe('page-landscape');
  });

  it('US-031 AC-7: page-landscape — a 4:1 image at text width, a 1:1 image at most 40 % of the text height', async () => {
    const c = await compile(
      chapter(
        e('Long One', 'page-landscape', 1, 'e-long.png'),
        e('Square One', 'page-landscape', 1, 'e-square.png'),
      ),
    );
    const long = c.pages[place(c, 'Long One').page - 1]?.images[0];
    expect(long?.width).toBeCloseTo(pt(TEXT_W), 0);
    const square = c.pages[place(c, 'Square One').page - 1]?.images[0];
    expect(square?.height).toBeCloseTo(pt(TEXT_H * 0.4), 0);
  });
});

describe('US-031 AC-8 to AC-10 page-sized entries', () => {
  it('US-031 AC-8: page, page, spread, page → left, right, a spread, then a left page', async () => {
    const c = await compile(
      chapter(
        e('Fen Hare', 'page-text', 2),
        e('Marsh Owl', 'page-landscape', 1, 'e-wide.png'),
        e('Cave Wyrm', 'spread-landscape', 10, 'e-wide.png'),
        e('Reed Cat', 'page-portrait', 1, 'e-tall.png'),
      ),
    );
    const hare = place(c, 'Fen Hare');
    const owl = place(c, 'Marsh Owl');
    const wyrm = place(c, 'Cave Wyrm');
    const cat = place(c, 'Reed Cat');
    expect(hare.page % 2).toBe(0);
    expect(owl.page).toBe(hare.page + 1);
    expect(wyrm.page).toBe(owl.page + 1);
    expect(cat.page).toBe(wyrm.page + 2);
    expect([hare, owl, cat].map((x) => x.size)).toEqual([
      'page',
      'page',
      'page',
    ]);
    expect(end(c, 'Fen Hare')).toBe(hare.page);
  });

  it('US-031 AC-9: page-portrait — the image on the outer edge: left on a left page, right on a right page', async () => {
    const c = await compile(
      chapter(
        e('Left Cat', 'page-portrait', 1, 'e-tall.png'),
        e('Right Cat', 'page-portrait', 1, 'e-tall.png'),
      ),
    );
    const w = c.pages[0]?.width ?? 0;
    const left = c.pages[place(c, 'Left Cat').page - 1]?.images[0];
    const right = c.pages[place(c, 'Right Cat').page - 1]?.images[0];
    expect((left?.x ?? w) + (left?.width ?? 0) / 2).toBeLessThan(w / 2);
    expect((right?.x ?? 0) + (right?.width ?? 0) / 2).toBeGreaterThan(w / 2);
  });

  it('US-031 AC-10: an unpaired page entry before a spread leaves its right page blank (folio only)', async () => {
    const c = await compile(
      chapter(e('Fen Hare', 'page-text', 2), e('Cave Wyrm', 'spread-text', 14)),
    );
    const hare = place(c, 'Fen Hare');
    expect(hare.page % 2).toBe(0);
    const right = c.pages[hare.page];
    expect(isBlank(right)).toBe(true);
    expect(right?.footer).not.toBe('');
  });
});

describe('US-031 AC-11 and AC-12 inside an entry', () => {
  it('US-031 AC-11: sub-headings are not in the bookmarks and carry no number', async () => {
    const source = chapter(
      entry(
        '### Fen Hare',
        ['might: 4', 'layout: spread-text'],
        [...LEDE, '', '#### Habits', '', filler(3, 'H')],
      ),
    );
    const c = await compile(source);
    expect(c.bookmarks.some((b) => b.title.includes('Habits'))).toBe(false);
    expect(c.pages.map((p) => p.text).join(' ')).toMatch(/(^|\s)Habits/);
    // A heading number is dotted (`1.1.1.1 Habits`); G4 #127: a bare digit
    // before it is the statblock's `Might 4`, drawn right above.
    expect(c.pages.map((p) => p.text).join(' ')).not.toMatch(
      /\d+(\.\d+)+\s+Habits/,
    );
    expect(c.places).toHaveLength(1);
  });

  it('US-031 AC-11: with page.breakBefore h4: page, a sub-heading inside an entry breaks no page', async () => {
    const source = chapter(
      entry(
        '### Fen Hare',
        ['might: 4', 'layout: page-text'],
        [...LEDE, '', '#### Habits', '', 'They gather at dusk.'],
      ),
    );
    const c = await compile(source, {breakBefore: {h4: 'page'}});
    expect(end(c, 'Fen Hare')).toBe(place(c, 'Fen Hare').page);
  });

  it('US-031 AC-12: a 10-item list is never split; an 11-item list splits with at least 2 items on each side', async () => {
    const list = (n: number, w: string) =>
      Array.from(
        {length: n},
        (_, i) => `- ${w} item ${i + 1} with a few words`,
      ).join('\n');
    for (const [n, whole] of [
      [10, true],
      [11, false],
    ] as const) {
      const body = [...LEDE, '', filler(11, 'Pad'), '', list(n, `L${n}`)];
      const c = await compile(
        chapter(
          entry('### Fen Hare', ['might: 4', 'layout: spread-text'], body),
        ),
      );
      const pagesOf = Array.from({length: n}, (_, i) =>
        c.pages.findIndex((p) => p.text.includes(`L${n} item ${i + 1} `)),
      );
      expect(c.places).toHaveLength(1);
      if (whole) expect(new Set(pagesOf).size, `${n} items`).toBe(1);
      else {
        const first = pagesOf.filter((p) => p === pagesOf[0]).length;
        expect(first).toBeGreaterThanOrEqual(2);
        expect(n - first).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('US-031 AC-14 one compile', () => {
  it('US-031 AC-14: every entry records its place and end; the layout settles in one compile', async () => {
    const c = await compile(
      chapter(
        e('Fen Hare', 'page-text', 2),
        e('Cave Wyrm', 'spread-text', 14),
        e('Reed Cat', 'auto', 1),
      ),
    );
    expect(c.places.map((p) => p.heading)).toEqual([
      'Fen Hare',
      'Cave Wyrm',
      'Reed Cat',
    ]);
    expect(c.ends.map((x) => x.heading)).toEqual([
      'Fen Hare',
      'Cave Wyrm',
      'Reed Cat',
    ]);
    expect(c.diagnostics.filter((d) => d.includes('converge'))).toEqual([]);
  });

  it('US-031 AC-3 (decision 1): until US-032, auto is page-text when the entry fits one page, else spread-text', async () => {
    const c = await compile(
      chapter(e('Short', 'auto', 2), e('Long', 'auto', 14)),
    );
    expect(place(c, 'Short').layout).toBe('page-text');
    expect(place(c, 'Long').layout).toBe('spread-text');
  });
});

describe('US-031 AC-15 presets without facing pages', () => {
  it('US-031 AC-15: consecutive pages, no blank page, pairs still in order', async () => {
    const c = await compile(
      chapter(
        e('Fen Hare', 'page-text', 2),
        e('Cave Wyrm', 'spread-text', 14),
        e('Reed Cat', 'page-portrait', 1, 'e-tall.png'),
      ),
      {},
      false,
    );
    expect(place(c, 'Cave Wyrm').page).toBe(end(c, 'Fen Hare') + 1);
    expect(place(c, 'Reed Cat').page).toBe(end(c, 'Cave Wyrm') + 1);
    expect(c.pages.filter((p) => isBlank(p))).toHaveLength(0);
  });
});

describe('US-031 AC-16 composed cases', () => {
  it('US-031 AC-16: page.breakBefore h3: right does not add breaks to entry headings in the chapter', async () => {
    const source = chapter(
      e('Fen Hare', 'page-text', 2),
      e('Marsh Owl', 'page-text', 2),
    );
    const plain = await compile(source);
    const ruled = await compile(source, {breakBefore: {h3: 'right'}});
    expect(ruled.places.map((p) => p.page)).toEqual(
      plain.places.map((p) => p.page),
    );
    expect(plain.places).toHaveLength(2);
  });

  it('US-031 AC-2: an entry outside the chapter has size inline and no page of its own', async () => {
    const source = [
      chapter(e('Fen Hare', 'page-text', 2)),
      '# Example Crypt',
      '',
      'Crypt text.',
      '',
      e('Fen Hare', 'spread-text', 1),
    ].join('\n');
    const c = await compile(source);
    expect(c.places.map((p) => p.size)).toEqual(['page', 'inline']);
  });
});
