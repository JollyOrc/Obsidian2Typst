// US-010 — the pure parts of the fonts: the `fonts` fields of a preset, the
// font catalog (coverage, case-insensitive names), the resolution with its
// fallback chain and messages, the four Typst lines, the glyph check of the
// source text and the notice of the font picker (unit, pure core). The
// conversion is in us-010-fonts-convert.test.ts, the vault fonts and the
// export in tests/plugin, the PDF in tests/integration. Source of truth:
// docs/user-stories/US-010-fonts.md.
import {describe, expect, it} from 'vitest';
import {
  BUNDLED_CODE_FAMILY,
  BUNDLED_DEFAULT_FAMILY,
  DEFAULT_FONTS,
  FEATURE_GLYPHS,
  checkGlyphs,
  createFontCatalog,
  decodeCoverage,
  emitFonts,
  familyOptions,
  featureGlyphNotice,
  missingFeatureGlyphs,
  resolveFonts,
  type FontsSettings,
} from '../../src/core/fonts';
import {parse} from '../../src/core/parse';
import {
  effectiveSettings,
  formatPresetError,
  getField,
  parsePreset,
  validateFields,
  withField,
} from '../../src/core/presets';

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

/** Coverage runs for the given inclusive code point ranges. */
function runs(...ranges: [number, number][]): number[] {
  const out: number[] = [];
  let at = 0;
  for (const [from, to] of ranges) {
    out.push(from - at, to - from + 1);
    at = to + 1;
  }
  return out;
}
const ASCII = runs([32, 126]);

/** A catalog of the families the tests use; all cover printable ASCII. */
const catalog = (
  names: string[] = [
    'Libertinus Serif',
    'DejaVu Sans Mono',
    'Cinzel',
    'EB Garamond',
  ],
) => createFontCatalog(names.map((family) => ({family, coverage: ASCII})));

const settings = (over: Partial<FontsSettings> = {}): FontsSettings => ({
  ...structuredClone(DEFAULT_FONTS),
  ...over,
});

describe('US-010 AC-1 the fonts fields of a preset note', () => {
  it('US-010 AC-1: reads folder, default and the four roles with their lines', () => {
    const result = parsePreset(
      note(
        'fonts:',
        '  folder: "Layouting/Fonts"',
        '  default: "EB Garamond"',
        '  body:',
        '    family: "Gentium"',
        '    size: 11',
        '  heading:',
        '    family: "Cinzel"',
        '    size: 18',
        '  caption:',
        '    size: 9',
        '  code:',
        '    family: "DejaVu Sans Mono"',
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.fonts).toEqual({
      folder: 'Layouting/Fonts',
      default: 'EB Garamond',
      body: {family: 'Gentium', size: 11},
      heading: {family: 'Cinzel', size: 18},
      caption: {size: 9},
      code: {family: 'DejaVu Sans Mono'},
    });
    expect(result.lines['fonts.default']).toBe(5);
    expect(result.lines['fonts.heading.size']).toBe(11);
  });

  it('US-010 AC-1: gives the built-in values when nothing is set', () => {
    const parsed = parsePreset(note());
    if (!parsed.ok) throw new Error('valid');
    const result = effectiveSettings(parsed, {}, () => false);
    expect(result.ok && result.settings.fonts).toEqual({
      folder: null,
      default: 'Libertinus Serif',
      body: {family: null, size: 10},
      heading: {family: null, size: null},
      caption: {family: null, size: null},
      code: {family: 'DejaVu Sans Mono', size: null},
    });
    expect(DEFAULT_FONTS).toEqual(result.ok && result.settings.fonts);
    expect(BUNDLED_DEFAULT_FAMILY).toBe('Libertinus Serif');
    expect(BUNDLED_CODE_FAMILY).toBe('DejaVu Sans Mono');
  });

  it('US-010 AC-1: takes each field from the preset, else the Defaults, else the built-in', () => {
    const parsed = parsePreset(
      note(
        'fonts:',
        '  body:',
        '    size: 11',
        '  heading:',
        '    family: "Cinzel"',
      ),
    );
    if (!parsed.ok) throw new Error('valid');
    const result = effectiveSettings(
      parsed,
      {
        fonts: {
          folder: 'Layouting/Fonts',
          default: 'EB Garamond',
          body: {size: 12, family: 'Gentium'},
          code: {size: 8},
        },
      },
      () => false,
    );
    expect(result.ok && result.settings.fonts).toEqual({
      folder: 'Layouting/Fonts',
      default: 'EB Garamond',
      body: {family: 'Gentium', size: 11},
      heading: {family: 'Cinzel', size: null},
      caption: {family: null, size: null},
      code: {family: 'DejaVu Sans Mono', size: 8},
    });
  });

  it('US-010 AC-1: a null is unset, unknown roles are ignored', () => {
    const parsed = parsePreset(
      note(
        'fonts:',
        '  default: null',
        '  body:',
        '    family: null',
        '  footnote:',
        '    size: 7',
      ),
    );
    if (!parsed.ok) throw new Error('valid');
    const result = effectiveSettings(parsed, {}, () => false);
    expect(result.ok && result.settings.fonts).toEqual(DEFAULT_FONTS);
  });

  it('US-010 AC-1: refuses a role that is not a group, with its line', () => {
    const result = parsePreset(note('fonts:', '  default: "X"', '  body: 12'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(formatPresetError(result.error)).toBe(
      'fonts.body must be a group of settings (line 5)',
    );
  });

  it('US-010 AC-1: refuses a size of 0, below 0, above 200 or not a number', () => {
    for (const value of ['0', '-1', '201', 'big', '"10"', 'true']) {
      const result = parsePreset(
        note('fonts:', '  heading:', `    size: ${value}`),
      );
      expect(result.ok, value).toBe(false);
      if (result.ok) continue;
      expect(formatPresetError(result.error), value).toBe(
        'fonts.heading.size must be a number of pt greater than 0 and at most 200 (line 5)',
      );
    }
    for (const value of ['0.5', '10', '200', '10.5']) {
      expect(
        parsePreset(note('fonts:', '  caption:', `    size: ${value}`)).ok,
        value,
      ).toBe(true);
    }
  });

  it('US-010 AC-1: refuses a family or default that is not text or only blanks', () => {
    for (const value of ['""', '"   "', '5', 'true']) {
      const result = parsePreset(note('fonts:', `  default: ${value}`));
      expect(result.ok, value).toBe(false);
      if (result.ok) continue;
      expect(formatPresetError(result.error), value).toBe(
        'fonts.default must be a font family name written as text (line 4)',
      );
    }
    const role = parsePreset(note('fonts:', '  code:', '    family: 7'));
    expect(role.ok).toBe(false);
    if (!role.ok) {
      expect(formatPresetError(role.error)).toBe(
        'fonts.code.family must be a font family name written as text (line 5)',
      );
    }
  });

  it('US-010 AC-1: refuses a folder that is not text, and a fonts value that is not a group', () => {
    const folder = parsePreset(note('fonts:', '  folder: 5'));
    expect(folder.ok).toBe(false);
    if (!folder.ok) {
      expect(formatPresetError(folder.error)).toBe(
        'fonts.folder must be a vault folder path written as text (line 4)',
      );
    }
    const group = parsePreset(note('fonts: Libertinus'));
    expect(group.ok).toBe(false);
    if (!group.ok) {
      expect(formatPresetError(group.error)).toBe(
        'fonts must be a group of settings (line 3)',
      );
    }
  });

  it('US-010 AC-1: the Defaults hold fonts, are checked the same way, and can be edited by path', () => {
    const ok = validateFields({fonts: {default: 'EB Garamond'}});
    expect(ok.ok && ok.fields).toEqual({fonts: {default: 'EB Garamond'}});
    const bad = validateFields({fonts: {body: {size: 0}}});
    expect(bad.ok).toBe(false);
    const edited = withField({}, ['fonts', 'heading', 'family'], 'Cinzel');
    expect(edited).toEqual({fonts: {heading: {family: 'Cinzel'}}});
    expect(getField(edited, ['fonts', 'heading', 'family'])).toBe('Cinzel');
    expect(
      withField(edited, ['fonts', 'heading', 'family'], undefined),
    ).toEqual({});
  });
});

describe('US-010 the font catalog', () => {
  it('US-010 AC-5: decodes coverage runs (not covered, covered, alternating, from the start)', () => {
    expect(decodeCoverage([65, 26, 6, 26])).toEqual([
      [65, 91],
      [97, 123],
    ]);
    expect(decodeCoverage([0, 3])).toEqual([[0, 3]]);
    expect(decodeCoverage([])).toEqual([]);
    expect(decodeCoverage([10])).toEqual([]);
  });

  it('US-010 AC-5: hasGlyph is true inside a covered run only, for any case of the family name', () => {
    const c = createFontCatalog([{family: 'Cinzel', coverage: runs([65, 90])}]);
    expect(c.hasGlyph('Cinzel', 0x41)).toBe(true);
    expect(c.hasGlyph('cinzel', 0x5a)).toBe(true);
    expect(c.hasGlyph('Cinzel', 0x61)).toBe(false);
    expect(c.hasGlyph('Cinzel', 0x40)).toBe(false);
    expect(c.hasGlyph('Unknown', 0x41)).toBe(false);
  });

  it('US-010 AC-5: the faces of one family add up', () => {
    const c = createFontCatalog([
      {family: 'Cinzel', coverage: runs([65, 66])},
      {family: 'CINZEL', coverage: runs([0x2610, 0x2610])},
    ]);
    expect(c.hasGlyph('Cinzel', 0x41)).toBe(true);
    expect(c.hasGlyph('Cinzel', 0x2610)).toBe(true);
    expect(c.families()).toEqual(['Cinzel']);
  });

  it('US-010 AC-6: lists the families once, sorted without regard to case', () => {
    const c = createFontCatalog(
      ['zeta', 'Alpha', 'beta', 'Alpha'].map((family) => ({
        family,
        coverage: ASCII,
      })),
    );
    expect(c.families()).toEqual(['Alpha', 'beta', 'zeta']);
  });

  it('US-010 AC-2: resolve gives the name the file reports, for any case, and null for an unknown family', () => {
    const c = catalog();
    expect(c.resolve('cinzel')).toBe('Cinzel');
    expect(c.resolve('EB GARAMOND')).toBe('EB Garamond');
    expect(c.resolve('  Cinzel  ')).toBe('Cinzel');
    expect(c.resolve('Nope')).toBeNull();
  });
});

describe('US-010 AC-2 and AC-4 resolving the fonts and writing the four lines', () => {
  const resolved = (s: FontsSettings, c = catalog()) => resolveFonts(s, c);

  it('US-010 AC-2: writes the worked example exactly', () => {
    const s = settings({heading: {family: 'Cinzel', size: null}});
    const {fonts, warnings} = resolved(s);
    expect(warnings).toEqual([]);
    expect(emitFonts(fonts)).toBe(
      [
        '#set text(font: "Libertinus Serif", size: 10pt)',
        '#show heading: set text(font: "Cinzel")',
        '#show raw: set text(font: "DejaVu Sans Mono", size: 0.9em)',
        '#show figure.caption: set text(font: "Libertinus Serif", size: 0.9em)',
      ].join('\n'),
    );
  });

  it('US-010 AC-2: writes the built-in settings with the bundled families', () => {
    expect(emitFonts(resolved(settings()).fonts)).toBe(
      [
        '#set text(font: "Libertinus Serif", size: 10pt)',
        '#show heading: set text(font: "Libertinus Serif")',
        '#show raw: set text(font: "DejaVu Sans Mono", size: 0.9em)',
        '#show figure.caption: set text(font: "Libertinus Serif", size: 0.9em)',
      ].join('\n'),
    );
  });

  it('US-010 AC-2: writes sizes in pt without trailing zeros, per role', () => {
    const s = settings({
      body: {family: null, size: 10.5},
      heading: {family: 'Cinzel', size: 18},
      caption: {family: null, size: 9},
      code: {family: null, size: 8.25},
    });
    expect(emitFonts(resolved(s).fonts).split('\n')).toEqual([
      '#set text(font: "Libertinus Serif", size: 10.5pt)',
      '#show heading: set text(font: "Cinzel", size: 18pt)',
      '#show raw: set text(font: "DejaVu Sans Mono", size: 8.25pt)',
      '#show figure.caption: set text(font: "Libertinus Serif", size: 9pt)',
    ]);
  });

  it('US-010 AC-2: changing only the default changes body and caption, not heading with its own family or code', () => {
    const s = settings({
      default: 'EB Garamond',
      heading: {family: 'Cinzel', size: null},
    });
    expect(emitFonts(resolved(s).fonts).split('\n')).toEqual([
      '#set text(font: "EB Garamond", size: 10pt)',
      '#show heading: set text(font: "Cinzel")',
      '#show raw: set text(font: "DejaVu Sans Mono", size: 0.9em)',
      '#show figure.caption: set text(font: "EB Garamond", size: 0.9em)',
    ]);
  });

  it('US-010 AC-2: a role without a family follows the default, also the heading', () => {
    const s = settings({default: 'EB Garamond'});
    expect(emitFonts(resolved(s).fonts).split('\n')[1]).toBe(
      '#show heading: set text(font: "EB Garamond")',
    );
  });

  it('US-010 AC-2: changing only body.family changes only the #set text line', () => {
    const base = emitFonts(resolved(settings()).fonts).split('\n');
    const changed = emitFonts(
      resolved(settings({body: {family: 'EB Garamond', size: 10}})).fonts,
    ).split('\n');
    expect(changed[0]).toBe('#set text(font: "EB Garamond", size: 10pt)');
    expect(changed.slice(1)).toEqual(base.slice(1));
  });

  it('US-010 AC-2: matches names without regard to case and writes the name the font reports', () => {
    const s = settings({heading: {family: 'cinzel', size: null}});
    expect(emitFonts(resolved(s).fonts)).toContain(
      '#show heading: set text(font: "Cinzel")',
    );
  });

  it('US-010 AC-2: writes a family name as a Typst string, quotes and backslashes escaped', () => {
    const odd = 'My "Odd" \\ Font';
    const s = settings({heading: {family: odd, size: null}});
    const {fonts} = resolveFonts(s, catalog([odd, 'Libertinus Serif']));
    expect(emitFonts(fonts)).toContain(
      '#show heading: set text(font: "My \\"Odd\\" \\\\ Font")',
    );
  });

  it('US-010 AC-4: a missing role family falls back to the default family and is reported', () => {
    const s = settings({
      default: 'EB Garamond',
      heading: {family: 'Nope', size: null},
    });
    const {fonts, warnings} = resolved(s);
    expect(fonts.heading.family).toBe('EB Garamond');
    expect(warnings).toEqual([
      {
        code: 'FONT_MISSING',
        message: 'Font "Nope" for heading was not found; "EB Garamond" is used',
        line: 0,
      },
    ]);
  });

  it('US-010 AC-4: a missing default falls back to the bundled one and is reported once, also for roles that inherit it', () => {
    const s = settings({default: 'Foo'});
    const {fonts, warnings} = resolved(s);
    expect(fonts.defaultFamily).toBe('Libertinus Serif');
    expect(fonts.body.family).toBe('Libertinus Serif');
    expect(fonts.heading.family).toBe('Libertinus Serif');
    expect(fonts.caption.family).toBe('Libertinus Serif');
    expect(warnings).toEqual([
      {
        code: 'FONT_MISSING',
        message: 'Default font "Foo" was not found; "Libertinus Serif" is used',
        line: 0,
      },
    ]);
  });

  it('US-010 AC-4: the worked example: default Foo (missing), heading Cinzel (found), code Bar (missing)', () => {
    const s = settings({
      default: 'Foo',
      heading: {family: 'Cinzel', size: null},
      code: {family: 'Bar', size: null},
    });
    const {fonts, warnings} = resolved(s);
    expect(emitFonts(fonts).split('\n')).toEqual([
      '#set text(font: "Libertinus Serif", size: 10pt)',
      '#show heading: set text(font: "Cinzel")',
      '#show raw: set text(font: "DejaVu Sans Mono", size: 0.9em)',
      '#show figure.caption: set text(font: "Libertinus Serif", size: 0.9em)',
    ]);
    expect(warnings.map((w) => w.message)).toEqual([
      'Default font "Foo" was not found; "Libertinus Serif" is used',
      'Font "Bar" for code was not found; "DejaVu Sans Mono" is used',
    ]);
  });

  it('US-010 AC-4: a role family that is missing while the default is missing too gets the bundled default', () => {
    const s = settings({
      default: 'Foo',
      heading: {family: 'Bar', size: null},
    });
    const {fonts, warnings} = resolved(s);
    expect(fonts.heading.family).toBe('Libertinus Serif');
    expect(warnings.map((w) => w.message)).toEqual([
      'Default font "Foo" was not found; "Libertinus Serif" is used',
      'Font "Bar" for heading was not found; "Libertinus Serif" is used',
    ]);
  });

  it('US-010 AC-4: a missing body family is reported as body', () => {
    const s = settings({body: {family: 'Nope', size: 10}});
    const {fonts, warnings} = resolved(s);
    expect(fonts.body.family).toBe('Libertinus Serif');
    expect(warnings.map((w) => w.message)).toEqual([
      'Font "Nope" for body was not found; "Libertinus Serif" is used',
    ]);
  });

  it('US-010 AC-4: one warning per configured family and role, a name in two roles is reported twice', () => {
    const s = settings({
      heading: {family: 'Nope', size: null},
      caption: {family: 'Nope', size: null},
    });
    expect(resolved(s).warnings.map((w) => w.message)).toEqual([
      'Font "Nope" for heading was not found; "Libertinus Serif" is used',
      'Font "Nope" for caption was not found; "Libertinus Serif" is used',
    ]);
  });

  it('US-010 AC-4: without a catalog the names are taken as written and nothing is reported', () => {
    const s = settings({
      default: 'Foo',
      heading: {family: 'Bar', size: 14},
    });
    const {fonts, warnings} = resolveFonts(s, undefined);
    expect(warnings).toEqual([]);
    expect(emitFonts(fonts).split('\n').slice(0, 2)).toEqual([
      '#set text(font: "Foo", size: 10pt)',
      '#show heading: set text(font: "Bar", size: 14pt)',
    ]);
  });

  it('US-010 AC-4: does not change the settings it is given', () => {
    const s = settings({default: 'Foo'});
    const copy = structuredClone(s);
    resolved(s);
    expect(s).toEqual(copy);
  });
});

describe('US-010 AC-5 the glyph check of the source text', () => {
  const lacks = (source: string, names?: string[]) => {
    const c = catalog(names);
    const {fonts} = resolveFonts(settings(), c);
    return checkGlyphs(parse(source).root, fonts, c);
  };

  it('US-010 AC-5: lists the missing characters of the body in code point order with the first line', () => {
    const warnings = lacks('First line.\n\nText ⚔ and ☠ here.\n');
    expect(warnings).toEqual([
      {
        code: 'FONT_GLYPH_MISSING',
        message:
          'Font "Libertinus Serif" lacks 2 characters: ☠ U+2620, ⚔ U+2694 (first at line 3)',
        line: 3,
      },
    ]);
  });

  it('US-010 AC-5: one character reads "1 character", and a character that occurs twice is listed once', () => {
    const warnings = lacks('a ☠ b ☠\n');
    expect(warnings.map((w) => w.message)).toEqual([
      'Font "Libertinus Serif" lacks 1 character: ☠ U+2620 (first at line 1)',
    ]);
  });

  it('US-010 AC-5: names the first source line over all missing characters, not the line of the first in code order', () => {
    expect(lacks('x\n\nlate ☠\n\nearly ⚔ is not earlier\n')[0]?.line).toBe(3);
    expect(lacks('⚔ first\n\n☠ later\n')[0]?.line).toBe(1);
  });

  it('US-010 AC-5: lists ten and says "and 2 more" for twelve', () => {
    const chars = Array.from({length: 12}, (_, i) =>
      String.fromCodePoint(0x4e00 + i),
    ).join('');
    const message = lacks(`${chars}\n`)[0]?.message ?? '';
    expect(message).toBe(
      'Font "Libertinus Serif" lacks 12 characters: ' +
        Array.from(
          {length: 10},
          (_, i) =>
            `${String.fromCodePoint(0x4e00 + i)} U+${(0x4e00 + i)
              .toString(16)
              .toUpperCase()}`,
        ).join(', ') +
        ' and 2 more (first at line 1)',
    );
  });

  it('US-010 AC-5: writes code points with at least four upper-case hex digits and more for astral ones', () => {
    const message = lacks('é 😀\n')[0]?.message ?? '';
    expect(message).toContain('é U+00E9');
    expect(message).toContain('😀 U+1F600');
  });

  it('US-010 AC-5: does not check spaces, control characters or invisible format characters', () => {
    const source = 'a b\tc​‍‎⁠﻿️ d\n';
    expect(lacks(source).map((w) => w.message)).toEqual([
      'Font "Libertinus Serif" lacks 1 character:   U+00A0 (first at line 1)',
    ]);
  });

  it('US-010 AC-5: reports nothing when every character is covered', () => {
    expect(lacks('plain ascii text\n')).toEqual([]);
  });

  it('US-010 AC-5: heading text is checked against the heading family', () => {
    const s = settings({heading: {family: 'Cinzel', size: null}});
    const c = createFontCatalog([
      {family: 'Libertinus Serif', coverage: runs([32, 126], [0x2620, 0x2620])},
      {family: 'DejaVu Sans Mono', coverage: runs([32, 126], [0x2620, 0x2620])},
      {family: 'Cinzel', coverage: ASCII},
    ]);
    const {fonts} = resolveFonts(s, c);
    const warnings = checkGlyphs(parse('# ☠ Title\n\nbody ☠\n').root, fonts, c);
    expect(warnings.map((w) => w.message)).toEqual([
      'Font "Cinzel" lacks 1 character: ☠ U+2620 (first at line 1)',
    ]);
  });

  it('US-010 AC-5: code (inline and block) is checked against the code family, image captions against the caption family', () => {
    const s = settings({
      caption: {family: 'Cinzel', size: null},
    });
    const c = createFontCatalog([
      {family: 'Libertinus Serif', coverage: runs([32, 126], [0x2620, 0x2620])},
      {family: 'DejaVu Sans Mono', coverage: ASCII},
      {family: 'Cinzel', coverage: ASCII},
    ]);
    const {fonts} = resolveFonts(s, c);
    const source = 'Inline `☠` code.\n\n```\n☠ block\n```\n\n![☠ cap](a.png)\n';
    const warnings = checkGlyphs(parse(source).root, fonts, c);
    expect(warnings.map((w) => [w.message, w.line])).toEqual([
      [
        'Font "DejaVu Sans Mono" lacks 1 character: ☠ U+2620 (first at line 1)',
        1,
      ],
      ['Font "Cinzel" lacks 1 character: ☠ U+2620 (first at line 7)', 7],
    ]);
  });

  it('US-010 AC-5: lists, tables, quotes, footnotes, link and emphasis text all count as body', () => {
    for (const source of [
      '- ☠ item\n',
      '| a | b |\n|---|---|\n| ☠ | c |\n',
      '> ☠ quote\n',
      'x[^1]\n\n[^1]: ☠ note\n',
      '[☠ link](https://example.org)\n',
      '**☠ bold** and *☠ em*\n',
      'text^[☠ inline note]\n',
      '[[Page|☠ alias]]\n',
    ]) {
      expect(
        lacks(source).map((w) => w.code),
        source,
      ).toEqual(['FONT_GLYPH_MISSING']);
    }
  });

  it('US-010 AC-5: a comment is dropped and not checked', () => {
    expect(lacks('text\n\n<!-- ☠ -->\n')).toEqual([]);
  });

  it('US-010 AC-5: the same family used by two roles gets one warning with the union and the first line', () => {
    const warnings = lacks('# ⚔ head\n\nbody ☠\n');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toBe(
      'Font "Libertinus Serif" lacks 2 characters: ☠ U+2620, ⚔ U+2694 (first at line 1)',
    );
  });
});

describe('US-010 AC-5b and AC-6 feature glyphs and the picker', () => {
  it('US-010 AC-5b: the feature glyph list holds the two task-list glyphs', () => {
    expect(FEATURE_GLYPHS).toEqual([
      {char: '☐', codePoint: 0x2610},
      {char: '☒', codePoint: 0x2612},
    ]);
  });

  it('US-010 AC-6: names the feature glyphs a family lacks, and nothing for a font that has both', () => {
    const c = createFontCatalog([
      {family: 'Plain', coverage: ASCII},
      {family: 'Both', coverage: runs([0x2610, 0x2610], [0x2612, 0x2612])},
      {family: 'One', coverage: runs([0x2612, 0x2612])},
    ]);
    expect(missingFeatureGlyphs(c, 'Plain').map((g) => g.char)).toEqual([
      '☐',
      '☒',
    ]);
    expect(missingFeatureGlyphs(c, 'Both')).toEqual([]);
    expect(missingFeatureGlyphs(c, 'One').map((g) => g.char)).toEqual(['☐']);
  });

  it('US-010 AC-6: writes the notice of the worked example, and null when nothing is missing', () => {
    expect(featureGlyphNotice(FEATURE_GLYPHS)).toBe(
      'Missing: ☐ U+2610, ☒ U+2612. Task lists will use [ ] and [x].',
    );
    expect(featureGlyphNotice([FEATURE_GLYPHS[0]!])).toBe(
      'Missing: ☐ U+2610. Task lists will use [ ] and [x].',
    );
    expect(featureGlyphNotice([])).toBeNull();
  });

  it('US-010 AC-6: the dropdown lists the families sorted, and a current value that is not found first as "(not found)"', () => {
    expect(familyOptions(['Alpha', 'beta'], 'beta')).toEqual([
      {value: 'Alpha', label: 'Alpha'},
      {value: 'beta', label: 'beta'},
    ]);
    expect(familyOptions(['Alpha', 'beta'], 'Gone')).toEqual([
      {value: 'Gone', label: 'Gone (not found)'},
      {value: 'Alpha', label: 'Alpha'},
      {value: 'beta', label: 'beta'},
    ]);
    expect(familyOptions(['Alpha'], 'ALPHA')).toEqual([
      {value: 'Alpha', label: 'Alpha'},
    ]);
  });

  it('US-010 AC-6: a role dropdown starts with an entry for "use the default family"', () => {
    expect(familyOptions(['Alpha'], null, {allowUnset: true})).toEqual([
      {value: '', label: '(default family)'},
      {value: 'Alpha', label: 'Alpha'},
    ]);
  });
});
