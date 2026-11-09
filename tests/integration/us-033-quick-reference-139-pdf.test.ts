// US-033 AC-7, AC-9, AC-11, AC-12, AC-15; US-036 AC-6 (amendment for #139)
// — the pages an entries chapter writes after its last entry show their own
// title in the running header at every `runningHeaderLevel`; the quick
// reference's box column carries a label (never the raw key), section rows
// replace the Section column and repeat after a page break, entry names link
// to their entries with no page number.
// Source of truth: docs/user-stories/US-033-entry-openers-navigation-quick-reference.md.
// Red until #139's quick reference changes are implemented (G2, 2026-11-09).
import {afterAll, describe, expect, it} from 'vitest';
import {filler} from '../support/book';
import {ENTRIES, entry} from '../support/entries';
import {
  compileEntries,
  disposeEntriesCompiler,
  inOrder,
  type CompiledEntries,
} from '../support/entries-pdf';
import {readPdfLinks} from '../support/pdf';

afterAll(disposeEntriesCompiler);

const SLOW = 30_000;
const SWEEP = 180_000;

const LEDE = [
  'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
];
const e = (name: string, level = 3): string =>
  entry(
    `${'#'.repeat(level)} ${name}`,
    ['vigour: 11', 'might: 4', 'layout: page-text'],
    [...LEDE, '', filler(1, name)],
  );
const section = (name: string, level: number, ...entries: string[]): string =>
  [
    `${'#'.repeat(level)} ${name}`,
    '',
    `${name} intro.`,
    '',
    ...entries.flatMap((x) => [x, '']),
  ].join('\n');

function compile(
  source: string,
  entries: Record<string, unknown>,
  furniture: Record<string, unknown> = {},
): Promise<CompiledEntries> {
  return compileEntries(source, {
    over: {
      headingRules: {Menagerie: 'entries'},
      entries: {...ENTRIES, quickReference: true, ...entries},
      ...(Object.keys(furniture).length === 0
        ? {}
        : {
            pageFurniture: {
              folios: true,
              runningHeader: true,
              runningHeaderLevel: 2,
              ...furniture,
            },
          }),
    },
  });
}

const BASIC = [
  '# Menagerie',
  '',
  'Chapter intro.',
  '',
  section('Beasts', 2, e('Fen Hare'), e('Marsh Owl')),
  section('Horrors', 2, e('Bog Wight')),
].join('\n');

/** 1-based pages from the quick reference's first page to the end. */
const tail = (c: CompiledEntries, title = 'Quick Reference') => {
  const start = c.pages.findIndex((p) => p.text.includes(title));
  return c.pages.slice(start);
};

describe('US-033 AC-7 (amended) the header of the pages after the last entry', () => {
  it(
    'US-033 AC-7, US-036 AC-6: at runningHeaderLevel 1 to 6, every quick-reference page shows "Quick Reference" and the sheet page its own title',
    async () => {
      for (const level of [1, 2, 3, 4, 5, 6]) {
        const c = await compile(
          BASIC,
          {encounterSheet: true},
          {runningHeaderLevel: level},
        );
        const qr = c.pages.filter(
          (p) =>
            p.text.includes('Quick Reference') &&
            p.text.includes('Fen Hare') &&
            p.text.includes('Page'),
        );
        expect(qr.length, `level ${level}`).toBeGreaterThan(0);
        for (const p of qr)
          expect(p.header, `level ${level}`).toBe('Quick Reference');
        const sheet = c.pages.find(
          (p) => p.text.includes('Encounter Sheet') && !p.text.includes('Page'),
        );
        expect(sheet?.header, `level ${level} sheet`).toBe('Encounter Sheet');
      }
    },
    SWEEP,
  );

  it(
    "US-033 AC-7 (G0 answer 16), AC-12: with an empty quickReferenceTitle the quick reference's pages have an empty header",
    async () => {
      const c = await compile(
        BASIC,
        {quickReferenceTitle: ''},
        {runningHeaderLevel: 3},
      );
      const qr = c.pages.filter(
        (p) => p.text.includes('Bog Wight') && p.text.includes('Page'),
      );
      expect(qr.length).toBeGreaterThan(0);
      for (const p of qr) expect(p.header).toBe('');
    },
    SLOW,
  );

  it(
    'US-033 AC-7: a long quick reference keeps its title on every page; the chapter at level 2 too',
    async () => {
      const many = Array.from({length: 40}, (_, i) =>
        e(`Beast ${String(i).padStart(2, '0')}`, 4),
      );
      const source = [
        '# Players',
        '',
        '## Menagerie',
        '',
        'Chapter intro.',
        '',
        section('Beasts', 3, ...many),
      ].join('\n');
      const c = await compile(source, {}, {runningHeaderLevel: 4});
      const pages = tail(c).filter((p) => p.text.includes('Beast '));
      expect(pages.length).toBeGreaterThanOrEqual(2);
      for (const p of pages) expect(p.header).toBe('Quick Reference');
    },
    SLOW,
  );
});

describe('US-033 AC-7 (amended) the pages after them', () => {
  it(
    "US-033 AC-7: the page after the quick reference is US-019's again (G4 of #143: a mutant that ignored the end of the quick reference survived)",
    async () => {
      const source = [
        '# Players',
        '',
        '## Menagerie',
        '',
        'Chapter intro.',
        '',
        section('Beasts', 3, e('Fen Hare', 4), e('Marsh Owl', 4)),
        '## Rules',
        '',
        filler(40, 'Rules'),
      ].join('\n');
      const c = await compile(source, {}, {runningHeaderLevel: 2});
      const qrLast = c.pages.reduce(
        (last, p, i) =>
          p.text.includes('Marsh Owl') && p.text.includes('Page') ? i : last,
        -1,
      );
      expect(qrLast).toBeGreaterThan(0);
      const after = c.pages
        .slice(qrLast + 1)
        .filter((p) => p.text.includes('Rules 3'));
      expect(after.length).toBeGreaterThan(0);
      for (const p of c.pages
        .slice(qrLast + 1)
        .filter((x) => x.text.includes('lorem')))
        expect(p.header).toBe('Rules');
    },
    SLOW,
  );
});

describe('US-033 AC-9 (amended) the box label, section rows and links', () => {
  it(
    "US-033 AC-9, AC-11 (G0 answer 14): the box column is headed with the key's first character in upper case; no Section column",
    async () => {
      const c = await compile(BASIC, {});
      const table = tail(c)
        .map((p) => p.text)
        .join(' ');
      expect(table).toMatch(
        /Entry\s+Vigour\s+Might\s+Wits\s+Speed\s+Track\s+Page/,
      );
      expect(table).not.toMatch(/\bvigour\b/);
      expect(table).not.toMatch(/\bSection\b/);
    },
    SLOW,
  );

  it(
    'US-033 AC-9: a stats label for the box key wins over the key',
    async () => {
      const c = await compile(BASIC, {
        statblock: {
          ...ENTRIES.statblock,
          stats: [
            ...ENTRIES.statblock.stats,
            {key: 'vigour', label: 'Stamina'},
          ],
        },
      });
      const table = tail(c)
        .map((p) => p.text)
        .join(' ');
      expect(table).toMatch(/Entry\s+Stamina/);
    },
    SLOW,
  );

  it(
    "US-033 AC-9, AC-11 (D60): section rows precede each section's entries, in the note's order",
    async () => {
      const c = await compile(BASIC, {});
      const table = tail(c)
        .map((p) => p.text)
        .join(' ');
      expect(
        inOrder(table, [
          'Page',
          'Beasts',
          'Fen Hare',
          'Marsh Owl',
          'Horrors',
          'Bog Wight',
        ]),
      ).toBe(true);
    },
    SLOW,
  );

  it(
    'US-033 AC-9 (G0 answer 17): a chapter without sections has no section rows',
    async () => {
      const source = [
        '# Menagerie',
        '',
        'Chapter intro.',
        '',
        e('Fen Hare', 2),
        '',
        e('Marsh Owl', 2),
      ].join('\n');
      const c = await compile(source, {});
      const table = tail(c)
        .map((p) => p.text)
        .join(' ');
      expect(inOrder(table, ['Page', 'Fen Hare', 'Marsh Owl'])).toBe(true);
      expect(table).not.toMatch(/Menagerie\s+Fen Hare/);
    },
    SLOW,
  );

  it(
    'US-033 AC-9, AC-11: a table that breaks inside a section repeats the header row and then the section row',
    async () => {
      const many = Array.from({length: 45}, (_, i) =>
        e(`Beast ${String(i).padStart(2, '0')}`),
      );
      const c = await compile(
        ['# Menagerie', '', section('Beasts', 2, ...many)].join('\n'),
        {},
      );
      const pages = tail(c).filter((p) => p.text.includes('Beast '));
      expect(pages.length).toBeGreaterThanOrEqual(2);
      for (const p of pages)
        expect(p.text).toMatch(/Entry\s+Vigour[\s\S]*Page\s+Beasts\s+Beast/);
    },
    SLOW,
  );

  it(
    "US-033 AC-9 (G0 answer 15): each entry name links to the entry's first page; no page number follows the name",
    async () => {
      const c = await compile(BASIC, {}, {});
      const start = c.pages.findIndex(
        (p) => p.text.includes('Quick Reference') && p.text.includes('Page'),
      );
      const links = readPdfLinks(c.pdf).filter((l) => l.page === start);
      for (const name of ['Fen Hare', 'Marsh Owl', 'Bog Wight']) {
        const first = c.places.find((p) => p.heading === name)?.page ?? 0;
        expect(
          links.some((l) => l.target === first - 1),
          name,
        ).toBe(true);
      }
      const table = c.pages[start]?.text ?? '';
      expect(table).not.toMatch(/Fen Hare \(p\./);
    },
    SLOW,
  );
});
