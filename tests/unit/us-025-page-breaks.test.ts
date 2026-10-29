// US-025 AC-1 to AC-6, AC-9 — page breaks by heading level in the core: the
// preset field `page.breakBefore` with its messages and merge, the three lines
// written before a breaking heading, which headings break, one break where
// rules meet, the first block of the body, the helper name `o2t-blank`, and
// every value at the tested levels. The PDF facts are in
// tests/integration/us-025-page-breaks-pdf.test.ts, the rows and the preview in
// tests/plugin/us-025-break-rows.test.ts.
// Source of truth: docs/user-stories/US-025-page-breaks-by-heading.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {type ConvertSettings} from '../../src/core/convert';
import {DEFAULT_COVER} from '../../src/core/cover';
import {
  effectiveSettings,
  formatPresetError,
  parsePreset,
  validateFields,
} from '../../src/core/presets';
import {PLUGIN_NAMES} from '../../src/core/template';
import {A5_PRINT, SETTINGS, run} from '../support/convert';

/** US-025: a rule per level, as `convert` reads it (absent today). */
type Rule = 'none' | 'page' | 'right' | 'left';
type Rules = Partial<Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', Rule>>;

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

/** Converts `source` with the break rules `rules`. */
const convertWith = (source: string, rules: Rules, facingPages = true) =>
  run(source, {
    settings: {
      ...SETTINGS,
      page: {...A5_PRINT, facingPages},
      breakBefore: rules,
    } as ConvertSettings,
  });

const BEFORE = '#metadata(none) <o2t-break-before>';
const AFTER = '#metadata(none) <o2t-break-after>';
const RIGHT = '#pagebreak(to: "odd", weak: true)';
const LEFT = '#pagebreak(to: "even", weak: true)';
const PAGE = '#pagebreak(weak: true)';

/** The three lines and the heading line, joined as written. */
const breakBefore = (pagebreak: string, heading: string): string =>
  [BEFORE, pagebreak, AFTER, heading].join('\n');

/** The page breaks of `typ`, in order. */
const breaks = (typ: string): string[] =>
  typ.split('\n').filter((line) => line.startsWith('#pagebreak('));

/** The body: everything after the preamble (from the first heading line). */
const bodyOf = (typ: string): string =>
  typ.slice(typ.search(/^(=|#metadata\(none\) <o2t-break-before>)/m));

const TWO_CHAPTERS = '# One\n\n## A\n\nText.\n\n# Two\n\n## C\n\nText.';

describe('US-025 AC-1 the field page.breakBefore', () => {
  it('US-025 AC-1: reads h1 to h6 with each of none, page, right, left', () => {
    const result = parsePreset(
      note(
        'page:',
        '  breakBefore:',
        '    h1: right',
        '    h2: page',
        '    h3: left',
        '    h4: none',
        '    h5: page',
        '    h6: right',
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.page).toEqual({
      breakBefore: {
        h1: 'right',
        h2: 'page',
        h3: 'left',
        h4: 'none',
        h5: 'page',
        h6: 'right',
      },
    });
  });

  it('US-025 AC-1: refuses another value with the message of the story (line 5)', () => {
    expect(errorOf('page:', '  breakBefore:', '    h1: spread')).toBe(
      'page.breakBefore.h1 must be none, page, right or left (line 5)',
    );
    expect(errorOf('page:', '  breakBefore:', '    h1: Right')).toBe(
      'page.breakBefore.h1 must be none, page, right or left (line 5)',
    );
    expect(errorOf('page:', '  breakBefore:', '    h1: 1')).toBe(
      'page.breakBefore.h1 must be none, page, right or left (line 5)',
    );
  });

  it('US-025 AC-1: refuses an unknown key (h7, chapter, 1) with its line', () => {
    expect(
      errorOf('page:', '  breakBefore:', '    h1: right', '    h7: page'),
    ).toBe('page.breakBefore has no key "h7" (line 6)');
    expect(errorOf('page:', '  breakBefore:', '    chapter: page')).toBe(
      'page.breakBefore has no key "chapter" (line 5)',
    );
    expect(errorOf('page:', '  breakBefore:', '    1: page')).toBe(
      'page.breakBefore has no key "1" (line 5)',
    );
  });

  it('US-025 AC-1: the Defaults may hold the field; their message has no line', () => {
    const ok = validateFields({page: {breakBefore: {h1: 'right'}}});
    expect(ok.ok && ok.fields.page).toEqual({breakBefore: {h1: 'right'}});
    expect(validateFields({page: {breakBefore: {h2: 'odd'}}})).toEqual({
      ok: false,
      error: {
        message: 'page.breakBefore.h2 must be none, page, right or left',
        line: null,
      },
    });
  });

  it('US-025 AC-1: merges key by key: a preset with h2 keeps the Defaults h1; missing keys are none', () => {
    const parsed = parsePreset(note('page:', '  breakBefore:', '    h2: page'));
    if (!parsed.ok) throw new Error('valid');
    const result = effectiveSettings(
      parsed,
      {page: {breakBefore: {h1: 'right', h2: 'left'}}} as never,
      () => false,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      (result.settings as unknown as {breakBefore: Rules}).breakBefore,
    ).toEqual({
      h1: 'right',
      h2: 'page',
      h3: 'none',
      h4: 'none',
      h5: 'none',
      h6: 'none',
    });
  });

  it('US-025 AC-1: no field anywhere means none for every level', () => {
    const plain = effectiveSettings({fields: {}, lines: {}}, {}, () => false);
    expect(plain.ok).toBe(true);
    if (!plain.ok) return;
    expect(
      (plain.settings as unknown as {breakBefore: Rules}).breakBefore,
    ).toEqual({
      h1: 'none',
      h2: 'none',
      h3: 'none',
      h4: 'none',
      h5: 'none',
      h6: 'none',
    });
  });
});

describe('US-025 AC-2 what is written', () => {
  it('US-025 AC-2: right writes the three lines before the heading line (the example of the story)', async () => {
    const {typ} = await convertWith(TWO_CHAPTERS, {h1: 'right'});
    expect(typ).toContain(breakBefore(RIGHT, '= Two <h-two>'));
  });

  it('US-025 AC-2: left writes to: "even", page writes a plain weak break', async () => {
    expect((await convertWith(TWO_CHAPTERS, {h1: 'left'})).typ).toContain(
      breakBefore(LEFT, '= Two <h-two>'),
    );
    expect((await convertWith(TWO_CHAPTERS, {h1: 'page'})).typ).toContain(
      breakBefore(PAGE, '= Two <h-two>'),
    );
  });

  it('US-025 AC-2: with facing pages off every rule writes the plain weak break', async () => {
    for (const rule of ['page', 'right', 'left'] as const) {
      const {typ} = await convertWith(TWO_CHAPTERS, {h1: rule}, false);
      expect(typ, rule).toContain(breakBefore(PAGE, '= Two <h-two>'));
      expect(typ, rule).not.toContain('to: "odd"');
      expect(typ, rule).not.toContain('to: "even"');
    }
  });

  it('US-025 AC-2, AC-5: h1 right breaks before both chapters (the first one too, decision 1)', async () => {
    const {typ} = await convertWith(TWO_CHAPTERS, {h1: 'right'});
    expect(breaks(typ)).toEqual([RIGHT, RIGHT]);
    expect(typ).toContain(breakBefore(RIGHT, '= One <h-one>'));
  });

  it('US-025 AC-2 guard: none (and no field) writes nothing; the output is as today', async () => {
    const today = (await run(TWO_CHAPTERS)).typ;
    const none = (await convertWith(TWO_CHAPTERS, {h1: 'none', h2: 'none'}))
      .typ;
    expect(none).toBe(today);
    expect(today).not.toContain('o2t-break');
    expect(breaks(today)).toEqual([]);
  });
});

describe('US-025 AC-3 which headings break', () => {
  it('US-025 AC-3: no break before a glossary term; the glossary heading breaks by its level', async () => {
    const {typ} = await convertWith(
      '# Rules\n\nText.\n\n# Glossary\n\n## Action\n\nAn act.\n\n## Bash\n\nA blow.',
      {h1: 'page', h2: 'page'},
    );
    expect(typ).toContain(breakBefore(PAGE, '= Glossary <h-glossary>'));
    expect(breaks(typ)).toHaveLength(2); // Rules (first block) and Glossary
    expect(typ).not.toMatch(/o2t-break-after>\n#glossary-term/);
  });

  it('US-025 AC-3: no break before a heading in a callout, a quote or a list item', async () => {
    const {typ} = await convertWith(
      [
        'Intro.',
        '',
        '> [!note]',
        '> ## Boxed',
        '> Inside.',
        '',
        '> ## Quoted',
        '',
        '- item',
        '',
        '  ## Listed',
      ].join('\n'),
      {h2: 'right'},
    );
    expect(breaks(typ)).toEqual([]);
    expect(typ).toContain('== Boxed <h-boxed>');
  });

  it('US-025 AC-3: no break for an empty heading (US-002 AC-7)', async () => {
    const {typ} = await convertWith('Intro.\n\n#\n\nText.', {h1: 'page'});
    expect(breaks(typ)).toEqual([]);
  });

  it('US-025 AC-3: a heading inside a glossary term (h3 under a term) does not break', async () => {
    const {typ} = await convertWith(
      '# Glossary\n\n## Action\n\nAn act.\n\n### Detail\n\nMore.',
      {h3: 'page'},
    );
    expect(breaks(typ)).toEqual([]);
  });
});

describe('US-025 AC-4 one break where rules meet', () => {
  const ADJACENT = 'Intro.\n\n# Two\n\n## C\n\nText.';
  const cases: [Rules, string][] = [
    [{h1: 'right', h2: 'page'}, RIGHT],
    [{h1: 'page', h2: 'right'}, RIGHT],
    [{h1: 'right', h2: 'left'}, RIGHT],
    [{h1: 'none', h2: 'left'}, LEFT],
  ];
  for (const [rules, written] of cases) {
    it(`US-025 AC-4: ${JSON.stringify(rules)} writes ${written} before Two and nothing before C`, async () => {
      const {typ} = await convertWith(ADJACENT, rules);
      expect(breaks(typ)).toEqual([written]);
      expect(typ).toContain(breakBefore(written, '= Two <h-two>'));
      expect(typ).toMatch(/= Two <h-two>\n+== C <h-c>/);
    });
  }

  it('US-025 AC-4: a block between the headings gives each its own break', async () => {
    const {typ} = await convertWith(
      'Intro.\n\n# Two\n\nText.\n\n## C\n\nMore.',
      {
        h1: 'right',
        h2: 'page',
      },
    );
    expect(breaks(typ)).toEqual([RIGHT, PAGE]);
  });
});

describe('US-025 AC-5 the start of the body (decision 1)', () => {
  it('US-025 AC-5: a note that starts with an H1 set to left gets the break before its first block', async () => {
    const {typ} = await convertWith('# One\n\nText.', {h1: 'left'});
    expect(bodyOf(typ).startsWith(breakBefore(LEFT, '= One <h-one>'))).toBe(
      true,
    );
  });

  it('US-025 AC-5: after a cover the first heading breaks too (the break comes after the cover pages)', async () => {
    const {typ} = await run('![](assets/map.png)\n\n# One\n\nText.', {
      settings: {
        ...SETTINGS,
        cover: {...DEFAULT_COVER, blankPageAfter: false},
        breakBefore: {h1: 'right'},
      } as ConvertSettings,
    });
    const update = typ.indexOf('#counter(page).update(1)');
    const first = typ.indexOf(BEFORE);
    expect(update).toBeGreaterThan(-1);
    expect(first).toBeGreaterThan(update);
    expect(typ).toContain(breakBefore(RIGHT, '= One <h-one>'));
  });
});

describe('US-025 AC-6 the blank-page test in the furniture', () => {
  it('US-025 AC-6: o2t-blank is a plugin name (US-016 AC-11)', () => {
    expect(PLUGIN_NAMES).toContain('o2t-blank');
  });

  it('US-025 AC-6: with folios and a rule the furniture defines o2t-blank and the header asks it', async () => {
    const {typ} = await run(TWO_CHAPTERS, {
      settings: {
        ...SETTINGS,
        breakBefore: {h1: 'right'},
        pageFurniture: {
          folios: true,
          runningHeader: true,
          runningHeaderLevel: 2,
        },
      } as ConvertSettings,
    });
    expect(typ).toMatch(/^#let o2t-blank\(p\)/m);
    const pageRule = typ
      .split('\n')
      .find((line) => line.startsWith('#set page(numbering:'));
    expect(pageRule).toContain('o2t-blank(');
  });

  it('US-025 AC-6 guard: without a rule the furniture is as today (no o2t-blank)', async () => {
    const {typ} = await run(TWO_CHAPTERS, {
      settings: {
        ...SETTINGS,
        pageFurniture: {
          folios: true,
          runningHeader: true,
          runningHeaderLevel: 2,
        },
      } as ConvertSettings,
    });
    expect(typ).not.toContain('o2t-blank');
  });
});

describe('US-025 AC-9 settings at their values (SCAR-019)', () => {
  const written: Record<Rule, string | null> = {
    none: null,
    page: PAGE,
    right: RIGHT,
    left: LEFT,
  };
  for (const level of [1, 2, 3, 6]) {
    for (const rule of ['none', 'page', 'right', 'left'] as const) {
      for (const facing of [true, false]) {
        it(`US-025 AC-9: h${level} ${rule}, facing pages ${facing ? 'on' : 'off'}`, async () => {
          const hashes = '#'.repeat(level);
          const source = `Intro.\n\n${hashes} Target\n\nText.`;
          const {typ} = await convertWith(
            source,
            {[`h${level}`]: rule} as Rules,
            facing,
          );
          const heading = `${'='.repeat(level)} Target <h-target>`;
          const expected = facing
            ? written[rule]
            : rule === 'none'
              ? null
              : PAGE;
          if (expected === null) {
            expect(breaks(typ)).toEqual([]);
          } else {
            expect(typ).toContain(breakBefore(expected, heading));
            expect(breaks(typ)).toEqual([expected]);
          }
        });
      }
    }
  }
});

describe('US-025 one writer of page breaks (SCAR-017)', () => {
  /** Every .ts file below `dir`. */
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory()
        ? sources(path)
        : path.endsWith('.ts')
          ? [path]
          : [];
    });

  it('US-025 AC-2: only src/core/emit/breaks.ts writes #pagebreak( (counted over every source file)', () => {
    const files = sources('src');
    expect(files.length).toBeGreaterThan(50);
    const writers = files.filter((file) =>
      readFileSync(file, 'utf8').includes('#pagebreak('),
    );
    expect(writers).toEqual([join('src', 'core', 'emit', 'breaks.ts')]);
  });
});
