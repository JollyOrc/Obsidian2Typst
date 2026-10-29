// US-026 AC-3 to AC-7, AC-10 — book parts and signatures with the real
// compiler: the page table of AC-3 (measured before it was written), roman
// front matter off, the signature padding swept over body lengths and back
// notes of one and of several pages (the expected pages computed from a run
// without padding), what the added pages print, facing pages off, and the
// composed book.
// Source of truth: docs/user-stories/US-026-book-parts-and-signatures.md.
import {afterAll, describe, expect, it} from 'vitest';
import {
  compileBook,
  disposeBookCompiler,
  filler,
  isBlank,
  pageOf,
  type BookOptions,
} from '../support/book';
import type {PdfPage} from '../support/pdf';

afterAll(() => disposeBookCompiler());

const layout = (pages: readonly PdfPage[]): string =>
  pages
    .map(
      (p, i) =>
        `p${i + 1}: ${p.text.replace(/\s+/g, ' ').trim().slice(0, 40)} | ${p.footer}`,
    )
    .join('\n');

const COLOPHON = '# Colophon\n\nPrinted in 2026.';
const CHAPTER = '# Rules\n\nChapter text.';
const book = (b: Record<string, unknown>, more: Record<string, unknown> = {}) =>
  ({extra: {book: b, ...more}}) satisfies BookOptions;
const ROMAN = {romanFrontMatter: true};

describe(
  'US-026 AC-3 the pages with facing pages (measured)',
  {timeout: 120_000},
  () => {
    it('US-026 AC-3: cover, colophon: cover; blank (nothing); colophon iii; chapter 1', async () => {
      const {pages} = await compileBook(`${COLOPHON}\n\n${CHAPTER}`, {
        cover: 'cover',
        ...book(ROMAN),
      });
      expect(pages, layout(pages)).toHaveLength(4);
      expect(pages[0]?.hasImage).toBe(true);
      expect(pages[0]?.footer).toBe('');
      expect(pages[1]?.hasText).toBe(false);
      expect(pages[1]?.hasImage).toBe(false);
      expect(pages[2]?.text).toContain('Printed in 2026.');
      expect(pages[2]?.footer).toBe('iii');
      expect(pages[3]?.text).toContain('Chapter text.');
      expect(pages[3]?.footer).toBe('1');
    });

    it('US-026 AC-3: the cover blank page is fully blank also with cover.blankPageAfter set', async () => {
      const {pages} = await compileBook(`${COLOPHON}\n\n${CHAPTER}`, {
        cover: 'blank',
        ...book(ROMAN),
      });
      expect(pages, layout(pages)).toHaveLength(4);
      expect(pages[1]?.hasText).toBe(false);
      expect(pages[2]?.footer).toBe('iii');
    });

    it('US-026 AC-3: cover, colophon, contents of one page: … contents iv; blank v; chapter 1 on p. 6', async () => {
      const {pages} = await compileBook(`${COLOPHON}\n\n${CHAPTER}`, {
        cover: 'cover',
        ...book(ROMAN, {toc: {depth: 2}}),
      });
      expect(pages, layout(pages)).toHaveLength(6);
      expect(pages[3]?.text).toContain('Contents');
      expect(pages[3]?.footer).toBe('iv');
      expect(isBlank(pages[4])).toBe(true);
      expect(pages[4]?.footer).toBe('v');
      expect(pages[5]?.text).toContain('Chapter text.');
      expect(pages[5]?.footer).toBe('1');
    });

    it('US-026 AC-3: the same with firstChapter right: chapter 1 on p. 5', async () => {
      const {pages} = await compileBook(`${COLOPHON}\n\n${CHAPTER}`, {
        cover: 'cover',
        ...book({...ROMAN, firstChapter: 'right'}, {toc: {depth: 2}}),
      });
      expect(pages, layout(pages)).toHaveLength(5);
      // TICKET-079: without this line the row passed with no contents at all.
      expect(pages[3]?.text).toContain('Contents');
      expect(pages[3]?.footer).toBe('iv');
      expect(pages[4]?.text).toContain('Chapter text.');
      expect(pages[4]?.footer).toBe('1');
    });

    it('US-026 AC-3: colophon, no cover: colophon i; chapter 1', async () => {
      const {pages} = await compileBook(
        `${COLOPHON}\n\n${CHAPTER}`,
        book(ROMAN),
      );
      expect(pages, layout(pages)).toHaveLength(2);
      expect(pages[0]?.footer).toBe('i');
      expect(pages[1]?.footer).toBe('1');
    });

    it('US-026 AC-3 guard: cover only (no front matter): the pages are as today', async () => {
      const today = await compileBook(CHAPTER, {cover: 'blank'});
      const withBook = await compileBook(CHAPTER, {
        cover: 'blank',
        ...book({...ROMAN, signature: 0}),
      });
      expect(layout(withBook.pages)).toBe(layout(today.pages));
    });

    it('US-026 AC-3: the first chapter rule replaces an h1: right rule for that heading (chapter on the left p. 4)', async () => {
      // TICKET-079: a mutant that kept the h1 rule survived every other test.
      const {pages} = await compileBook(
        `${COLOPHON}\n\n${CHAPTER}\n\n# Second\n\nSecond text.`,
        {cover: 'cover', ...book(ROMAN, {breakBefore: {h1: 'right'}})},
      );
      expect(pageOf(pages, 'Chapter text.'), layout(pages)).toBe(4);
      expect(pages[3]?.footer).toBe('1');
      // guard: the h1 rule is in effect for the next chapter (a right page)
      expect(pageOf(pages, 'Second text.') % 2).toBe(1);
    });

    it('US-026 AC-3: a colophon longer than a page runs on; the chapter follows by the spread rule (left page)', async () => {
      const {pages} = await compileBook(
        `# Colophon\n\n${filler(30, 'Colophon')}\n\n${CHAPTER}`,
        {cover: 'cover', ...book(ROMAN)},
      );
      const chapter = pageOf(pages, 'Chapter text.');
      expect(chapter % 2, layout(pages)).toBe(0);
      expect(pageOf(pages, 'Colophon 0')).toBe(3);
    });
  },
);

describe(
  'US-026 AC-4 roman front matter off (measured)',
  {timeout: 120_000},
  () => {
    it('US-026 AC-4: cover, blank, colophon without folio, chapter 1', async () => {
      const {pages} = await compileBook(`${COLOPHON}\n\n${CHAPTER}`, {
        cover: 'cover',
        ...book({romanFrontMatter: false}),
      });
      expect(pages, layout(pages)).toHaveLength(4);
      expect(pages[2]?.footer).toBe('');
      expect(pages[3]?.footer).toBe('1');
    });

    it('US-026 AC-4: with folios off no page prints a folio', async () => {
      const {pages} = await compileBook(`${COLOPHON}\n\n${CHAPTER}`, {
        cover: 'cover',
        furniture: {folios: false, runningHeader: true, runningHeaderLevel: 2},
        ...book(ROMAN),
      });
      expect(pages.map((p) => p.footer)).toEqual(pages.map(() => ''));
    });

    it('US-026 AC-4 (decision 6): a page reference into the front matter prints the arabic page count; into the body the folio', async () => {
      const {pages} = await compileBook(
        `${COLOPHON}\n\n# Rules\n\nSee [the colophon](#colophon) and [the rules](#rules).`,
        {
          cover: 'cover',
          over: {linkPageNumbers: true, linkPageLevel: 1, linkPageWord: 'p.'},
          ...book({romanFrontMatter: false}),
        },
      );
      const all = pages.map((p) => p.text).join(' ');
      const refs = [...all.matchAll(/\(p\.\s*([ivxlc\d]+)\)/g)].map(
        (m) => m[1],
      );
      expect(pageOf(pages, 'Printed in 2026.'), layout(pages)).toBe(3);
      expect(pages[2]?.footer).toBe('');
      expect(refs, layout(pages)).toEqual(['3', '1']);
    });
  },
);

/** A body ending in a marker, and back notes of `notes` filler paragraphs. */
const signatureNote = (body: number, notes: number): string =>
  [
    '# Rules',
    '',
    filler(body),
    '',
    'END OF BODY.',
    '',
    '# Back notes',
    '',
    'BACK START.',
    '',
    filler(notes, 'Note'),
    '',
    'BACK END.',
  ].join('\n');

describe(
  'US-026 AC-5, AC-6 back notes and padding (swept; SCAR-021)',
  {timeout: 600_000},
  () => {
    for (const signature of [4, 8] as const) {
      for (const notes of [0, 40]) {
        it(`US-026 AC-5: signature ${signature}, back notes of ${notes === 0 ? 'one page' : 'several pages'}: a whole number of signatures, the back notes end on the last page`, async () => {
          for (const body of [0, 8, 16, 24, 32, 48, 64]) {
            const source = signatureNote(body, notes);
            const plain = await compileBook(source, book({signature: 0}));
            const end = pageOf(plain.pages, 'END OF BODY.');
            const start0 = pageOf(plain.pages, 'BACK START.');
            expect(
              start0,
              `back notes start on a new page\n${layout(plain.pages)}`,
            ).toBe(end + 1);
            const backPages = plain.pages.length - end;
            const padded = await compileBook(source, book({signature}));
            const {pages} = padded;
            const total = Math.ceil(plain.pages.length / signature) * signature;
            const why = `body ${body}\n${layout(pages)}`;
            expect(pages.length, why).toBe(total);
            expect(pageOf(pages, 'BACK START.'), why).toBe(
              total - backPages + 1,
            );
            expect(pages[pages.length - 1]?.text, why).toContain('BACK END.');
            for (let p = end + 1; p <= total - backPages; p++) {
              expect(isBlank(pages[p - 1]), `p. ${p} is padding\n${why}`).toBe(
                true,
              );
              expect(pages[p - 1]?.footer, `p. ${p} folio`).toBe(String(p));
            }
            expect(total - backPages - end).toBeLessThan(signature);
          }
        });
      }
    }

    it('US-026 AC-5: the examples of the story (signature 4, one-page back notes)', async () => {
      // body ending on p. 2, 3 and 4 (found by length; the expected pages as in AC-5)
      const seen = new Set<number>();
      for (let body = 4; body <= 60 && seen.size < 3; body += 2) {
        const source = signatureNote(body, 0);
        const plain = await compileBook(source, book({signature: 0}));
        const end = pageOf(plain.pages, 'END OF BODY.');
        if (end < 2 || end > 4 || seen.has(end)) continue;
        seen.add(end);
        const {pages} = await compileBook(source, book({signature: 4}));
        const expected = {2: [3, 4, 4], 3: [null, 4, 4], 4: [5, 8, 8]}[end] as [
          number | null,
          number,
          number,
        ];
        expect(pageOf(pages, 'BACK START.'), `end ${end}`).toBe(expected[1]);
        expect(pages.length, `end ${end}`).toBe(expected[2]);
        if (expected[0] !== null)
          expect(isBlank(pages[expected[0] - 1])).toBe(true);
      }
      expect([...seen].sort()).toEqual([2, 3, 4]);
    });

    it('US-026 AC-5: without back notes the padding goes at the end', async () => {
      const plain = await compileBook(
        `# Rules\n\n${filler(20)}\n\nEND OF BODY.`,
        book({signature: 0}),
      );
      const {pages} = await compileBook(
        `# Rules\n\n${filler(20)}\n\nEND OF BODY.`,
        book({signature: 8}),
      );
      expect(pages.length).toBe(Math.ceil(plain.pages.length / 8) * 8);
      for (const page of pages.slice(plain.pages.length)) {
        expect(isBlank(page)).toBe(true);
        expect(page.footer).not.toBe('');
      }
    });

    it('US-026 AC-6: colophon and back notes print no running header; the back notes their arabic folio', async () => {
      const {pages} = await compileBook(
        `${COLOPHON}\n\n${CHAPTER}\n\n## Section\n\n${filler(30)}\n\n# Back notes\n\nBACK START.`,
        {cover: 'cover', ...book({...ROMAN, signature: 8})},
      );
      const colophon = pages[pageOf(pages, 'Printed in 2026.') - 1];
      const back = pages[pageOf(pages, 'BACK START.') - 1];
      expect(colophon?.header.trim()).toBe('');
      expect(back?.header.trim()).toBe('');
      expect(back?.footer).toBe(String(pages.indexOf(back as PdfPage) - 2));
      // guard: a body page continued from the section prints the running header
      expect(pages.some((p) => p.header.trim() === 'Section')).toBe(true);
    });
  },
);

describe('US-026 AC-7 facing pages off', {timeout: 120_000}, () => {
  it('US-026 AC-7: after a cover the colophon is on p. 2, the chapter on the next page; padding still counts', async () => {
    const {pages} = await compileBook(
      `${COLOPHON}\n\n${CHAPTER}\n\n# Back notes\n\nBACK START.`,
      {
        cover: 'cover',
        facingPages: false,
        ...book({signature: 8}),
      },
    );
    expect(pageOf(pages, 'Printed in 2026.'), layout(pages)).toBe(2);
    expect(pageOf(pages, 'Chapter text.')).toBe(3);
    expect(pages.length % 8).toBe(0);
    expect(pages[pages.length - 1]?.text).toContain('BACK START.');
  });

  it('US-026 AC-7: with the cover blank page set, the colophon is on p. 3', async () => {
    const {pages} = await compileBook(`${COLOPHON}\n\n${CHAPTER}`, {
      cover: 'blank',
      facingPages: false,
      ...book({}),
    });
    expect(pageOf(pages, 'Printed in 2026.'), layout(pages)).toBe(3);
    expect(pageOf(pages, 'Chapter text.')).toBe(4);
  });
});

describe(
  'US-026 AC-10 the composed book (SCAR-002)',
  {timeout: 300_000},
  () => {
    const COMPOSED = [
      '# Colophon',
      '',
      'Printed in 2026 by the guild.',
      '',
      '# Rules',
      '',
      'Intro, see [the colophon](#colophon) and [the notes](#back-notes) and a footnote[^1].',
      '',
      '## Tessera',
      '',
      'Tessera text.',
      '',
      '> [!note]',
      '> Inside the box.',
      '',
      filler(12),
      '',
      '# Glossary',
      '',
      '## Action',
      '',
      'An act.',
      '',
      '# Back notes',
      '',
      'Back note text.',
      '',
      '[^1]: The footnote text.',
    ].join('\n');

    for (const cover of ['cover', 'blank'] as const) {
      it(`US-026 AC-10: with the cover${cover === 'blank' ? ' and its blank page' : ''}: compiles, every text, a multiple of 8, back notes last, page references print the printed folio`, async () => {
        const {pages} = await compileBook(COMPOSED, {
          cover,
          over: {linkPageNumbers: true, linkPageLevel: 2, linkPageWord: 'p.'},
          extra: {
            book: {signature: 8, romanFrontMatter: true},
            breakBefore: {h1: 'right', h2: 'page'},
          },
        });
        const all = pages.map((p) => p.text).join(' ');
        for (const text of [
          'Printed in 2026 by the guild.',
          'Intro, see',
          'Tessera text.',
          'Inside the box.',
          'An act.',
          'Back note text.',
          'The footnote text.',
        ]) {
          expect(all, text).toContain(text);
        }
        expect(pages.length % 8, layout(pages)).toBe(0);
        expect(pages[pages.length - 1]?.text).toContain('Back note text.');
        const refs = [...all.matchAll(/\(p\.\s*([ivxlc\d]+)\)/g)].map(
          (m) => m[1],
        );
        const folio = (needle: string) =>
          pages[pageOf(pages, needle) - 1]?.footer;
        expect(refs).toEqual([
          folio('Printed in 2026'),
          folio('Back note text.'),
        ]);
        expect(folio('Printed in 2026')).toBe('iii');
      });
    }
  },
);
