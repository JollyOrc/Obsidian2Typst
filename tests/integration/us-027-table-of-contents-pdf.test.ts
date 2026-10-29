// US-027 AC-2 to AC-6, AC-9 — the table of contents with the real compiler:
// the listed entries with their numbers, links and folios, the two switches,
// the bookmarks of callout headings, the default and a picked place, the
// contents pages (new page before and after, no running header, running on),
// and the composed book.
// Source of truth: docs/user-stories/US-027-table-of-contents.md.
import {afterAll, describe, expect, it} from 'vitest';
import {
  compileBook,
  disposeBookCompiler,
  filler,
  pageOf,
  type BookOptions,
} from '../support/book';
import type {PdfPage} from '../support/pdf';

afterAll(() => disposeBookCompiler());

const layout = (pages: readonly PdfPage[]): string =>
  pages
    .map(
      (p, i) =>
        `p${i + 1}: ${p.text.replace(/\s+/g, ' ').trim().slice(0, 60)} | ${p.header} | ${p.footer}`,
    )
    .join('\n');

const NOTE = [
  '# Rules',
  '',
  'Rules text.',
  '',
  '## Combat',
  '',
  'Combat text.',
  '',
  '### Attacks',
  '',
  'Attack text.',
  '',
  '> [!note]',
  '> ## Boxed',
  '> Inside.',
  '',
  '# Lore',
  '',
  'Lore text.',
  '',
  '# Glossary',
  '',
  '## Grit',
  '',
  'Grit text.',
].join('\n');

const toc = (t: Record<string, unknown>, more: Record<string, unknown> = {}) =>
  ({extra: {toc: t, ...more}}) satisfies BookOptions;

/** The page that holds the contents title. */
const contentsPage = (pages: readonly PdfPage[], title = 'Contents'): number =>
  pageOf(pages, title);

describe('US-027 AC-2, AC-3 the entries (measured)', {timeout: 120_000}, () => {
  it('US-027 AC-3: depth 2, numbering 1.1: Rules, Combat, Lore, Glossary with numbers; not Attacks, Boxed, Grit', async () => {
    const {pages} = await compileBook(NOTE, toc({depth: 2}));
    const at = contentsPage(pages);
    expect(at, layout(pages)).toBeGreaterThan(0);
    const text = pages[at - 1]?.text ?? '';
    for (const entry of ['1 Rules', '1.1 Combat', '2 Lore', '3 Glossary']) {
      expect(text, entry).toContain(entry);
    }
    for (const missing of ['Attacks', 'Boxed', 'Grit']) {
      expect(text, missing).not.toContain(missing);
    }
  });

  it('US-027 AC-3: every entry links to its heading page; the entry shows that page folio', async () => {
    const {pages, links} = await compileBook(NOTE, toc({depth: 2}));
    const at = contentsPage(pages) - 1;
    const targets = links
      .filter((l) => l.page === at && l.target !== null)
      .map((l) => l.target as number);
    for (const heading of [
      'Rules text.',
      'Combat text.',
      'Lore text.',
      'Grit text.',
    ]) {
      expect(targets, heading).toContain(pageOf(pages, heading) - 1);
    }
    const text = pages[at]?.text ?? '';
    const loreFolio = pages[pageOf(pages, 'Lore text.') - 1]?.footer ?? '?';
    expect(text).toMatch(new RegExp(`2 Lore[ .]*${loreFolio}\\b`));
  });

  it('US-027 AC-2: dot leaders off: no dots; page numbers off: no folio after an entry, links kept', async () => {
    const leaders = await compileBook(NOTE, toc({depth: 1}));
    const plain = await compileBook(
      NOTE,
      toc({depth: 1, dotLeaders: false, pageNumbers: false}),
    );
    const withLeaders =
      leaders.pages[contentsPage(leaders.pages) - 1]?.text ?? '';
    const without = plain.pages[contentsPage(plain.pages) - 1]?.text ?? '';
    expect(withLeaders).toMatch(/\. \. \./);
    expect(without).not.toMatch(/\. \. \./);
    expect(without).toMatch(/1 Rules 2 Lore 3 Glossary\s*$/);
    const at = contentsPage(plain.pages) - 1;
    expect(
      plain.links.filter((l) => l.page === at && l.target !== null),
    ).toHaveLength(3);
  });

  it('US-027 AC-2: a title with characters that need escaping is printed as written; an empty title prints none', async () => {
    const custom = await compileBook(
      NOTE,
      toc({depth: 1, title: 'Rules #1 *and* [more]'}),
    );
    expect(custom.pages.map((p) => p.text).join(' ')).toContain(
      'Rules #1 *and* [more]',
    );
    const none = await compileBook(NOTE, toc({depth: 1, title: ''}));
    expect(none.pages[0]?.text.trimStart()).toMatch(/^1 Rules/);
  });

  it('US-027 AC-3: headings in a quote and a list item are in the bookmarks and not in the contents', async () => {
    const source = [
      '# Rules',
      '',
      'Rules text.',
      '',
      '> ## Quoted',
      '> Inside quote.',
      '',
      '- ## Listed',
      '  Item text.',
      '',
      '# Lore',
      '',
      'Lore text.',
    ].join('\n');
    const {pages, bookmarks} = await compileBook(source, toc({depth: 2}));
    const text = pages[contentsPage(pages) - 1]?.text ?? '';
    expect(text, layout(pages)).toContain('1 Rules');
    expect(text).toContain('2 Lore');
    expect(text).not.toContain('Quoted');
    expect(text).not.toContain('Listed');
    const titles = bookmarks.map((b) => b.title).join(' | ');
    expect(titles).toContain('Quoted');
    expect(titles).toContain('Listed');
  });

  it('US-027 AC-3: the callout heading is in the bookmarks and not in the contents (B1)', async () => {
    const {bookmarks} = await compileBook(NOTE, toc({depth: 2}));
    expect(bookmarks.map((b) => b.title).join(' | ')).toContain('Boxed');
  });
});

describe(
  'US-027 AC-4, AC-6 the default place and the contents pages',
  {timeout: 120_000},
  () => {
    it('US-027 AC-4: no cover, no colophon: contents on p. 1, the first chapter on the next left page (p. 2)', async () => {
      const {pages} = await compileBook(NOTE, toc({depth: 2}));
      expect(contentsPage(pages), layout(pages)).toBe(1);
      expect(pageOf(pages, 'Rules text.')).toBe(2);
    });

    it('US-027 AC-4: a cover, no colophon: p. 2 blank, contents on p. 3 (decision 2)', async () => {
      const {pages} = await compileBook(NOTE, {
        cover: 'cover',
        ...toc({depth: 2}),
      });
      expect(pages[1]?.hasText, layout(pages)).toBe(false);
      expect(contentsPage(pages)).toBe(3);
      expect(pageOf(pages, 'Rules text.') % 2).toBe(0);
    });

    it('US-027 AC-4: facing pages off, a cover: contents on p. 2, the first chapter on p. 3 (US-026 AC-7; TICKET-085, SCAR-019)', async () => {
      const {pages} = await compileBook(NOTE, {
        cover: 'cover',
        facingPages: false,
        ...toc({depth: 2}),
      });
      expect(contentsPage(pages), layout(pages)).toBe(2);
      expect(pages[1]?.text).not.toContain('Rules text.');
      expect(pageOf(pages, 'Rules text.')).toBe(3);
    });

    it('US-027 AC-6: a long contents runs on; no contents page has a running header; what follows starts a new page', async () => {
      const many = Array.from(
        {length: 60},
        (_, i) => `# Chapter ${i}\n\n## Part ${i}\n\nText ${i}.`,
      ).join('\n\n');
      const {pages} = await compileBook(many, toc({depth: 2}));
      const first = contentsPage(pages);
      const chapter = pageOf(pages, 'Text 0.');
      expect(chapter - first, layout(pages)).toBeGreaterThan(1);
      for (let p = first; p < chapter; p++) {
        expect(pages[p - 1]?.header.trim(), `p. ${p}`).toBe('');
      }
      expect(pages[chapter - 1]?.text.trimStart()).toMatch(/^1 Chapter 0/);
    });

    it('US-027 AC-6, SCAR-021: swept across the page edge (one to two contents pages), every entry prints the folio of its heading page; the first chapter stays on a left page', async () => {
      // Measured 2026-10-29 (scratchpad p027b/edge.test.ts, title and depth 1
      // written by hand): one contents page up to 34 chapters, two from 36.
      const seen = new Set<number>();
      for (const n of [32, 33, 34, 35, 36, 37, 38]) {
        const source = Array.from(
          {length: n},
          (_, i) => `# Chapter ${i}\n\nText ${i}.`,
        ).join('\n\n');
        const {pages} = await compileBook(source, toc({depth: 1}));
        const first = contentsPage(pages);
        const chapter = pageOf(pages, 'Text 0.');
        expect(first, `n ${n}\n${layout(pages)}`).toBe(1);
        // a blank page that brings the chapter to its side is no contents page
        seen.add(
          pages
            .slice(first - 1, chapter - 1)
            .filter((p) => p.text.trim() !== '').length,
        );
        expect(chapter % 2, `n ${n}: first chapter on p. ${chapter}`).toBe(0);
        const listed = pages
          .slice(first - 1, chapter - 1)
          .map((p) => p.text)
          .join(' ');
        let checked = 0;
        for (let i = 0; i < n; i++) {
          const entry = new RegExp(
            `(?:^|\\s)${i + 1} Chapter ${i}[ .]*(\\S+)`,
          ).exec(listed);
          const folio = pages[pageOf(pages, `Text ${i}.`) - 1]?.footer.trim();
          expect(entry?.[1], `n ${n}, Chapter ${i}`).toBe(folio);
          checked++;
        }
        expect(checked).toBe(n);
      }
      expect([...seen].sort(), 'the sweep crosses the page edge').toEqual([
        1, 2,
      ]);
    });

    it('US-027 AC-6: front matter without a colophon: after a foreword with a heading, the contents page has no running header', async () => {
      const {pages} = await compileBook(
        `## Foreword\n\n${filler(20, 'Foreword')}\n\n${NOTE}`,
        toc({depth: 2}),
      );
      const at = contentsPage(pages);
      expect(at, layout(pages)).toBeGreaterThan(pageOf(pages, 'Foreword 19'));
      expect(pages[at - 1]?.header.trim()).toBe('');
      // the foreword's own last page shows its title: the header is on there
      expect(pages[pageOf(pages, 'Foreword 19') - 1]?.header.trim()).toBe(
        'Foreword',
      );
    });

    it('US-027 AC-6: roman folios on the contents pages in roman front matter', async () => {
      const {pages} = await compileBook(`# Colophon\n\nPrinted.\n\n${NOTE}`, {
        cover: 'cover',
        ...toc({depth: 2}, {book: {romanFrontMatter: true}}),
      });
      expect(pages[contentsPage(pages) - 1]?.footer, layout(pages)).toBe('iv');
    });
  },
);

describe('US-027 AC-5 a picked place', {timeout: 120_000}, () => {
  it('US-027 AC-5: after the Rules section: own pages in the body, arabic folio, Lore on a new page (decision 5)', async () => {
    const {pages} = await compileBook(
      NOTE,
      toc(
        {depth: 2, heading: 'Rules', position: 'after'},
        {book: {romanFrontMatter: true}},
      ),
    );
    const at = contentsPage(pages);
    expect(at, layout(pages)).toBeGreaterThan(pageOf(pages, 'Inside.'));
    expect(pageOf(pages, 'Lore text.')).toBeGreaterThan(at);
    expect(pages[at - 1]?.footer).toMatch(/^\d+$/);
    expect(pages[at - 1]?.text).not.toContain('Inside.');
    // AC-6: no running header on the contents page (Combat would be shown)
    expect(pages[at - 1]?.header.trim()).toBe('');
  });
});

describe('US-027 AC-9 the composed book (SCAR-002)', {timeout: 300_000}, () => {
  it('US-027 AC-9: cover, printed colophon, back notes, glossary, callout heading, numbering, roman, breaks, signature, depth 3', async () => {
    const source = [
      '# Colophon',
      '',
      'Printed in 2026.',
      '',
      NOTE,
      '',
      filler(10),
      '',
      '# Back notes',
      '',
      'Back note text.',
    ].join('\n');
    const {pages, links, bookmarks} = await compileBook(source, {
      cover: 'cover',
      extra: {
        toc: {depth: 3},
        book: {
          signature: 8,
          romanFrontMatter: true,
          colophonHeading: 'printed',
          backNotesHeading: 'hidden',
        },
        breakBefore: {h1: 'right'},
      },
    });
    const at = contentsPage(pages);
    const text = pages[at - 1]?.text ?? '';
    expect(text, layout(pages)).toContain('Colophon');
    // US-026 decision 8: the printed colophon heading keeps its number.
    expect(text).toMatch(/1 Colophon[ .]*iii/);
    for (const entry of [
      '2 Rules',
      '2.1 Combat',
      '2.1.1 Attacks',
      '3 Lore',
      '4 Glossary',
    ]) {
      expect(text, entry).toContain(entry);
    }
    for (const missing of ['Boxed', 'Grit', 'Back notes']) {
      expect(text, missing).not.toContain(missing);
    }
    expect(
      new Set(
        links
          .filter((l) => l.page === at - 1 && l.target !== null)
          .map((l) => l.target),
      ).size,
      'one target page per heading page listed',
    ).toBe(
      new Set(
        ['Printed in 2026.', 'Rules text.', 'Lore text.', 'Grit text.'].map(
          (t) => pageOf(pages, t) - 1,
        ),
      ).size,
    );
    expect(bookmarks.map((b) => b.title).join(' | ')).toContain('Boxed');
    expect(pages.length % 8).toBe(0);
    expect(pages[pages.length - 1]?.text).toContain('Back note text.');
  });
});
