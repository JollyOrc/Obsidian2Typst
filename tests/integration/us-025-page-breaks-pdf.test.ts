// US-025 AC-2, AC-5, AC-6, AC-8 — page breaks by heading level with the real
// compiler: the page tables of the story (each measured before it was
// written), the blank pages Typst adds (folio only, no running header), and
// the composed note with a cover, a glossary, a callout heading, a footnote,
// page references and a template hook.
// Source of truth: docs/user-stories/US-025-page-breaks-by-heading.md.
import {afterAll, describe, expect, it} from 'vitest';
import {
  compileBook,
  disposeBookCompiler,
  filler,
  FURNITURE_ON,
  isBlank,
  pageOf,
  type CompiledBook,
} from '../support/book';
import type {PdfPage} from '../support/pdf';

afterAll(() => disposeBookCompiler());

type Rule = 'none' | 'page' | 'right' | 'left';
type Rules = Partial<Record<`h${1 | 2 | 3 | 4 | 5 | 6}`, Rule>>;

const withRules = (rules: Rules) => ({breakBefore: rules});

/** One line per page: `text | folio`, for readable failures. */
const layout = (pages: readonly PdfPage[]): string[] =>
  pages.map((p) => `${p.text.replace(/\s+/g, ' ').trim()} | ${p.footer}`);

const TWO = '# One\n\n## A\n\nText a.\n\n# Two\n\n## C\n\nText c.';
const THREE = '# One\n\n## A\n\nText a.\n\n## B\n\nText b.\n\n## C\n\nText c.';

describe('US-025 AC-2 the page tables (measured)', {timeout: 120_000}, () => {
  it('US-025 AC-2: h1 right: p. 1 One, A; p. 2 blank with folio 2; p. 3 Two, C', async () => {
    const {pages} = await compileBook(TWO, {extra: withRules({h1: 'right'})});
    expect(pages, layout(pages).join('\n')).toHaveLength(3);
    expect(pages[0]?.text).toContain('One');
    expect(pages[0]?.text).toContain('A');
    expect(isBlank(pages[1])).toBe(true);
    expect(pages[1]?.footer).toBe('2');
    expect(pages[2]?.text).toContain('Two');
    expect(pages[2]?.text).toContain('C');
    expect(pages[2]?.footer).toBe('3');
  });

  it('US-025 AC-2: h1 right with facing pages off: two pages, no blank page', async () => {
    const {pages} = await compileBook(TWO, {
      extra: withRules({h1: 'right'}),
      facingPages: false,
    });
    expect(layout(pages)).toHaveLength(2);
    expect(pages[0]?.text).toContain('One');
    expect(pages[1]?.text).toContain('Two');
  });

  it('US-025 AC-2: h2 left: blank, One A, blank, B, blank, C (the third row, measured at G2)', async () => {
    const {pages} = await compileBook(THREE, {extra: withRules({h2: 'left'})});
    expect(pages, layout(pages).join('\n')).toHaveLength(6);
    for (const blank of [0, 2, 4]) {
      expect(isBlank(pages[blank]), `p. ${blank + 1}`).toBe(true);
      expect(pages[blank]?.footer).toBe(String(blank + 1));
    }
    expect(pages[1]?.text).toContain('One');
    expect(pages[1]?.text).toContain('Text a.');
    expect(pages[3]?.text).toContain('Text b.');
    expect(pages[5]?.text).toContain('Text c.');
  });

  it('US-025 AC-2: h1 right with folios off: the blank p. 2 has no folio and no header', async () => {
    const {pages} = await compileBook(TWO, {
      extra: withRules({h1: 'right'}),
      furniture: {...FURNITURE_ON, folios: false},
    });
    expect(pages).toHaveLength(3);
    expect(isBlank(pages[1])).toBe(true);
    expect(pages[1]?.footer).toBe('');
    expect(pages[1]?.hasText).toBe(false);
  });
});

describe(
  'US-025 AC-5 the start of the body (decision 1; measured)',
  {timeout: 120_000},
  () => {
    it('US-025 AC-5: no cover, # One with h1 left: p. 1 blank (folio 1), p. 2 One', async () => {
      const {pages} = await compileBook('# One\n\nText.', {
        extra: withRules({h1: 'left'}),
      });
      expect(pages).toHaveLength(2);
      expect(isBlank(pages[0])).toBe(true);
      expect(pages[0]?.footer).toBe('1');
      expect(pages[1]?.text).toContain('One');
    });

    for (const rule of ['right', 'page'] as const) {
      it(`US-025 AC-5: no cover, # One with h1 ${rule}: nothing added`, async () => {
        const {pages} = await compileBook('# One\n\nText.', {
          extra: withRules({h1: rule}),
        });
        expect(pages).toHaveLength(1);
        expect(pages[0]?.text).toContain('One');
      });
    }

    it('US-025 AC-5: a cover, # One with h1 right: p. 2 blank (folio 1), p. 3 One (folio 2)', async () => {
      const {pages} = await compileBook('# One\n\nText.', {
        cover: 'cover',
        extra: withRules({h1: 'right'}),
      });
      expect(layout(pages)).toHaveLength(3);
      expect(pages[0]?.hasImage).toBe(true);
      expect(isBlank(pages[1])).toBe(true);
      expect(pages[1]?.footer).toBe('1');
      expect(pages[2]?.text).toContain('One');
      expect(pages[2]?.footer).toBe('2');
    });

    it('US-025 AC-5: a cover and its blank page, h1 right: p. 3 One (folio 1), nothing added', async () => {
      const {pages} = await compileBook('# One\n\nText.', {
        cover: 'blank',
        extra: withRules({h1: 'right'}),
      });
      expect(layout(pages)).toHaveLength(3);
      expect(pages[2]?.text).toContain('One');
      expect(pages[2]?.footer).toBe('1');
    });

    it('US-025 AC-5: a cover and its blank page, h1 left: p. 3 blank (folio 1), p. 4 One (folio 2)', async () => {
      const {pages} = await compileBook('# One\n\nText.', {
        cover: 'blank',
        extra: withRules({h1: 'left'}),
      });
      expect(layout(pages)).toHaveLength(4);
      expect(isBlank(pages[2])).toBe(true);
      expect(pages[2]?.footer).toBe('1');
      expect(pages[3]?.text).toContain('One');
      expect(pages[3]?.footer).toBe('2');
    });
  },
);

describe(
  'US-025 AC-6 blank pages print their folio only',
  {timeout: 120_000},
  () => {
    it('US-025 AC-6: every added page has its folio and no header; other pages keep their running header', async () => {
      const source = [
        '# One',
        '',
        '## A',
        '',
        filler(30),
        '',
        '# Two',
        '',
        '## C',
        '',
        filler(30),
        '',
        '# Three',
        '',
        'End.',
      ].join('\n');
      const {pages} = await compileBook(source, {
        extra: withRules({h1: 'right'}),
      });
      const added = pages.filter((p) => p.text.trim() === '' && !p.hasImage);
      expect(added.length, layout(pages).join('\n')).toBeGreaterThan(0);
      for (const page of added) {
        expect(page.header.trim()).toBe('');
        expect(page.footer).toBe(String(pages.indexOf(page) + 1));
      }
      // guard: the header reader sees running headers on continued pages
      const continued = pages.filter(
        (p) => p.text.trim() !== '' && p.header.trim() !== '',
      );
      expect(continued.length).toBeGreaterThan(0);
      expect(continued.map((p) => p.header.trim())).toContain('A');
    });
  },
);

describe(
  'US-025 AC-6 a break that falls at a page top (SCAR-021 sweep)',
  {timeout: 300_000},
  () => {
    it('US-025 AC-6: with the text before Two swept over a page edge, no added page prints a header', async () => {
      let added = 0;
      for (let n = 10; n <= 30; n++) {
        const source = `# One\n\n## A\n\n${filler(n)}\n\n# Two\n\nText two.`;
        const {pages} = await compileBook(source, {
          extra: withRules({h1: 'left'}),
        });
        for (const page of pages) {
          if (page.text.trim() !== '' || page.hasImage) continue;
          added++;
          expect(
            page.header.trim(),
            `n = ${n}\n${layout(pages).join('\n')}`,
          ).toBe('');
        }
      }
      expect(added).toBeGreaterThan(0);
    });
  },
);

describe('US-025 AC-8 the composed note (SCAR-002)', {timeout: 120_000}, () => {
  const COMPOSED = [
    '# Rules',
    '',
    'Intro with a link to [Tessera](#tessera) and a footnote[^1].',
    '',
    '## Tessera',
    '',
    'Tessera text.',
    '',
    '> [!note]',
    '> ## Boxed',
    '> Inside the box.',
    '',
    '# Combat',
    '',
    'Combat text, see [Action](#action).',
    '',
    '## Parry',
    '',
    'Parry text.',
    '',
    '# Glossary',
    '',
    '## Action',
    '',
    'An act.',
    '',
    '[^1]: The note text.',
  ].join('\n');
  const REFS = {linkPageNumbers: true, linkPageLevel: 3, linkPageWord: 'p.'};

  let book: CompiledBook;
  const compileComposed = async (): Promise<CompiledBook> =>
    (book ??= await compileBook(COMPOSED, {
      cover: 'blank',
      extra: withRules({h1: 'right', h2: 'page'}),
      over: REFS,
    }));

  it('US-025 AC-8: compiles and every text of the note is in the PDF', async () => {
    const {pages} = await compileComposed();
    const all = pages.map((p) => p.text).join(' ');
    for (const text of [
      'Intro with a link',
      'Tessera text.',
      'Boxed',
      'Inside the box.',
      'Combat text',
      'Parry text.',
      'Action',
      'An act.',
      'The note text.',
    ]) {
      expect(all, text).toContain(text);
    }
  });

  it('US-025 AC-8: the breaks hold: each H1 on a right (odd) page, each H2 at a page start', async () => {
    const {pages} = await compileComposed();
    for (const h1 of ['Rules', 'Combat', 'Glossary']) {
      const at = pages.findIndex((p) => p.text.includes(` ${h1}`)) + 1;
      expect(at % 2, `${h1} on p. ${at}\n${layout(pages).join('\n')}`).toBe(1);
    }
    // Tessera and Parry each start their page (no body text before them)
    for (const h2 of ['Tessera', 'Parry']) {
      const page = pages[pageOf(pages, `${h2} text.`) - 1];
      expect(page?.text.trimStart(), h2).toMatch(new RegExp(`^\\S+ ${h2}`));
    }
  });

  it('US-025 AC-8: the boxed heading and the glossary term do not break', async () => {
    const {pages} = await compileComposed();
    expect(pageOf(pages, 'Inside the box.')).toBe(
      pageOf(pages, 'Tessera text.'),
    );
    expect(pageOf(pages, 'An act.')).toBe(pageOf(pages, 'Glossary'));
  });

  it('US-025 AC-8: every page reference prints the folio of its target', async () => {
    const {pages} = await compileComposed();
    const all = pages.map((p) => p.text).join(' ');
    const refs = [...all.matchAll(/\(p\.\s*(\d+)\)/g)].map((m) => m[1]);
    const folioOf = (needle: string) =>
      pages[pageOf(pages, needle) - 1]?.footer;
    expect(refs).toEqual([folioOf('Tessera text.'), folioOf('An act.')]);
  });

  it('US-025 AC-8: every added page has its folio and no header', async () => {
    // h2 right as well: with h2 page the composed note needs no added page
    // (each H1 already falls on a right page), so the rule would not be reached.
    const {pages} = await compileBook(COMPOSED, {
      cover: 'blank',
      extra: withRules({h1: 'right', h2: 'right'}),
      over: REFS,
    });
    const added = pages
      .slice(2) // the cover and its blank page
      .filter((p) => p.text.trim() === '' && !p.hasImage);
    expect(added.length, layout(pages).join('\n')).toBeGreaterThan(0);
    for (const page of added) {
      expect(page.header.trim()).toBe('');
      expect(page.footer).not.toBe('');
    }
  });

  it('US-025 AC-8: the template hook keeps working (US-023)', async () => {
    const template = new TextEncoder().encode(
      '#let template(doc) = {\n  set page(fill: rgb("#fefcf0"))\n  doc\n}\n',
    );
    const {pages, typ} = await compileBook(COMPOSED, {
      cover: 'blank',
      extra: withRules({h1: 'right', h2: 'page'}),
      over: {...REFS, template: true, templateHook: true},
      files: {'template.typ': template},
    });
    expect(typ).toContain('#pagebreak(to: "odd", weak: true)');
    expect(pages.slice(1).every((p) => p.fills.includes('#fefcf0'))).toBe(true);
  });
});
