// US-033 AC-1 to AC-11, AC-14, AC-15 — openers, navigation and the quick
// reference in the PDF: section and chapter openers on right pages, a free
// right page reused, long intros, facing pages off; every entry in the
// contents and the bookmarks kept; the section name in the running header;
// page numbers on links to entries; the quick reference's place, rows in the
// note's order, Track column and repeats.
// Source of truth: docs/user-stories/US-033-entry-openers-navigation-quick-reference.md.
// Red until US-033 is implemented (G2, 2026-11-06).
import {afterAll, describe, expect, it} from 'vitest';
import {filler, isBlank, pageOf} from '../support/book';
import {ENTRIES, entry} from '../support/entries';
import {
  compileEntries,
  disposeEntriesCompiler,
  inOrder,
  type CompiledEntries,
} from '../support/entries-pdf';
import {png} from '../support/images';

afterAll(disposeEntriesCompiler);

const LEDE = [
  'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
];
const IMAGES = {'Sample/assets/e-wide.png': png(300, 200)};

function e(
  name: string,
  layout: string,
  paragraphs: number,
  extra: string[] = [],
): string {
  return entry(
    `### ${name}`,
    ['might: 4', `layout: ${layout}`, ...extra],
    [...LEDE, '', filler(paragraphs, name)],
  );
}
const section = (name: string, intro: number, ...entries: string[]): string =>
  [
    `## ${name}`,
    '',
    filler(intro, `${name} intro`),
    '',
    ...entries.flatMap((x) => [x, '']),
  ].join('\n');
const chapter = (...sections: string[]): string =>
  ['# Menagerie', '', 'Chapter intro text.', '', ...sections].join('\n');

function compile(
  source: string,
  over: Record<string, unknown> = {},
  facing = true,
): Promise<CompiledEntries> {
  return compileEntries(source, {
    over: {headingRules: {Menagerie: 'entries'}, ...over},
    images: IMAGES,
    book: {facingPages: facing},
  });
}
const sec = (c: CompiledEntries, name: string) => {
  const s = c.sections.find((x) => x.section === name);
  if (s === undefined) throw new Error(`no <o2t-section> for ${name}`);
  return s;
};
const place = (c: CompiledEntries, heading: string) => {
  const p = c.places.find((x) => x.heading === heading);
  if (p === undefined) throw new Error(`no <o2t-entry> for ${heading}`);
  return p;
};

describe('US-033 AC-1 and AC-2 openers', () => {
  it('US-033 AC-1: a section opener on a right page, its first entry on the next left page', async () => {
    const c = await compile(
      chapter(
        section('Beasts', 1, e('Fen Hare', 'page-text', 2)),
        section('Horrors', 1, e('Bog Wight', 'page-text', 2)),
      ),
    );
    for (const [name, first] of [
      ['Beasts', 'Fen Hare'],
      ['Horrors', 'Bog Wight'],
    ] as const) {
      const s = sec(c, name);
      expect(s.page % 2, name).toBe(1);
      expect(place(c, first).page, name).toBe(s.introEnd + 1);
    }
  });

  it('US-033 AC-2: the chapter heading, its intro and the first section share one right page, also with h1: left', async () => {
    for (const rule of [undefined, 'left', 'none', 'page']) {
      const over = rule === undefined ? {} : {breakBefore: {h1: rule}};
      const c = await compile(
        chapter(section('Beasts', 1, e('Fen Hare', 'page-text', 2))),
        over,
      );
      const page = pageOf(c.pages, 'Chapter intro text');
      expect(page % 2, String(rule)).toBe(1);
      expect(sec(c, 'Beasts').page, String(rule)).toBe(page);
    }
  });

  it('US-033 AC-2 (decision 1): an entries chapter below H1 opens the same way', async () => {
    const source = [
      '# Players',
      '',
      'Text.',
      '',
      '## Menagerie',
      '',
      'Chapter intro text.',
      '',
      '### Beasts',
      '',
      'Beasts intro.',
      '',
      entry('#### Fen Hare', ['might: 4', 'layout: page-text'], LEDE),
    ].join('\n');
    const c = await compile(source, {breakBefore: {h2: 'none'}});
    expect(pageOf(c.pages, 'Chapter intro text') % 2).toBe(1);
    expect(sec(c, 'Beasts').page % 2).toBe(1);
  });
});

describe('US-033 AC-3 to AC-5 free pages, long intros, facing pages off', () => {
  it('US-033 AC-3: ending on a left page — the next opener on the facing right page; ending right — a blank left page between', async () => {
    const left = await compile(
      chapter(
        section('Beasts', 1, e('Reed Cat', 'page-text', 2)),
        section('Horrors', 1, e('Bog Wight', 'page-text', 2)),
      ),
    );
    expect(sec(left, 'Horrors').page).toBe(place(left, 'Reed Cat').page + 1);
    const right = await compile(
      chapter(
        section(
          'Beasts',
          1,
          e('Fen Hare', 'page-text', 2),
          e('Marsh Owl', 'page-text', 2),
        ),
        section('Horrors', 1, e('Bog Wight', 'page-text', 2)),
      ),
    );
    const owl = place(right, 'Marsh Owl').page;
    expect(sec(right, 'Horrors').page).toBe(owl + 2);
    expect(isBlank(right.pages[owl])).toBe(true);
  });

  it('US-033 AC-4: a long intro runs on; the first entry starts on the next left page after it', async () => {
    const c = await compile(
      chapter(
        section('Beasts', 1, e('Fen Hare', 'page-text', 2)),
        section('Horrors', 18, e('Bog Wight', 'page-text', 2)),
      ),
    );
    const s = sec(c, 'Horrors');
    expect(s.introEnd).toBeGreaterThan(s.page);
    const first = place(c, 'Bog Wight').page;
    expect(first % 2).toBe(0);
    expect(first).toBeGreaterThan(s.introEnd);
    expect(first - s.introEnd).toBeLessThanOrEqual(2);
  });

  it('US-033 AC-5: facing pages off — each opener on a page of its own, no blank page', async () => {
    const c = await compile(
      chapter(
        section('Beasts', 1, e('Fen Hare', 'page-text', 2)),
        section('Horrors', 1, e('Bog Wight', 'page-text', 2)),
      ),
      {},
      false,
    );
    expect(sec(c, 'Horrors').page).toBe(place(c, 'Fen Hare').page + 1);
    expect(place(c, 'Bog Wight').page).toBe(sec(c, 'Horrors').page + 1);
    expect(c.pages.filter((p) => isBlank(p))).toHaveLength(0);
  });
});

describe('US-033 AC-6 the contents', () => {
  it('US-033 AC-6: with toc.depth 2, every entry is listed; sub-headings are not; deeper headings stay bookmarked', async () => {
    const source = [
      chapter(
        section(
          'Beasts',
          1,
          entry(
            '### Fen Hare',
            ['might: 4', 'layout: page-text'],
            [...LEDE, '', '#### Habits', '', 'Dusk.'],
          ),
        ),
      ),
      '',
      '# Players',
      '',
      '### Notes',
      '',
      'Text.',
    ].join('\n');
    const c = await compile(source, {
      toc: {depth: 2, title: 'Contents', pageNumbers: true, dotLeaders: true},
    });
    const contents =
      c.pages.find((p) => p.text.includes('Contents'))?.text ?? '';
    expect(
      inOrder(contents, ['Menagerie', 'Beasts', 'Fen Hare', 'Players']),
    ).toBe(true);
    expect(contents).not.toContain('Habits');
    expect(contents).not.toContain('Notes');
    expect(c.bookmarks.some((b) => b.title.includes('Notes'))).toBe(true);
    expect(c.bookmarks.some((b) => b.title.includes('Fen Hare'))).toBe(true);
  });

  it('US-033 AC-6: with toc.depth 0 there is no contents', async () => {
    const c = await compile(
      chapter(section('Beasts', 1, e('Fen Hare', 'page-text', 2))),
      {toc: {depth: 0}},
    );
    expect(c.pages.some((p) => p.text.includes('Contents'))).toBe(false);
    expect(c.places).toHaveLength(1);
  });
});

describe('US-033 AC-7 the running header', () => {
  it('US-033 AC-7: entry pages show the section; the chapter opener none; a full-image page none', async () => {
    for (const level of [1, 2, 3]) {
      const c = await compile(
        chapter(
          section(
            'Beasts',
            1,
            e('Fen Hare', 'page-text', 2),
            e('Bog Wight', 'full-image', 1, [
              'illustration: "![](assets/e-wide.png)"',
            ]),
          ),
        ),
        {
          pageFurniture: {
            folios: true,
            runningHeader: true,
            runningHeaderLevel: level,
          },
        },
      );
      const opener = sec(c, 'Beasts').page;
      expect(c.pages[opener - 1]?.header.trim(), `level ${level} opener`).toBe(
        '',
      );
      expect(
        c.pages[place(c, 'Fen Hare').page - 1]?.header.trim(),
        `level ${level} entry`,
      ).toBe('Beasts');
      expect(
        c.pages[place(c, 'Bog Wight').page]?.header.trim(),
        `level ${level} image page`,
      ).toBe('');
    }
  });

  it('US-033 AC-14: runningHeader false — no header anywhere', async () => {
    const c = await compile(
      chapter(section('Beasts', 1, e('Fen Hare', 'page-text', 2))),
      {
        pageFurniture: {
          folios: true,
          runningHeader: false,
          runningHeaderLevel: 2,
        },
      },
    );
    expect(c.pages.every((p) => p.header.trim() === '')).toBe(true);
    expect(c.places).toHaveLength(1);
  });
});

describe('US-033 AC-8 links to entries', () => {
  it('US-033 AC-8: a link to an entry gets its first page number, also with linkPageLevel 1', async () => {
    const body = [...LEDE, '', 'See [Cave Wyrm](#cave-wyrm) for more.'];
    const c = await compile(
      chapter(
        section(
          'Beasts',
          1,
          entry('### Fen Hare', ['might: 4', 'layout: page-text'], body),
          e('Cave Wyrm', 'spread-text', 14),
        ),
      ),
      {linkPageNumbers: true, linkPageLevel: 1},
    );
    const wyrm = place(c, 'Cave Wyrm').page;
    const folio = c.pages[wyrm - 1]?.footer.trim();
    // Blanks collapsed as US-018's PDF tests do (`flat`): the link and the
    // page reference are separate runs (G4 #129).
    expect(
      c.pages
        .map((p) => p.text)
        .join(' ')
        .replace(/\s+/g, ' '),
    ).toContain(`Cave Wyrm (p. ${folio})`);
  });
});

describe('US-033 AC-9 to AC-11 the quick reference', () => {
  const qr = {entries: {...ENTRIES, quickReference: true}};

  it('US-033 AC-9 and AC-12: off by default; on, it starts on a left page under "Quick Reference", in the contents', async () => {
    const source = chapter(section('Beasts', 1, e('Fen Hare', 'page-text', 2)));
    const off = await compile(source);
    expect(off.pages.some((p) => p.text.includes('Quick Reference'))).toBe(
      false,
    );
    expect(off.places).toHaveLength(1);
    const on = await compile(source, {
      ...qr,
      toc: {depth: 2, title: 'Contents', pageNumbers: true, dotLeaders: true},
    });
    const pages = on.pages
      .map((p, i) => (p.text.includes('Quick Reference') ? i + 1 : 0))
      .filter((n) => n > 0);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect((pages.at(-1) ?? 1) % 2).toBe(0);
  });

  it("US-033 AC-9 and AC-11 (decision 2): one row per entry, in the note's order; a repeated heading once", async () => {
    const c = await compile(
      chapter(
        section(
          'Beasts',
          1,
          e('Fen Hare', 'page-text', 1),
          e('Marsh Owl', 'page-text', 1),
          e('Cave Wyrm', 'spread-text', 14),
          e('Reed Cat', 'page-text', 1),
        ),
        section(
          'Horrors',
          1,
          e('Bog Wight', 'page-text', 1),
          e('Fen Hare', 'page-text', 1),
        ),
      ),
      qr,
    );
    const start = c.pages.findIndex((p) => p.text.includes('Quick Reference'));
    const table = c.pages
      .slice(start)
      .map((p) => p.text)
      .join(' ');
    expect(
      inOrder(table, [
        'Fen Hare',
        'Marsh Owl',
        'Cave Wyrm',
        'Reed Cat',
        'Bog Wight',
      ]),
    ).toBe(true);
    expect(table.split('Fen Hare').length - 1).toBe(1);
  });

  it('US-033 AC-10: the Track column against trackDefault', async () => {
    const c = await compile(
      chapter(
        section(
          'Beasts',
          1,
          e('Plain One', 'page-text', 1),
          e('Plus One', 'page-text', 1, [
            'states: [Fine, Hurt, Down, Fading, Gone]',
          ]),
          e('Less One', 'page-text', 1, ['states: [Fine, Hurt, Gone]']),
          e('None One', 'page-text', 1, ['states: none']),
          e('Odd One', 'page-text', 1, ['states: [Fine, Gone]']),
        ),
      ),
      qr,
    );
    const start = c.pages.findIndex((p) => p.text.includes('Quick Reference'));
    const table = c.pages
      .slice(start)
      .map((p) => p.text)
      .join(' ');
    expect(inOrder(table, ['Plus One', '+ Fading'])).toBe(true);
    expect(inOrder(table, ['Less One', '− Down'])).toBe(true);
    expect(inOrder(table, ['None One', 'none'])).toBe(true);
    expect(inOrder(table, ['Odd One', 'Fine, Gone'])).toBe(true);
  });

  it('US-033 AC-11: a table over two pages repeats its header row', async () => {
    const entries = Array.from({length: 40}, (_, i) =>
      e(`Beast ${String(i).padStart(2, '0')}`, 'page-text', 0),
    );
    const c = await compile(
      chapter(section('Beasts', 1, ...entries)),
      qr,
      false,
    );
    const start = c.pages.findIndex((p) => p.text.includes('Quick Reference'));
    const tablePages = c.pages
      .slice(start)
      .filter((p) => p.text.includes('Beast '));
    expect(tablePages.length).toBeGreaterThanOrEqual(2);
    // Amended for #139 (AC-9): no Section column; the box label follows Entry.
    for (const p of tablePages) expect(p.text).toMatch(/Entry\s+Vigour/);
  });
});

describe('US-033 AC-14 composed cases', () => {
  it('US-033 AC-14: two entries chapters each get their own openers and quick reference', async () => {
    const source = [
      chapter(section('Beasts', 1, e('Fen Hare', 'page-text', 1))),
      '# Relics',
      '',
      'Relics intro text.',
      '',
      section('Rings', 1, e('Ember Ring', 'page-text', 1)),
    ].join('\n');
    const c = await compile(source, {
      headingRules: {Menagerie: 'entries', Relics: 'entries'},
      entries: {...ENTRIES, quickReference: true},
    });
    expect(sec(c, 'Rings').page % 2).toBe(1);
    expect(
      c.pages.filter((p) => p.text.includes('Quick Reference')).length,
    ).toBeGreaterThanOrEqual(2);
  });
});
