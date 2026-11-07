// US-032 AC-1 to AC-8, AC-10, AC-11 — fit in the PDF: the automatic choice
// by orientation and measured fit, shrinking in 5 % steps down to
// entries.image.minScale (and only that setting), overflow and the moved
// partner, full-image never shrunk, the "(continued)" line in the header, and
// measuring candidates without recording them.
// Source of truth: docs/user-stories/US-032-entry-fit-overflow-and-auto-layout.md.
// Red until US-032 is implemented (G2, 2026-11-06).
import {afterAll, describe, expect, it} from 'vitest';
import {filler} from '../support/book';
import {ENTRIES, entry} from '../support/entries';
import {
  compileEntries,
  disposeEntriesCompiler,
  type CompiledEntries,
} from '../support/entries-pdf';
import {png} from '../support/images';

afterAll(disposeEntriesCompiler);

const LEDE = [
  'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
];
const IMAGES = {
  'Sample/assets/e-wide.png': png(300, 200),
  'Sample/assets/e-square.png': png(200, 200),
  'Sample/assets/e-tall.png': png(100, 200),
};

function e(
  name: string,
  layout: string,
  paragraphs: number,
  image?: string,
): string {
  const yaml = ['might: 4', `layout: ${layout}`];
  if (image !== undefined) yaml.push(`illustration: "![](assets/${image})"`);
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

function compile(
  source: string,
  minScale = 70,
  over: Record<string, unknown> = {},
): Promise<CompiledEntries> {
  return compileEntries(source, {
    over: {
      headingRules: {Menagerie: 'entries'},
      entries: {...ENTRIES, image: {minScale}},
      ...over,
    },
    images: IMAGES,
  });
}
const place = (c: CompiledEntries, heading: string) => {
  const p = c.places.find((x) => x.heading === heading);
  if (p === undefined) throw new Error(`no <o2t-entry> for ${heading}`);
  return p;
};
const end = (c: CompiledEntries, heading: string) => {
  const x = c.ends.find((y) => y.heading === heading);
  if (x === undefined) throw new Error(`no <o2t-entry-end> for ${heading}`);
  return x;
};

describe('US-032 AC-2 the automatic choice', () => {
  const rows: [string, string | undefined, number, string][] = [
    ['None Short', undefined, 2, 'page-text'],
    ['None Long', undefined, 14, 'spread-text'],
    ['Wide Short', 'e-wide.png', 1, 'page-landscape'],
    ['Wide Long', 'e-wide.png', 14, 'spread-landscape'],
    ['Square Short', 'e-square.png', 1, 'page-landscape'],
    ['Tall Short', 'e-tall.png', 1, 'page-portrait'],
    ['Tall Long', 'e-tall.png', 14, 'spread-portrait'],
  ];
  it('US-032 AC-2: the table by illustration and measured fit; full-image never chosen', async () => {
    const c = await compile(
      chapter(...rows.map(([n, img, paras]) => e(n, 'auto', paras, img))),
    );
    for (const [name, , , want] of rows) {
      expect(place(c, name), name).toMatchObject({layout: want, auto: true});
    }
    expect(c.places.map((p) => p.layout)).not.toContain('full-image');
  });

  it('US-032 AC-2: a set layout is not reported as automatic', async () => {
    const c = await compile(chapter(e('Set One', 'page-text', 2)));
    expect(place(c, 'Set One').auto ?? false).toBe(false);
  });
});

describe('US-032 AC-1 and AC-4 fit and shrink', () => {
  it('US-032 AC-4: across lengths, every scale is a 5 % step ≥ minScale; a shrunk entry fits one page; an entry at minScale that overflows is the only kind that runs on', async () => {
    const names = Array.from({length: 9}, (_, i) => `Sq ${i}`);
    const c = await compile(
      chapter(
        ...names.map((n, i) => e(n, 'page-landscape', 3 + i, 'e-square.png')),
      ),
      10,
    );
    let shrunk = 0;
    for (const n of names) {
      const p = place(c, n);
      const x = end(c, n);
      expect(p.scale, n).toBeDefined();
      const scale = p.scale ?? 0;
      expect(scale % 5, n).toBe(0);
      expect(scale, n).toBeGreaterThanOrEqual(10);
      if (scale < 100 && scale > 10) {
        shrunk++;
        expect(x.page, `${n} shrunk to ${scale} must fit`).toBe(p.page);
      }
      if (x.page > p.page)
        expect(scale, `${n} overflows only at minScale`).toBe(10);
    }
    expect(shrunk, 'at least one entry fits only by shrinking').toBeGreaterThan(
      0,
    );
  });

  it('US-032 AC-4: minScale 100 never shrinks', async () => {
    const names = Array.from({length: 5}, (_, i) => `Sq ${i}`);
    const c = await compile(
      chapter(
        ...names.map((n, i) => e(n, 'page-landscape', 4 + i, 'e-square.png')),
      ),
      100,
    );
    expect(names.map((n) => place(c, n).scale)).toEqual(names.map(() => 100));
  });

  it('US-032 AC-1: images.minScale applies outside entries only; entries.image.minScale inside only', async () => {
    const source = chapter(
      ...Array.from({length: 6}, (_, i) =>
        e(`Sq ${i}`, 'page-landscape', 4 + i, 'e-square.png'),
      ),
    );
    const c = await compile(source, 90, {images: {minScale: 10}});
    expect(c.places).toHaveLength(6);
    for (const p of c.places)
      expect(p.scale ?? 0, p.heading).toBeGreaterThanOrEqual(90);
  });
});

describe('US-032 AC-5 to AC-8 overflow', () => {
  it('US-032 AC-5: a text-only page entry that does not fit runs on; overflowLines counts the lines', async () => {
    const c = await compile(chapter(e('Wordy', 'page-text', 16)));
    const p = place(c, 'Wordy');
    const x = end(c, 'Wordy');
    expect(x.page).toBeGreaterThan(p.page);
    expect(x.overflowLines ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('US-032 AC-6: full-image is never shrunk; its text runs on after the image page', async () => {
    const c = await compile(
      chapter(e('Bog Wight', 'full-image', 16, 'e-wide.png')),
    );
    const p = place(c, 'Bog Wight');
    expect(p.scale ?? 100).toBe(100);
    const x = end(c, 'Bog Wight');
    expect(x.page).toBeGreaterThanOrEqual(p.page + 2);
    expect(c.pages[p.page]?.images).toHaveLength(1);
    expect(x.overflowLines ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('US-032 AC-7: an overflowing first of a pair moves its partner to the next left page', async () => {
    const c = await compile(
      chapter(e('Fen Hare', 'page-text', 16), e('Marsh Owl', 'page-text', 2)),
    );
    const hare = end(c, 'Fen Hare');
    expect(hare.partnerMoved).toBe('Marsh Owl');
    const owl = place(c, 'Marsh Owl');
    expect(owl.page % 2).toBe(0);
    expect(owl.page).toBeGreaterThan(hare.page);
  });

  it('US-032 AC-8 (decision 1): each overflow page shows "<name> (continued)" in its header, no other page does', async () => {
    const c = await compile(
      chapter(e('Wordy', 'page-text', 16), e('Next One', 'page-text', 2)),
    );
    const p = place(c, 'Wordy');
    const x = end(c, 'Wordy');
    for (let n = 1; n <= c.pages.length; n++) {
      const header = c.pages[n - 1]?.header ?? '';
      const overflow = n > p.page && n <= x.page;
      expect(header.includes('Wordy (continued)'), `page ${n}`).toBe(overflow);
    }
    expect(c.bookmarks.some((b) => b.title.includes('(continued)'))).toBe(
      false,
    );
  });
});

describe('US-032 AC-10 measuring candidates records nothing', () => {
  it('US-032 AC-10 (SCAR-038): one <o2t-entry>, one <o2t-entry-end> and one statblock per entry', async () => {
    const names = ['A1', 'A2', 'A3'];
    const c = await compile(
      chapter(...names.map((n, i) => e(n, 'auto', 2 + i * 6, 'e-wide.png'))),
    );
    expect(c.places.map((p) => p.heading)).toEqual(names);
    expect(c.ends.map((x) => x.heading)).toEqual(names);
    expect(c.statblocks.map((s) => s.band)).toEqual(names);
  });
});

describe('US-032 AC-11 composed cases', () => {
  it('US-032 AC-11: facing pages off — overflow pages follow directly, no blank page', async () => {
    const c = await compileEntries(
      chapter(e('Wordy', 'page-text', 16), e('Next One', 'page-text', 2)),
      {
        over: {headingRules: {Menagerie: 'entries'}},
        images: IMAGES,
        book: {facingPages: false},
      },
    );
    expect(place(c, 'Next One').page).toBe(end(c, 'Wordy').page + 1);
  });

  it('US-032 AC-11: a nested entry is measured with its parent and has no facts of its own placed as page', async () => {
    const parent = entry(
      '### Fen Hare',
      ['might: 4', 'layout: auto'],
      [...LEDE, '', filler(2, 'P')],
    );
    const nested = entry('#### Fen Kit', ['might: 1'], ['A small one.']);
    const c = await compile(chapter([parent, '', nested].join('\n')));
    expect(
      c.places.find((p) => p.heading === 'Fen Kit')?.size ?? 'inline',
    ).toBe('inline');
    expect(place(c, 'Fen Hare').size).toBe('page');
  });
});
