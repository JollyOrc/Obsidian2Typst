// US-008 — presets: precedence, parsing, validation, effective settings, names,
// template scan and numbering check (unit, pure core). Source of truth:
// docs/user-stories/US-008-presets-and-settings.md. The vault store is in
// tests/plugin/us-008-preset-store.test.ts, data.json in us-008-plugin-data,
// the export command in us-008-export-command; facts about Typst itself
// (numbering symbols, standard-library names) are proven against the compiler
// in tests/integration/us-008-typst-facts.test.ts.
import {DEFAULT_FONTS} from '../../src/core/fonts';
import {describe, expect, it} from 'vitest';
import {
  BUILTIN_DEFAULTS,
  BUILTIN_PRESET_TEXTS,
  COUNTING_SYMBOLS,
  PRESET_FIELDS,
  SCHEMA_VERSION,
  copyName,
  effectiveSettings,
  emptyPresetText,
  formatPresetError,
  isValidNumbering,
  parsePreset,
  pickActive,
  planDelete,
  resolveFields,
  sortPresetNames,
  validateFields,
  validatePresetName,
  type ParseResult,
  type PresetFields,
} from '../../src/core/presets';
import {
  STD_NAMES,
  missingTemplateWarning,
  scanTemplate,
  templateWarnings,
} from '../../src/core/template';
import {
  BUILTIN_PAGE_PRESETS,
  resolvePageSetup,
} from '../../src/core/layout/page-setup';
import {run} from '../support/convert';

/** The parsed preset of `text`; the test fails if it is invalid. */
function ok(text: string): Extract<ParseResult, {ok: true}> {
  const result = parsePreset(text);
  if (!result.ok) throw new Error(formatPresetError(result.error));
  return result;
}

const note = (yaml: string, body = ''): string => `---\n${yaml}\n---\n${body}`;

const EXAMPLE = [
  '---', // 1
  'schemaVersion: 1', // 2
  'page:', // 3
  '  trimWidth: 148', // 4
  '  trimHeight: 210', // 5
  '  bleed: 3', // 6
  'highlightColor: "#ffeb3b"', // 7
  '---', // 8
  'Print edition for the printer in Berlin.', // 9
].join('\n');

describe('US-008 AC-1 precedence of preset, Defaults and built-ins', () => {
  it('US-008 AC-1: the built-in defaults are the ones of the story', () => {
    expect(BUILTIN_DEFAULTS).toEqual({
      highlightColor: '#ffeb3b',
      headingNumbering: '1.1',
      externalLinkFootnotes: true,
      linkPageNumbers: true,
      linkPageLevel: 2,
      linkPageWord: 'p.',
      template: null,
      page: {
        trimSize: 'A5',
        margins: {top: 18, bottom: 22, inside: 15, outside: 15},
        gutter: 5,
        bleed: 0,
        slug: 0,
        facingPages: true,
        // US-019 AC-1: the page furniture.
        folios: true,
        runningHeader: true,
        runningHeaderLevel: 2,
      },
    });
  });

  it('US-008 AC-1: resolves preset value, else Defaults, else built-in (highlight colour example)', () => {
    expect(resolveFields({}, {}).highlightColor).toBe('#ffeb3b');
    expect(resolveFields({}, {highlightColor: '#a5d6a7'}).highlightColor).toBe(
      '#a5d6a7',
    );
    expect(
      resolveFields({highlightColor: '#ffffff'}, {highlightColor: '#a5d6a7'})
        .highlightColor,
    ).toBe('#ffffff');
  });

  it('US-008 AC-1: merges page settings field by field, margins too', () => {
    const merged = resolveFields(
      {page: {bleed: 5, margins: {top: 20}}},
      {page: {trimSize: 'A4', margins: {bottom: 30}}},
    );
    expect(merged.page).toEqual({
      trimSize: 'A4',
      margins: {top: 20, bottom: 30, inside: 15, outside: 15},
      gutter: 5,
      bleed: 5,
      slug: 0,
      facingPages: true,
    });
  });

  it('US-008 AC-1: the preset wins over the Defaults for page fields and margins that both set', () => {
    const merged = resolveFields(
      {page: {bleed: 5, margins: {top: 20}, trimSize: 'A6'}},
      {page: {bleed: 2, margins: {top: 30, bottom: 31}, trimSize: 'A4'}},
    );
    expect(merged.page.bleed).toBe(5);
    expect(merged.page.trimSize).toBe('A6');
    expect(merged.page.margins).toEqual({
      top: 20,
      bottom: 31,
      inside: 15,
      outside: 15,
    });
  });

  it('US-008 AC-1: a field that is null in the note is not set, so the Defaults apply', () => {
    const preset = ok(note('highlightColor: null\nheadingNumbering: null'));
    expect(preset.fields).toEqual({});
    expect(
      resolveFields(preset.fields, {headingNumbering: 'a.1'}).headingNumbering,
    ).toBe('a.1');
  });

  it('US-008 AC-1: treats strict mode and the warnings note folder as global, not preset fields', () => {
    // US-026 AC-9: the book group is a preset field (TICKET-079); US-027
    // AC-1: the toc group too (TICKET-083); US-028 AC-1: the images group
    // (TICKET-089).
    expect([...PRESET_FIELDS].sort()).toEqual([
      'book',
      'callouts',
      'cover',
      'externalLinkFootnotes',
      'fonts',
      'group',
      'headingNumbering',
      'headingRules',
      'highlightColor',
      'images',
      'linkPageLevel',
      'linkPageNumbers',
      'linkPageWord',
      'page',
      'template',
      'toc',
    ]);
    const preset = ok(
      note(
        'strictMode: true\nwarningsNoteFolder: Reports\nhighlightColor: "#000000"',
      ),
    );
    expect(preset.fields).toEqual({highlightColor: '#000000'});
    const effective = effectiveSettings(preset, {}, () => false);
    // US-025 AC-1, US-026 AC-9, US-027 AC-1, US-028 AC-1: the break rules,
    // the book, the contents and the image fit settings are effective
    // settings too.
    expect(effective.ok && Object.keys(effective.settings).sort()).toEqual([
      'book',
      'breakBefore',
      'callouts',
      'cover',
      'externalLinkFootnotes',
      'fonts',
      'headingNumbering',
      'headingRules',
      'highlightColor',
      'images',
      'linkPageLevel',
      'linkPageNumbers',
      'linkPageWord',
      'page',
      'pageFurniture',
      'template',
      'toc',
    ]);
  });

  it('US-008 AC-1: does not change the preset, the Defaults or the built-ins', () => {
    const preset: PresetFields = {page: {margins: {top: 1}}};
    const defaults: PresetFields = {page: {bleed: 2}};
    const before = JSON.stringify([preset, defaults, BUILTIN_DEFAULTS]);
    resolveFields(preset, defaults);
    expect(JSON.stringify([preset, defaults, BUILTIN_DEFAULTS])).toBe(before);
  });
});

describe('US-008 AC-2 a preset is a Markdown note', () => {
  it('US-008 AC-2: parses a preset note: frontmatter is the settings, body is ignored, name is the file name', () => {
    const result = ok(EXAMPLE);
    expect(result.fields).toEqual({
      page: {trimWidth: 148, trimHeight: 210, bleed: 3},
      highlightColor: '#ffeb3b',
    });
    expect(result.notices).toEqual([]);
    const withBody = ok(
      `${EXAMPLE}\n---\nbleed: 99\nhighlightColor: "#000000"\n---\n`,
    );
    expect(withBody.fields).toEqual(result.fields);
  });

  it('US-008 AC-2: knows the line of every field in the note file', () => {
    const {lines} = ok(EXAMPLE);
    expect(lines['page']).toBe(3);
    expect(lines['page.trimWidth']).toBe(4);
    expect(lines['page.bleed']).toBe(6);
    expect(lines['highlightColor']).toBe(7);
  });

  it('US-008 AC-2: ignores unknown fields, also inside page, and does not report them', () => {
    const result = ok(
      note(
        'futureField: 3\npage:\n  futureKey: 1\n  bleed: 2\n  margins:\n    left: 4',
      ),
    );
    expect(result.fields).toEqual({page: {bleed: 2, margins: {}}});
    expect(result.notices).toEqual([]);
  });

  it('US-008 AC-2: ignores a byte-order mark at the start of the note and keeps the line numbers', () => {
    const bom = String.fromCharCode(0xfeff);
    expect(
      ok(bom + '---\nschemaVersion: 1\nhighlightColor: "#ffffff"\n---\n')
        .fields,
    ).toEqual({highlightColor: '#ffffff'});
    expect(parsePreset(bom + '---\npage:\n  bleed: -2\n---\n')).toEqual({
      ok: false,
      error: {message: 'page.bleed must be a number of at least 0', line: 3},
    });
    expect(ok(bom + 'Just remarks.').fields).toEqual({});
  });

  it('US-008 AC-2: a note without frontmatter, with an empty one, or with only the schema version sets nothing', () => {
    for (const text of [
      '',
      'Just remarks.',
      '---\n---\nremarks',
      '---\nschemaVersion: 1\n---\n',
    ]) {
      expect(ok(text).fields, JSON.stringify(text)).toEqual({});
    }
  });

  it('US-008 AC-2: a missing schema version means 1; a newer one makes the preset invalid', () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(ok(note('highlightColor: "#000000"')).fields).toEqual({
      highlightColor: '#000000',
    });
    expect(parsePreset(note('schemaVersion: 2'))).toEqual({
      ok: false,
      error: {
        message:
          'Preset needs a newer version of Obsidian2Typst (schemaVersion 2)',
        line: 2,
      },
    });
    for (const bad of ['0', '1.5', '"one"', 'true']) {
      const result = parsePreset(note(`schemaVersion: ${bad}`));
      expect(result, bad).toEqual({
        ok: false,
        error: {
          message: 'schemaVersion must be a whole number of at least 1',
          line: 2,
        },
      });
    }
  });

  it('US-008 AC-2: an empty preset note has only the schema version and is valid', () => {
    expect(emptyPresetText()).toBe('---\nschemaVersion: 1\n---\n');
    expect(ok(emptyPresetText()).fields).toEqual({});
  });

  it('US-008 AC-2: reads CRLF notes like LF notes, with the same lines', () => {
    const lf = ok(EXAMPLE);
    const crlf = ok(EXAMPLE.replace(/\n/g, '\r\n'));
    expect(crlf.fields).toEqual(lf.fields);
    expect(crlf.lines).toEqual(lf.lines);
  });

  it('US-008 AC-2: reports frontmatter that is never closed or is not a mapping, with a line', () => {
    expect(parsePreset('---\nbleed: 1\nremarks')).toEqual({
      ok: false,
      error: {message: 'Frontmatter is not closed', line: 1},
    });
    expect(parsePreset('---\n- a\n- b\n---\n')).toEqual({
      ok: false,
      error: {
        message: 'Frontmatter must contain settings written as name: value',
        line: 2,
      },
    });
  });

  it('US-008 AC-2: gives the line of a frontmatter that is not a mapping after a blank line or a comment', () => {
    for (const text of ['---\n\n- a\n---\n', '---\n# remarks\n- a\n---\n']) {
      expect(parsePreset(text), text).toEqual({
        ok: false,
        error: {
          message: 'Frontmatter must contain settings written as name: value',
          line: 3,
        },
      });
    }
    const scalar = parsePreset('---\njust text\n---\n');
    expect(!scalar.ok && scalar.error.line).toBe(2);
  });

  it('US-008 AC-6: the two built-in preset notes are valid and carry the page values of US-009', () => {
    expect(Object.keys(BUILTIN_PRESET_TEXTS).sort()).toEqual([
      'A4 digital',
      'A5 print',
    ]);
    for (const name of ['A5 print', 'A4 digital'] as const) {
      const preset = ok(BUILTIN_PRESET_TEXTS[name]);
      expect(preset.fields.page, name).toEqual(BUILTIN_PAGE_PRESETS[name]);
      const effective = effectiveSettings(preset, {}, () => false);
      const expected = resolvePageSetup(BUILTIN_PAGE_PRESETS[name]);
      expect(expected.ok && effective.ok && effective.settings.page).toEqual(
        expected.ok && expected.value,
      );
    }
  });

  it('US-009 AC-1: reads trimSize, margins, gutter, bleed, facingPages from the preset note', () => {
    const preset = ok(
      note(
        [
          'page:',
          '  trimSize: A5',
          '  margins:',
          '    top: 18',
          '    bottom: 22',
          '    inside: 15',
          '    outside: 15',
          '  gutter: 5',
          '  bleed: 3',
          '  slug: 0',
          '  facingPages: true',
        ].join('\n'),
      ),
    );
    expect(preset.fields.page).toEqual({
      trimSize: 'A5',
      margins: {top: 18, bottom: 22, inside: 15, outside: 15},
      gutter: 5,
      bleed: 3,
      slug: 0,
      facingPages: true,
    });
  });

  it('US-008 AC-4: a field written twice makes the note invalid, with the line of the second one', () => {
    expect(
      parsePreset(
        note(
          'schemaVersion: 1\nhighlightColor: "#000000"\nhighlightColor: "#ffffff"',
        ),
      ),
    ).toEqual({
      ok: false,
      error: {message: 'Map keys must be unique', line: 4},
    });
  });

  it('US-008 AC-2: never throws, whatever the text', () => {
    for (const text of [
      '---',
      '---\n',
      '---\n\u0000\u0001\n---\n',
      '---\n{{{\n---\n',
      '---\n&a [*a]\n---\n',
      'x'.repeat(100_000),
      '---\n' + 'a: 1\n'.repeat(10_000) + '---\n',
    ]) {
      expect(() => parsePreset(text)).not.toThrow();
    }
  });
});

describe('US-008 AC-4 invalid preset notes', () => {
  it('US-008 AC-4: marks a note with invalid YAML as invalid, with the first error and its line', () => {
    const result = parsePreset(
      '---\nschemaVersion: 1\npage:\n\tbleed: 3\n---\nbody',
    );
    expect(result).toEqual({
      ok: false,
      error: {message: 'Tabs are not allowed as indentation', line: 4},
    });
    expect(!result.ok && formatPresetError(result.error)).toBe(
      'Tabs are not allowed as indentation (line 4)',
    );
    const quote = parsePreset(
      '---\nschemaVersion: 1\nhighlightColor: "#ff\n---\n',
    );
    expect(!quote.ok && quote.error.line).toBe(3);
  });

  it('US-008 AC-4: marks a note with bleed: -2 as invalid; other presets stay usable', () => {
    const bad = parsePreset(
      '---\nschemaVersion: 1\npage:\n  trimSize: A5\n  bleed: -2\n---\n',
    );
    expect(bad).toEqual({
      ok: false,
      error: {message: 'page.bleed must be a number of at least 0', line: 5},
    });
    expect(!bad.ok && formatPresetError(bad.error)).toBe(
      'page.bleed must be a number of at least 0 (line 5)',
    );
    expect(ok(note('page:\n  bleed: 2')).fields).toEqual({page: {bleed: 2}});
  });

  const WRONG: [string, string, string][] = [
    [
      'highlightColor: 5',
      'highlightColor',
      'highlightColor must be a colour written #rrggbb',
    ],
    [
      'highlightColor: red',
      'highlightColor',
      'highlightColor must be a colour written #rrggbb',
    ],
    [
      'highlightColor: "#fff"',
      'highlightColor',
      'highlightColor must be a colour written #rrggbb',
    ],
    [
      'externalLinkFootnotes: yes please',
      'externalLinkFootnotes',
      'externalLinkFootnotes must be true or false',
    ],
    [
      'headingNumbering: 5',
      'headingNumbering',
      'headingNumbering must be text',
    ],
    [
      'template: [a]',
      'template',
      'template must be a path in the vault, written as text',
    ],
    ['page: 5', 'page', 'page must be a group of settings'],
    [
      'page:\n  margins: 5',
      'page.margins',
      'page.margins must be a group of settings',
    ],
    [
      'page:\n  margins:\n    top: -1',
      'page.margins.top',
      'page.margins.top must be a number of at least 0',
    ],
    [
      'page:\n  margins:\n    inside: abc',
      'page.margins.inside',
      'page.margins.inside must be a number of at least 0',
    ],
    ['page:\n  trimSize: 5', 'page.trimSize', 'page.trimSize must be text'],
    [
      'page:\n  trimWidth: -3',
      'page.trimWidth',
      'page.trimWidth must be a number of at least 0',
    ],
    [
      'page:\n  gutter: .nan',
      'page.gutter',
      'page.gutter must be a number of at least 0',
    ],
    [
      'page:\n  slug: .inf',
      'page.slug',
      'page.slug must be a number of at least 0',
    ],
    [
      'page:\n  facingPages: 1',
      'page.facingPages',
      'page.facingPages must be true or false',
    ],
  ];
  for (const [yaml, path, message] of WRONG) {
    it(`US-008 AC-4: a wrong value is invalid like a bad one: ${path} (${JSON.stringify(yaml).slice(0, 36)})`, () => {
      const text = note(`schemaVersion: 1\n${yaml}`);
      const result = parsePreset(text);
      expect(result.ok).toBe(false);
      const line = text
        .split('\n')
        .findIndex((l) =>
          l.trimStart().startsWith(`${path.split('.').at(-1) ?? ''}:`),
        );
      expect(!result.ok && result.error).toEqual({message, line: line + 1});
    });
  }

  it('US-008 AC-4: shows only the first error, the one that comes first in the note', () => {
    const result = parsePreset(
      note('schemaVersion: 1\nhighlightColor: 5\npage:\n  bleed: -1'),
    );
    expect(!result.ok && result.error.line).toBe(3);
    const reversed = parsePreset(
      note('schemaVersion: 1\npage:\n  bleed: -1\nhighlightColor: 5'),
    );
    expect(!reversed.ok && reversed.error.line).toBe(4);
  });

  it('US-008 AC-4: validateFields reports a wrong field without a line (used for the Defaults)', () => {
    expect(validateFields({highlightColor: 'red'})).toEqual({
      ok: false,
      error: {
        message: 'highlightColor must be a colour written #rrggbb',
        line: null,
      },
    });
    expect(formatPresetError({message: 'x', line: null})).toBe('x');
    expect(validateFields({page: {bleed: 2}})).toEqual({
      ok: true,
      fields: {page: {bleed: 2}},
      notices: [],
    });
  });
});

describe('US-008 AC-13 heading numbering pattern', () => {
  it('US-008 AC-13: replaces a headingNumbering pattern without a counting symbol (x) by "1.1" with a notice, and keeps "a.1", "(1.1)" and none', () => {
    const bad = ok(note('headingNumbering: "x"'));
    expect(bad.fields.headingNumbering).toBe('1.1');
    expect(bad.notices).toEqual(['Invalid heading numbering; "1.1" is used']);
    for (const pattern of ['a.1', '(1.1)', 'none']) {
      const kept = ok(note(`headingNumbering: "${pattern}"`));
      expect(kept.fields.headingNumbering, pattern).toBe(pattern);
      expect(kept.notices, pattern).toEqual([]);
    }
  });

  it('US-008 AC-13: counts every symbol Typst accepts, and nothing else', () => {
    expect(COUNTING_SYMBOLS.length).toBeGreaterThanOrEqual(20);
    for (const symbol of ['1', 'a', 'A', 'i', 'I', '*']) {
      expect(COUNTING_SYMBOLS).toContain(symbol);
      expect(isValidNumbering(symbol)).toBe(true);
    }
    for (const bad of ['', 'x', 'z', '0', '#', '-', '(.)', ' ']) {
      expect(isValidNumbering(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(isValidNumbering('none')).toBe(true);
    expect(isValidNumbering('Chapter 1:')).toBe(true);
  });

  it('US-008 AC-13: the position of the notice is the line of the field', () => {
    const result = ok(note('schemaVersion: 1\nheadingNumbering: "x"'));
    expect(result.lines['headingNumbering']).toBe(3);
  });
});

describe('US-008 AC-14 effective settings for the pipeline', () => {
  it('US-008 AC-12: inherits all other values for a preset that sets only page.bleed: 5 (A5 becomes 158 x 220 mm)', () => {
    const preset = ok(note('page:\n  bleed: 5'));
    const effective = effectiveSettings(preset, {}, () => false);
    expect(effective.ok).toBe(true);
    if (!effective.ok) return;
    expect(effective.settings.page.pageWidth).toBe(158);
    expect(effective.settings.page.pageHeight).toBe(220);
    expect(effective.settings).toEqual({
      page: {
        pageWidth: 158,
        pageHeight: 220,
        facingPages: true,
        slug: 0,
        margins: {top: 23, bottom: 27, inside: 25, outside: 20},
      },
      highlightColor: '#ffeb3b',
      headingNumbering: '1.1',
      externalLinkFootnotes: true,
      linkPageNumbers: true,
      linkPageLevel: 2,
      linkPageWord: 'p.',
      template: false,
      callouts: {},
      headingRules: {},
      pageFurniture: {folios: true, runningHeader: true, runningHeaderLevel: 2},
      // US-025 AC-1: no level breaks by default.
      breakBefore: {
        h1: 'none',
        h2: 'none',
        h3: 'none',
        h4: 'none',
        h5: 'none',
        h6: 'none',
      },
      // US-026 AC-9: the built-in book settings.
      book: {
        signature: 0,
        romanFrontMatter: false,
        firstChapter: 'left',
        colophonHeading: 'hidden',
        backNotesHeading: 'hidden',
      },
      // US-027 AC-1: the built-in contents settings (no contents).
      toc: {
        depth: 0,
        title: 'Contents',
        pageNumbers: true,
        dotLeaders: true,
      },
      // US-028 AC-1: the built-in image fit (100: the rule off).
      images: {minScale: 100},
      cover: {
        mode: 'auto',
        file: null,
        blankPageAfter: false,
        cropWarningPercent: 5,
        back: false,
      },
      fonts: DEFAULT_FONTS,
    });
    expect(effective.template).toBeNull();
  });

  it('US-008 AC-14: the Defaults take part: their page, colour and numbering reach the pipeline', () => {
    const effective = effectiveSettings(
      ok(note('headingNumbering: none')),
      {highlightColor: '#a5d6a7', page: {trimSize: 'A4', bleed: 0}},
      () => false,
    );
    expect(effective.ok && effective.settings.page.pageWidth).toBe(210);
    expect(effective.ok && effective.settings.highlightColor).toBe('#a5d6a7');
    expect(effective.ok && effective.settings.headingNumbering).toBe('none');
  });

  it('US-008 AC-14: externalLinkFootnotes false reaches the pipeline (US-004 AC-1c)', () => {
    const effective = effectiveSettings(
      ok(note('externalLinkFootnotes: false')),
      {},
      () => false,
    );
    expect(effective.ok && effective.settings.externalLinkFootnotes).toBe(
      false,
    );
  });

  it('US-008 AC-14: a page that US-009 refuses makes the preset invalid, with the line of the field', () => {
    const text = [
      '---', // 1
      'schemaVersion: 1', // 2
      'page:', // 3
      '  margins:', // 4
      '    inside: 60', // 5
      '    outside: 60', // 6
      '---', // 7
    ].join('\n');
    const effective = effectiveSettings(ok(text), {}, () => false);
    expect(effective).toEqual({
      ok: false,
      error: {
        message: 'Text block would be only 23 mm wide (minimum 30 mm)',
        line: 4,
      },
    });
    const unknown = effectiveSettings(
      ok(note('page:\n  trimSize: A55')),
      {},
      () => false,
    );
    expect(unknown).toEqual({
      ok: false,
      error: {
        message:
          'Unknown trim size "A55" (use A4, A5, A6, US Letter, or trimWidth and trimHeight)',
        line: 3,
      },
    });
  });

  it('US-008 AC-14: an error that comes from the Defaults has no line in the note', () => {
    const effective = effectiveSettings(
      ok(note('highlightColor: "#000000"')),
      {page: {margins: {inside: 70, outside: 70}}},
      () => false,
    );
    expect(!effective.ok && effective.error.line).toBeNull();
    expect(!effective.ok && effective.error.message).toContain('Text block');
  });

  it('US-008 AC-9: uses no import when no template is set (preset, then Defaults), and one when the file exists', async () => {
    const none = effectiveSettings(ok(note('')), {}, () => true);
    expect(none.ok && none.settings.template).toBe(false);
    expect(none.ok && none.template).toBeNull();

    const fromDefaults = effectiveSettings(
      ok(note('')),
      {template: 'T/a.typ'},
      (p) => p === 'T/a.typ',
    );
    expect(fromDefaults.ok && fromDefaults.template).toEqual({
      path: 'T/a.typ',
      exists: true,
    });
    expect(fromDefaults.ok && fromDefaults.settings.template).toBe(true);

    const fromPreset = effectiveSettings(
      ok(note('template: T/b.typ')),
      {template: 'T/a.typ'},
      () => true,
    );
    expect(fromPreset.ok && fromPreset.template?.path).toBe('T/b.typ');
  });

  it('US-008 AC-11: continues without the import and reports TEMPLATE_MISSING when the template file does not exist', () => {
    const effective = effectiveSettings(
      ok(note('template: T/gone.typ')),
      {},
      () => false,
    );
    expect(effective.ok && effective.settings.template).toBe(false);
    expect(effective.ok && effective.template).toEqual({
      path: 'T/gone.typ',
      exists: false,
    });
    expect(missingTemplateWarning('T/gone.typ')).toEqual({
      code: 'TEMPLATE_MISSING',
      message:
        'Template "T/gone.typ" does not exist; the export continues without it',
      line: 0,
    });
  });

  it('US-008 AC-9: emits #import "template.typ": * before any generated #set or #show rule', async () => {
    const effective = effectiveSettings(
      ok(note('template: T/a.typ')),
      {},
      () => true,
    );
    if (!effective.ok) throw new Error('valid');
    const {typ} = await run('# A\n\n==x==', {settings: effective.settings});
    const lines = typ.split('\n');
    const importAt = lines.indexOf('#import "template.typ": *');
    expect(importAt).toBe(1);
    const firstRule = lines.findIndex((l) => /^#(set|show) /.test(l));
    expect(importAt).toBeLessThan(firstRule);
  });

  it('US-008 AC-9: a missing template leaves no import in the typ', async () => {
    const effective = effectiveSettings(
      ok(note('template: T/gone.typ')),
      {},
      () => false,
    );
    if (!effective.ok) throw new Error('valid');
    const {typ} = await run('x', {settings: effective.settings});
    expect(typ).not.toContain('#import');
  });
});

describe('US-008 AC-5 names, copies, deletion, active preset', () => {
  it("US-008 AC-5: rejects a duplicate name case-insensitively ('a5 print' vs 'A5 print')", () => {
    expect(validatePresetName('a5 print', ['A5 print', 'A4 digital'])).toEqual({
      ok: false,
      error: 'A preset with this name already exists',
    });
    expect(validatePresetName('ÄNDERN', ['ändern'])).toEqual({
      ok: false,
      error: 'A preset with this name already exists',
    });
    expect(validatePresetName('Third', ['A5 print'])).toEqual({
      ok: true,
      name: 'Third',
    });
  });

  it('US-008 AC-5: compares names after Unicode normalisation (NFC), so one letter in two forms clashes, and stores the NFC form', () => {
    const composed = String.fromCharCode(0xc4) + 'nder';
    const decomposed = 'A' + String.fromCharCode(0x308) + 'nder';
    expect(composed).not.toBe(decomposed);
    expect(validatePresetName(decomposed, [composed])).toEqual({
      ok: false,
      error: 'A preset with this name already exists',
    });
    expect(validatePresetName(composed, [decomposed])).toEqual({
      ok: false,
      error: 'A preset with this name already exists',
    });
    expect(validatePresetName(decomposed, [])).toEqual({
      ok: true,
      name: composed,
    });
    expect(copyName(decomposed, [composed])).toBe(composed + ' copy');
    expect(sortPresetNames([decomposed + ' b', composed + ' a'])).toEqual([
      composed + ' a',
      decomposed + ' b',
    ]);
  });

  it('US-008 AC-5: rejects a name that ends with a dot and the Windows device names, in any case and with a suffix after a dot', () => {
    for (const bad of ['name.', 'name..', 'a .']) {
      expect(validatePresetName(bad, []), bad).toEqual({
        ok: false,
        error: 'A preset name cannot end with a dot',
      });
    }
    for (const bad of [
      'CON',
      'con',
      'Prn',
      'AUX',
      'nul',
      'COM1',
      'com9',
      'LPT1',
      'lpt9',
      'CON.draft',
    ]) {
      expect(validatePresetName(bad, []), bad).toEqual({
        ok: false,
        error: 'A preset name cannot be a Windows device name',
      });
    }
    for (const good of ['CONTENT', 'COM0', 'COM10', 'my CON', 'LPT', 'A.b']) {
      expect(validatePresetName(good, []).ok, good).toBe(true);
    }
  });

  it('US-008 AC-5: lets a preset keep its own name when it is renamed (other case)', () => {
    expect(
      validatePresetName('a5 PRINT', ['A5 print', 'A4 digital'], 'A5 print'),
    ).toEqual({ok: true, name: 'a5 PRINT'});
    expect(
      validatePresetName('a4 digital', ['A5 print', 'A4 digital'], 'A5 print'),
    ).toEqual({ok: false, error: 'A preset with this name already exists'});
  });

  it('US-008 AC-5: rejects names containing / \\ : * ? " < > |', () => {
    for (const ch of ['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
      expect(validatePresetName(`a${ch}b`, []), ch).toEqual({
        ok: false,
        error: 'A preset name cannot contain / \\ : * ? " < > |',
      });
    }
  });

  it('US-008 AC-5: trims the name and rejects an empty name, a leading dot and more than 100 characters', () => {
    expect(validatePresetName('  New  ', [])).toEqual({ok: true, name: 'New'});
    for (const empty of ['', '   ', '\t']) {
      expect(validatePresetName(empty, [])).toEqual({
        ok: false,
        error: 'A preset needs a name',
      });
    }
    expect(validatePresetName('.hidden', [])).toEqual({
      ok: false,
      error: 'A preset name cannot start with a dot',
    });
    expect(validatePresetName('x'.repeat(100), []).ok).toBe(true);
    expect(validatePresetName('x'.repeat(101), [])).toEqual({
      ok: false,
      error: 'A preset name is too long (100 characters at most)',
    });
  });

  it('US-008 AC-5: names a duplicate "<name> copy", then "copy 2", "copy 3", ignoring case', () => {
    expect(copyName('A5 print', ['A5 print'])).toBe('A5 print copy');
    expect(copyName('A5 print', ['A5 print', 'A5 print copy'])).toBe(
      'A5 print copy 2',
    );
    expect(
      copyName('A5 print', ['A5 print', 'a5 print COPY', 'A5 print copy 2']),
    ).toBe('A5 print copy 3');
  });

  it('US-008 AC-5: sorts names case-insensitively by code point', () => {
    expect(sortPresetNames(['b', 'A', 'a2', 'a10', 'B'])).toEqual([
      'A',
      'a10',
      'a2',
      'b',
      'B',
    ]);
  });

  it('US-008 AC-5: a name comes after the name it starts with', () => {
    expect(sortPresetNames(['A5 print copy', 'A5 print', 'A5'])).toEqual([
      'A5',
      'A5 print',
      'A5 print copy',
    ]);
  });

  it('US-008 AC-5: activates the first remaining preset, alphabetically, when the active one is deleted', () => {
    const names = ['Zeta', 'A5 print', 'A4 digital'];
    expect(planDelete(names, 'A5 print', 'A5 print')).toEqual({
      ok: true,
      active: 'A4 digital',
    });
    expect(planDelete(names, 'Zeta', 'A5 print')).toEqual({
      ok: true,
      active: 'A5 print',
    });
    expect(planDelete(['b', 'a', 'c'], 'a', 'a')).toEqual({
      ok: true,
      active: 'b',
    });
  });

  it('US-008 AC-5: refuses to delete the last remaining preset', () => {
    expect(planDelete(['Only'], 'Only', 'Only')).toEqual({
      ok: false,
      error: 'The last preset cannot be deleted',
    });
  });

  it('US-008 AC-8: the active preset is the stored one if it exists, else the first in alphabetical order, none without presets', () => {
    expect(pickActive(['B', 'A'], 'B')).toBe('B');
    expect(pickActive(['B', 'A'], 'Gone')).toBe('A');
    expect(pickActive([], 'A')).toBeNull();
  });
});

describe('US-008 AC-10 a template that shadows a Typst built-in', () => {
  it("US-008 AC-10: reports TEMPLATE_SHADOWS_BUILTIN for '#let quote(body) = ...' at line 3 and still applies it", () => {
    const template = [
      '#let accent = rgb("#336699")', // 1
      '', // 2
      '#let quote(body) = block(inset: 1em, body)', // 3
    ].join('\n');
    expect(scanTemplate(template)).toEqual([{line: 3, name: 'quote'}]);
    expect(templateWarnings(template)).toEqual([
      {
        code: 'TEMPLATE_SHADOWS_BUILTIN',
        message:
          'Template line 3 defines "quote", which shadows a Typst built-in',
        line: 0,
      },
    ]);
  });

  it('US-008 AC-10: reports every definition, in order, also with other whitespace and CRLF', () => {
    const template =
      '#let table = 1\r\n#let   text(x) = x\r\n#let own-name = 2\r\n#let\tpage = 3\r\n';
    expect(scanTemplate(template)).toEqual([
      {line: 1, name: 'table'},
      {line: 2, name: 'text'},
      {line: 4, name: 'page'},
    ]);
  });

  it('US-008 AC-10: finds a definition on the first line, after a byte-order mark and without a final newline', () => {
    const bom = String.fromCharCode(0xfeff);
    expect(scanTemplate(bom + '#let quote = 1\n')).toEqual([
      {line: 1, name: 'quote'},
    ]);
    expect(scanTemplate('#let quote = 1')).toEqual([{line: 1, name: 'quote'}]);
    expect(scanTemplate('\n\n#let table = 1')).toEqual([
      {line: 3, name: 'table'},
    ]);
  });

  it('US-008 AC-10: does not detect definitions that are not at line start (documented limit)', () => {
    for (const template of [
      '  #let quote(x) = x',
      'text #let quote = 1',
      '#{ let quote = 1 }',
      '#let (quote, table) = (1, 2)',
      '#letquote = 1',
      '#let quoted = 1',
      '// #let quote = 1',
    ]) {
      expect(scanTemplate(template), template).toEqual([]);
    }
  });

  it('US-008 AC-10: has no warning for a template without a shadowing definition', () => {
    // US-023 AC-5 (2026-10-22): the top-level `#show` gets its own warning,
    // TEMPLATE_RULE_IGNORED; this criterion is about shadowing only.
    const codes = templateWarnings(
      '#let accent = 1\n#show heading: set text(red)\n',
    ).map((w) => w.code);
    expect(codes).not.toContain('TEMPLATE_SHADOWS_BUILTIN');
    expect(codes).not.toContain('TEMPLATE_NAME_TAKEN');
    expect(templateWarnings('#let accent = 1\n')).toEqual([]);
    expect(templateWarnings('')).toEqual([]);
  });

  it('US-008 AC-10: the list of standard-library names is sorted, unique and holds the common ones', () => {
    expect(STD_NAMES.length).toBeGreaterThanOrEqual(100);
    expect([...STD_NAMES]).toEqual([...new Set(STD_NAMES)].sort());
    for (const name of [
      'quote',
      'table',
      'text',
      'image',
      'heading',
      'page',
      'par',
      'figure',
      'footnote',
      'link',
      'raw',
      'strong',
      'emph',
      'highlight',
      'line',
      'rect',
      'calc',
    ]) {
      expect(STD_NAMES, name).toContain(name);
    }
  });
});
