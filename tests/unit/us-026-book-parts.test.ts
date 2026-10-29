// US-026 AC-1, AC-2, AC-8, AC-9, AC-11 — book parts in the core: the rule
// names `colophon` and `back-notes` with the built-in mapping and the new
// message, which sections become parts and where their blocks go, the hidden
// heading with its label kept, several parts joined and an empty part left out
// with their warnings, the `book` fields with their messages and built-in
// values, and the sample vault's colophon and back notes. The pages are in
// tests/integration/us-026-book-parts-pdf.test.ts, the rows and the preview in
// tests/plugin/us-026-book-rows.test.ts.
// Source of truth: docs/user-stories/US-026-book-parts-and-signatures.md.
import {describe, expect, it} from 'vitest';
import {type ConvertSettings} from '../../src/core/convert';
import * as markers from '../../src/core/markers';
import {
  effectiveSettings,
  formatPresetError,
  parsePreset,
  validateFields,
} from '../../src/core/presets';
import {SETTINGS, run} from '../support/convert';
import {readSample} from '../support/sample';

/** US-026: the book settings as `convert` reads them (absent today). */
interface Book {
  signature?: 0 | 4 | 8 | 16 | 32;
  romanFrontMatter?: boolean;
  firstChapter?: 'left' | 'right';
  colophonHeading?: 'hidden' | 'printed';
  backNotesHeading?: 'hidden' | 'printed';
}

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

/** Converts `source` with `book` and heading rules `rules`. */
const convertWith = (
  source: string,
  book: Book = {},
  rules?: Record<string, string>,
) =>
  run(source, {
    settings: {
      ...SETTINGS,
      book,
      ...(rules === undefined ? {} : {headingRules: rules}),
    } as ConvertSettings,
  });

/** The position of `needle` in `typ`; fails when it is not there. */
function at(typ: string, needle: string): number {
  const found = typ.indexOf(needle);
  expect(found, `${needle} in the output`).toBeGreaterThan(-1);
  return found;
}

const BOOK = [
  '# Rules',
  '',
  'Body text.',
  '',
  '# Colophon',
  '',
  'Printed in 2026.',
  '',
  '## Credits',
  '',
  'All of us.',
  '',
  '# More',
  '',
  'More text.',
  '',
  '# Back notes',
  '',
  'Note text.',
].join('\n');

describe('US-026 AC-1 the rule names and the built-in mapping (decision 2)', () => {
  it('US-026 AC-1: the rule names are glossary, colophon, back-notes and none', () => {
    expect([...markers.HEADING_RULE_NAMES].sort()).toEqual(
      ['back-notes', 'colophon', 'glossary', 'none'].sort(),
    );
  });

  it('US-026 AC-1: the built-in mapping adds Colophon and Back notes to Glossary', () => {
    expect(markers.BUILTIN_HEADING_RULES).toEqual({
      Glossary: 'glossary',
      Colophon: 'colophon',
      'Back notes': 'back-notes',
    });
  });

  it('US-026 AC-1: a preset may map its own words; another value gets the new message', () => {
    const ok = parsePreset(
      note(
        'headingRules:',
        '  Impressum: colophon',
        '  Notes for the table: back-notes',
      ),
    );
    expect(ok.ok && ok.fields.headingRules).toEqual({
      Impressum: 'colophon',
      'Notes for the table': 'back-notes',
    });
    expect(errorOf('headingRules:', '  Impressum: backnotes')).toBe(
      'headingRules.Impressum must be a rule name: glossary, colophon, back-notes or none (line 4)',
    );
  });
});

describe('US-026 AC-1 which sections are parts and where they go', () => {
  it('US-026 AC-1: the colophon (with its sub-heading) moves before the body', async () => {
    const {typ} = await convertWith(BOOK);
    expect(at(typ, 'Printed in 2026.')).toBeLessThan(
      at(typ, '= Rules <h-rules>'),
    );
    expect(at(typ, 'All of us.')).toBeLessThan(at(typ, '= Rules <h-rules>'));
    expect(at(typ, 'More text.')).toBeGreaterThan(at(typ, 'Body text.'));
  });

  it('US-026 AC-1: the back notes move after the last block of the body', async () => {
    const {typ} = await convertWith(
      '# Rules\n\nBody text.\n\n# Back notes\n\nNote text.\n\n# More\n\nMore text.',
    );
    expect(at(typ, 'Note text.')).toBeGreaterThan(at(typ, 'More text.'));
  });

  it('US-026 AC-1: a preset mapping marks its own headings', async () => {
    const {typ} = await convertWith(
      '# Rules\n\nBody text.\n\n# Impressum\n\nPrinted.\n\n# Notes for the table\n\nNote.\n\n# Last\n\nLast text.',
      {},
      {Impressum: 'colophon', 'Notes for the table': 'back-notes'},
    );
    expect(at(typ, 'Printed.')).toBeLessThan(at(typ, 'Body text.'));
    expect(at(typ, 'Note.')).toBeGreaterThan(at(typ, 'Last text.'));
  });

  it('US-026 AC-1: Colophon: none switches the built-in off; the section stays where it is', async () => {
    const {typ} = await convertWith(BOOK, {}, {Colophon: 'none'});
    expect(typ).toContain('= Colophon <h-colophon>');
    expect(at(typ, 'Printed in 2026.')).toBeGreaterThan(at(typ, 'Body text.'));
  });

  it('US-026 AC-1: a Colophon heading in a callout or a glossary section marks no part', async () => {
    const boxed = await convertWith(
      '# Rules\n\nBody.\n\n> [!note]\n> # Colophon\n> Inside.',
    );
    expect(at(boxed.typ, 'Inside.')).toBeGreaterThan(at(boxed.typ, 'Body.'));
    const term = await convertWith(
      '# Rules\n\nBody.\n\n# Glossary\n\n## Colophon\n\nA term.',
    );
    expect(term.typ).toContain('#glossary-term[Colophon]');
    expect(at(term.typ, 'A term.')).toBeGreaterThan(at(term.typ, 'Body.'));
  });

  it('US-026 AC-1 guard: a note without parts converts as today (the book settings change nothing)', async () => {
    const source = '# Rules\n\nBody text.\n\n# More\n\nMore text.';
    expect((await convertWith(source, {signature: 0})).typ).toBe(
      (await run(source)).typ,
    );
  });
});

describe('US-026 AC-2 the printed heading (decision 4)', () => {
  it('US-026 AC-2: hidden (the built-in): no heading line, the label kept on a marker', async () => {
    const {typ} = await convertWith(BOOK);
    expect(typ).not.toContain('= Colophon');
    expect(typ).not.toContain('= Back notes');
    expect(typ).toContain('#metadata(none) <h-colophon>');
    expect(typ).toContain('#metadata(none) <h-back-notes>');
  });

  it('US-026 AC-2: printed: the heading is written as today', async () => {
    const {typ} = await convertWith(BOOK, {
      colophonHeading: 'printed',
      backNotesHeading: 'printed',
    });
    expect(typ).toContain('= Colophon <h-colophon>');
    expect(typ).toContain('= Back notes <h-back-notes>');
    expect(typ).not.toContain('#metadata(none) <h-colophon>');
  });

  it('US-026 AC-2: a link to a hidden part still resolves (no LINK_UNRESOLVED)', async () => {
    const {typ, warnings} = await convertWith(
      `${BOOK}\n\nSee [the colophon](#colophon).`,
    );
    expect(warnings.map((w) => w.code)).not.toContain('LINK_UNRESOLVED');
    expect(typ).toContain('#link(<h-colophon>)');
  });
});

describe('US-026 AC-3, AC-5 a US-025 rule on a printed part heading (decision 5)', () => {
  const PRINTED = {colophonHeading: 'printed', backNotesHeading: 'printed'};
  const RIGHT = '#pagebreak(to: "odd", weak: true)';

  /** The lines between the end of `after` and the start of `heading`. */
  const between = (typ: string, after: string, heading: string): string =>
    typ.slice(at(typ, after) + after.length, at(typ, heading));

  for (const signature of [0, 8] as const) {
    it(`US-026 decision 5: with h1: right the printed back notes get no US-025 break (signature ${signature})`, async () => {
      const {typ} = await run(BOOK, {
        settings: {
          ...SETTINGS,
          book: {...PRINTED, signature},
          breakBefore: {h1: 'right'},
        } as ConvertSettings,
      });
      // The other side in effect (SCAR-023): a body H1 keeps its rule.
      expect(between(typ, 'Body text.', '= More <h-more>')).toContain(RIGHT);
      expect(
        between(typ, 'More text.', '= Back notes <h-back-notes>'),
      ).not.toContain('#pagebreak(to:');
    });
  }

  it('US-026 decision 5: with h1: left the printed colophon gets no US-025 break', async () => {
    const {typ} = await run(BOOK, {
      settings: {
        ...SETTINGS,
        book: PRINTED,
        breakBefore: {h1: 'left'},
      } as ConvertSettings,
    });
    expect(typ.slice(0, at(typ, '= Colophon <h-colophon>'))).not.toContain(
      '#pagebreak(',
    );
    expect(between(typ, 'Body text.', '= More <h-more>')).toContain(
      '#pagebreak(to: "even", weak: true)',
    );
  });
});

describe('US-026 AC-3 text before the first H1 (decision 7)', () => {
  // The chapter lines end with the counter reset (TICKET-079, measured F1).
  const CHAPTER_START = '#counter(page).update(1)';

  it('US-026 decision 7: text before the first H1 follows the colophon in the front matter; the chapter starts at the H1', async () => {
    const {typ} = await convertWith(
      'Intro text.\n\n# Colophon\n\nPrinted.\n\n# Rules\n\nBody text.',
    );
    const start = at(typ, CHAPTER_START);
    expect(at(typ, 'Printed.')).toBeLessThan(at(typ, 'Intro text.'));
    expect(at(typ, 'Intro text.')).toBeLessThan(start);
    expect(start).toBeLessThan(at(typ, '= Rules <h-rules>'));
  });

  it('US-026 decision 7: with no H1 in the body the chapter starts at its first block', async () => {
    const {typ} = await convertWith(
      'Body text.\n\n## Section\n\nMore text.\n\n# Colophon\n\nPrinted.',
    );
    const start = at(typ, CHAPTER_START);
    expect(at(typ, 'Printed.')).toBeLessThan(start);
    expect(start).toBeLessThan(at(typ, 'Body text.'));
  });
});

describe('US-026 AC-8 several parts of one kind, an empty part (decision 3)', () => {
  it('US-026 AC-8: two colophon sections are joined in note order with BOOK_PART_JOINED at the second heading', async () => {
    const source = [
      '# Colophon', // line 1
      '',
      'First part.',
      '',
      '# Rules',
      '',
      'Body.',
      '',
      '# Impressum', // line 9
      '',
      'Second part.',
    ].join('\n');
    const {typ, warnings} = await convertWith(
      source,
      {},
      {
        Impressum: 'colophon',
      },
    );
    expect(at(typ, 'First part.')).toBeLessThan(at(typ, 'Second part.'));
    expect(at(typ, 'Second part.')).toBeLessThan(at(typ, 'Body.'));
    expect(warnings).toContainEqual({
      code: 'BOOK_PART_JOINED',
      message:
        'The colophon section "Impressum" is joined to the colophon above',
      line: 9,
    });
  });

  it('US-026 AC-8: two back-notes sections are joined with the back-notes text', async () => {
    const {warnings} = await convertWith(
      '# Rules\n\nBody.\n\n# Back notes\n\nA.\n\n# Notes\n\nB.',
      {},
      {Notes: 'back-notes'},
    );
    expect(warnings).toContainEqual({
      code: 'BOOK_PART_JOINED',
      message:
        'The back-notes section "Notes" is joined to the back notes above',
      line: 9,
    });
  });

  it('US-026 AC-8: an empty part with a hidden heading is left out with BOOK_PART_EMPTY', async () => {
    const {typ, warnings} = await convertWith('# Colophon\n\n# Rules\n\nBody.');
    expect(warnings).toContainEqual({
      code: 'BOOK_PART_EMPTY',
      message: 'The colophon section "Colophon" is empty and is left out',
      line: 1,
    });
    expect(typ).not.toContain('<h-colophon>');
  });

  it('US-026 AC-8: a link to a part left out is its text with LINK_UNRESOLVED (the Typst stays valid)', async () => {
    const {typ, warnings} = await convertWith(
      '# Colophon\n\n# Rules\n\nSee [the colophon](#colophon).',
    );
    expect(warnings).toContainEqual({
      code: 'LINK_UNRESOLVED',
      message: 'No heading matches "#colophon"',
      line: 5,
    });
    expect(typ).toContain('See the colophon');
    expect(typ).not.toContain('<h-colophon>');
  });

  it('US-026 AC-8 guard: an empty part with a printed heading is kept and gets no warning', async () => {
    const {typ, warnings} = await convertWith(
      '# Colophon\n\n# Rules\n\nBody.',
      {
        colophonHeading: 'printed',
      },
    );
    expect(warnings.map((w) => w.code)).not.toContain('BOOK_PART_EMPTY');
    expect(typ).toContain('= Colophon <h-colophon>');
  });
});

describe('US-026 AC-9 the book fields (SCAR-019)', () => {
  it('US-026 AC-9: reads every field at each of its values', () => {
    for (const signature of [0, 4, 8, 16, 32]) {
      expect(
        errorOf('book:', `  signature: ${signature}`),
        `${signature}`,
      ).toBeNull();
    }
    for (const value of ['true', 'false']) {
      expect(errorOf('book:', `  romanFrontMatter: ${value}`)).toBeNull();
    }
    for (const side of ['left', 'right']) {
      expect(errorOf('book:', `  firstChapter: ${side}`)).toBeNull();
    }
    for (const choice of ['hidden', 'printed']) {
      expect(errorOf('book:', `  colophonHeading: ${choice}`)).toBeNull();
      expect(errorOf('book:', `  backNotesHeading: ${choice}`)).toBeNull();
    }
    const result = parsePreset(
      note('book:', '  signature: 8', '  firstChapter: right'),
    );
    expect(result.ok && result.fields).toMatchObject({
      book: {signature: 8, firstChapter: 'right'},
    });
  });

  it('US-026 AC-9: refuses each invalid value with its message and line', () => {
    const cases: [string, string][] = [
      ['  signature: 12', 'book.signature must be 0, 4, 8, 16 or 32 (line 4)'],
      ['  signature: "8"', 'book.signature must be 0, 4, 8, 16 or 32 (line 4)'],
      [
        '  romanFrontMatter: yes',
        'book.romanFrontMatter must be true or false (line 4)',
      ],
      [
        '  firstChapter: odd',
        'book.firstChapter must be left or right (line 4)',
      ],
      [
        '  colophonHeading: shown',
        'book.colophonHeading must be hidden or printed (line 4)',
      ],
      [
        '  backNotesHeading: none',
        'book.backNotesHeading must be hidden or printed (line 4)',
      ],
    ];
    for (const [line, message] of cases) {
      expect(errorOf('book:', line), line).toBe(message);
    }
  });

  it('US-026 AC-9: the Defaults may hold the fields; their message has no line', () => {
    const ok = validateFields({book: {signature: 16}});
    expect(ok.ok && ok.fields).toEqual({book: {signature: 16}});
    expect(validateFields({book: {signature: 3}})).toEqual({
      ok: false,
      error: {message: 'book.signature must be 0, 4, 8, 16 or 32', line: null},
    });
  });

  it('US-026 AC-9: built-in values: signature 0, roman off, first chapter left, both headings hidden; preset over Defaults', () => {
    const plain = effectiveSettings({fields: {}, lines: {}}, {}, () => false);
    expect(
      plain.ok && (plain.settings as unknown as {book: Book}).book,
    ).toEqual({
      signature: 0,
      romanFrontMatter: false,
      firstChapter: 'left',
      colophonHeading: 'hidden',
      backNotesHeading: 'hidden',
    });
    const parsed = parsePreset(note('book:', '  signature: 8'));
    if (!parsed.ok) throw new Error('valid');
    const merged = effectiveSettings(
      parsed,
      {book: {signature: 4, romanFrontMatter: true}} as never,
      () => false,
    );
    expect(
      merged.ok && (merged.settings as unknown as {book: Book}).book,
    ).toMatchObject({
      signature: 8,
      romanFrontMatter: true,
    });
  });
});

describe('US-026 AC-11 the sample vault (US-024)', () => {
  it('US-026 AC-11: the sample preset maps a colophon and a back-notes heading that Book.md has at the top level', () => {
    const preset = parsePreset(readSample('presets/Sample.md'));
    if (!preset.ok) throw new Error('the sample preset is valid');
    const rules = Object.entries(preset.fields.headingRules ?? {});
    const colophon = rules.find(([, rule]) => (rule as string) === 'colophon');
    const backNotes = rules.find(
      ([, rule]) => (rule as string) === 'back-notes',
    );
    expect(colophon, 'a colophon rule').toBeDefined();
    expect(backNotes, 'a back-notes rule').toBeDefined();
    const book = readSample('Book.md').split('\n');
    expect(book).toContain(`# ${colophon?.[0] ?? ''}`);
    expect(book).toContain(`# ${backNotes?.[0] ?? ''}`);
  });
});
