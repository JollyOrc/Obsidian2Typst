// US-016 AC-7, AC-8, AC-9, AC-12, AC-13 — callout styles: the preset field
// `callouts` and its error messages, which style a callout gets field by field,
// the built-in styles and aliases, the font of a style and its icon. Source of
// truth: docs/user-stories/US-016-callout-styles.md.
import {describe, expect, it} from 'vitest';
import {convert, type ConvertSettings} from '../../src/core/convert';
import {
  DEFAULT_FONTS,
  createFontCatalog,
  type FontsSettings,
} from '../../src/core/fonts';
import {
  BUILTIN_CALLOUT_STYLES,
  CALLOUT_ALIASES,
  type CalloutsSettings,
} from '../../src/core/markers';
import {
  effectiveSettings,
  formatPresetError,
  parsePreset,
  validateFields,
} from '../../src/core/presets';
import {FakeIndex, NOTE_PATH, SETTINGS} from '../support/convert';

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

/** The first error of a preset note, formatted; null when it is valid. */
function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

const ICONS = 'Layouting/Icons';
const FILES = [
  NOTE_PATH,
  `${ICONS}/quill.png`,
  `${ICONS}/fake.png`,
  'Sample/icons/rune.svg',
];

/** Runs `convert` with callout settings, optional fonts and a font catalog. */
function run(
  source: string,
  callouts: CalloutsSettings,
  fonts?: FontsSettings,
) {
  const index = new FakeIndex(FILES);
  index.images.set(`${ICONS}/fake.png`, new TextEncoder().encode('not a png'));
  const settings: ConvertSettings = {...SETTINGS, callouts, fonts};
  return convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings,
    assets: index,
    fonts:
      fonts === undefined
        ? undefined
        : createFontCatalog([
            {family: 'Libertinus Serif', coverage: [32, 95]},
            {family: 'Cinzel', coverage: [32, 95]},
            {family: 'DejaVu Sans Mono', coverage: [32, 95]},
            {family: 'Say "hi" \\ Sans', coverage: [32, 95]},
          ]),
  });
}

/** The line of style `name` in the `callout-styles` dictionary. */
const styleLine = (typ: string, name: string): string =>
  typ.split('\n').find((l) => l.startsWith(`  "${name}": (`)) ?? '';

describe('US-016 AC-7 the preset field callouts', () => {
  it('US-016 AC-7: reads every field of a style with its line', () => {
    const result = parsePreset(
      note(
        'callouts:',
        '  default:',
        '    fill: "#f5f5f5"',
        '  example:',
        '    fill: "#f3ead7"',
        '    border: {color: "#8b5a2b", width: 1}',
        '    inset: 8',
        '    title: {text: "Example", color: "#8b5a2b"}',
        '    font: {family: "IM Fell English", size: 9.5}',
        '    icon: "Layouting/Icons/quill.png"',
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.callouts).toEqual({
      default: {fill: '#f5f5f5'},
      example: {
        fill: '#f3ead7',
        border: {color: '#8b5a2b', width: 1},
        inset: 8,
        title: {text: 'Example', color: '#8b5a2b'},
        font: {family: 'IM Fell English', size: 9.5},
        icon: 'Layouting/Icons/quill.png',
      },
    });
    expect(result.lines['callouts.example.inset']).toBe(9);
    expect(result.lines['callouts.example.icon']).toBe(12);
  });

  it('US-016 AC-7: accepts "none" for fill and icon, the bounds of the ranges, and null as unset', () => {
    expect(
      errorOf(
        'callouts:',
        '  a:',
        '    fill: none',
        '    icon: none',
        '    border: {color: "#000000", width: 0}',
        '    inset: 0',
        '    font: {size: 200}',
        '  b:',
        '    border: {width: 10}',
        '    inset: 50',
        '    title: {text: ""}',
        '    fill: null',
      ),
    ).toBeNull();
  });

  it('US-016 AC-7: refuses each invalid value with its message and line', () => {
    const cases: [string[], string][] = [
      [['callouts: 5'], 'callouts must be a group of styles (line 3)'],
      [
        ['callouts:', '  Example: {}'],
        'callouts.Example is not a valid style name (use a-z, 0-9, - and _) (line 4)',
      ],
      [
        ['callouts:', '  -x: {}'],
        'callouts.-x is not a valid style name (use a-z, 0-9, - and _) (line 4)',
      ],
      [
        ['callouts:', '  example: 3'],
        'callouts.example must be a group of settings (line 4)',
      ],
      [
        ['callouts:', '  example:', '    fill: red'],
        'callouts.example.fill must be a colour "#rrggbb" or "none" (line 5)',
      ],
      [
        ['callouts:', '  example:', '    border: 1'],
        'callouts.example.border must be a group of settings (line 5)',
      ],
      [
        ['callouts:', '  example:', '    border: {color: "#12345"}'],
        'callouts.example.border.color must be a colour "#rrggbb" (line 5)',
      ],
      [
        ['callouts:', '  example:', '    border: {width: 12}'],
        'callouts.example.border.width must be a number of pt from 0 to 10 (line 5)',
      ],
      [
        ['callouts:', '  example:', '    inset: -1'],
        'callouts.example.inset must be a number of pt from 0 to 50 (line 5)',
      ],
      [
        ['callouts:', '  example:', '    title: "x"'],
        'callouts.example.title must be a group of settings (line 5)',
      ],
      [
        ['callouts:', '  example:', '    title: {text: 5}'],
        'callouts.example.title.text must be text (line 5)',
      ],
      [
        ['callouts:', '  example:', '    title: {color: none}'],
        'callouts.example.title.color must be a colour "#rrggbb" (line 5)',
      ],
      [
        ['callouts:', '  example:', '    font: "Cinzel"'],
        'callouts.example.font must be a group of settings (line 5)',
      ],
      [
        ['callouts:', '  example:', '    font: {family: ""}'],
        'callouts.example.font.family must be a font family name written as text (line 5)',
      ],
      [
        ['callouts:', '  example:', '    font: {size: 0}'],
        'callouts.example.font.size must be a number of pt greater than 0 and at most 200 (line 5)',
      ],
      [
        ['callouts:', '  example:', '    icon: 7'],
        'callouts.example.icon must be a vault path written as text, or "none" (line 5)',
      ],
    ];
    for (const [lines, message] of cases) {
      expect(errorOf(...lines), lines.join(' | ')).toBe(message);
    }
  });

  it('US-016 AC-7: refuses out-of-range numbers at both ends and numbers written as text', () => {
    for (const value of ['10.5', '-0.1', '"1"', 'true']) {
      expect(
        errorOf('callouts:', '  x:', `    border: {width: ${value}}`),
        value,
      ).toBe(
        'callouts.x.border.width must be a number of pt from 0 to 10 (line 5)',
      );
    }
    for (const value of ['50.1', '"8"']) {
      expect(errorOf('callouts:', '  x:', `    inset: ${value}`), value).toBe(
        'callouts.x.inset must be a number of pt from 0 to 50 (line 5)',
      );
    }
    for (const value of ['200.5', '-3']) {
      expect(
        errorOf('callouts:', '  x:', `    font: {size: ${value}}`),
        value,
      ).toBe(
        'callouts.x.font.size must be a number of pt greater than 0 and at most 200 (line 5)',
      );
    }
  });

  it('US-016 AC-7: ignores and keeps unknown fields inside a style', () => {
    const result = parsePreset(
      note('callouts:', '  x:', '    shadow: true', '    inset: 3'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fields.callouts?.x?.inset).toBe(3);
  });
});

describe('US-016 AC-8 which style, field by field (preset notes only)', () => {
  it('US-016 AC-8: the effective settings carry the preset callouts; the Defaults have none', () => {
    const parsed = parsePreset(
      note('callouts:', '  example:', '    fill: "#f3ead7"'),
    );
    if (!parsed.ok) throw new Error('valid');
    const result = effectiveSettings(
      parsed,
      {callouts: {example: {fill: '#000000'}, tip: {inset: 1}}} as never,
      () => false,
    );
    expect(result.ok && result.settings.callouts).toEqual({
      example: {fill: '#f3ead7'},
    });
    const plain = effectiveSettings({fields: {}, lines: {}}, {}, () => false);
    expect(plain.ok && plain.settings.callouts).toEqual({});
    const defaults = validateFields({
      callouts: {example: {fill: '#000000'}},
      highlightColor: '#a5d6a7',
    });
    expect(defaults.ok && defaults.fields).toEqual({highlightColor: '#a5d6a7'});
  });

  it('US-016 AC-8: preset example fill over built-in example; built-in example inset wins over preset default inset', async () => {
    const {typ} = await run('> [!example] E', {
      example: {fill: '#f3ead7'},
      default: {inset: 4},
    });
    expect(styleLine(typ, 'example')).toBe(
      '  "example": (fill: rgb("#f3ead7"), stroke: 0.75pt + rgb("#7852ee"), inset: 8pt, title-color: rgb("#7852ee"), font: none, size: none, icon: none),',
    );
  });

  it('US-016 AC-8: a user style takes its missing fields from preset default, then built-in default', async () => {
    const {typ} = await run('> [!rule-note] R', {
      'rule-note': {fill: '#ffffff'},
      default: {inset: 4},
    });
    expect(styleLine(typ, 'rule-note')).toBe(
      '  "rule-note": (fill: rgb("#ffffff"), stroke: 0.75pt + rgb("#9e9e9e"), inset: 4pt, title-color: rgb("#9e9e9e"), font: none, size: none, icon: none),',
    );
  });

  it('US-016 AC-8: a user style named like an alias wins over the alias', async () => {
    const {typ, warnings} = await run('> [!summary] S', {
      summary: {fill: '#ffffff'},
    });
    expect(typ).toContain('#callout("summary", title: [S])[');
    expect(styleLine(typ, 'summary')).toContain('fill: rgb("#ffffff")');
    expect(styleLine(typ, 'abstract')).toBe('');
    expect(warnings).toEqual([]);
  });

  it('US-016 AC-8: a preset field changes only that field of a built-in style (border color, not width)', async () => {
    const {typ} = await run('> [!note] N', {
      note: {border: {color: '#000000'}},
    });
    expect(styleLine(typ, 'note')).toContain('stroke: 0.75pt + rgb("#000000")');
    expect(styleLine(typ, 'note')).toContain('fill: rgb("#e6f0fc")');
  });
});

/** Rounds half up: the fill of AC-9 is the colour at 10 % on white. */
const tint = (hex: string): string =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.floor(
        0.9 * 255 + 0.1 * Number.parseInt(hex.slice(i, i + 2), 16) + 0.5,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

describe('US-016 AC-9 built-in styles and aliases', () => {
  const TABLE: [string, string, string][] = [
    ['default', '#9e9e9e', '#f5f5f5'],
    ['note', '#086ddd', '#e6f0fc'],
    ['abstract', '#00bfbc', '#e6f9f8'],
    ['info', '#086ddd', '#e6f0fc'],
    ['todo', '#086ddd', '#e6f0fc'],
    ['tip', '#00bfbc', '#e6f9f8'],
    ['success', '#08b94e', '#e6f8ed'],
    ['question', '#ec7500', '#fdf1e6'],
    ['warning', '#ec7500', '#fdf1e6'],
    ['failure', '#e93147', '#fdeaed'],
    ['danger', '#e93147', '#fdeaed'],
    ['bug', '#e93147', '#fdeaed'],
    ['example', '#7852ee', '#f2eefd'],
    ['quote', '#9e9e9e', '#f5f5f5'],
  ];

  it('US-016 AC-9: has exactly the 14 styles of the table, with fill = 10 % tint, border 0.75 pt, inset 8, no font, no icon', () => {
    expect(Object.keys(BUILTIN_CALLOUT_STYLES).sort()).toEqual(
      TABLE.map(([name]) => name).sort(),
    );
    for (const [name, colour, fill] of TABLE) {
      expect(tint(colour), name).toBe(fill);
      expect(BUILTIN_CALLOUT_STYLES[name], name).toEqual({
        fill,
        border: {color: colour, width: 0.75},
        inset: 8,
        title: {text: null, color: colour},
        font: {family: null, size: null},
        icon: null,
      });
    }
  });

  it('US-016 AC-9: has exactly the aliases of the table', () => {
    expect(CALLOUT_ALIASES).toEqual({
      summary: 'abstract',
      tldr: 'abstract',
      hint: 'tip',
      important: 'tip',
      check: 'success',
      done: 'success',
      help: 'question',
      faq: 'question',
      caution: 'warning',
      attention: 'warning',
      fail: 'failure',
      missing: 'failure',
      error: 'danger',
      cite: 'quote',
    });
  });

  it('US-016 AC-9: an alias writes its target style name, is titled by the alias as typed, and gives no warning', async () => {
    const titled = await run('> [!faq] Why?', {});
    expect(titled.typ).toContain('#callout("question", title: [Why?])[');
    const untitled = await run('> [!FAQ]', {});
    expect(untitled.typ).toContain('#callout("question", title: [Faq])[');
    expect([...titled.warnings, ...untitled.warnings]).toEqual([]);
  });
});

describe('US-016 AC-12 the font of a style', () => {
  const fonts = (): FontsSettings => structuredClone(DEFAULT_FONTS);

  it('US-016 AC-12: a found family is written as the font reports it, with the size', async () => {
    const {typ, warnings} = await run(
      '> [!example] E',
      {example: {font: {family: 'cinzel', size: 9.5}}},
      fonts(),
    );
    expect(styleLine(typ, 'example')).toContain('font: "Cinzel", size: 9.5pt');
    expect(warnings).toEqual([]);
  });

  it('US-016 AC-12: a missing family is one FONT_MISSING per family, and the style writes font: none', async () => {
    const {typ, warnings} = await run(
      '> [!example] E\n\n> [!tip] T\n\n> [!example] F',
      {example: {font: {family: 'Nope'}}, tip: {font: {family: 'Nope'}}},
      fonts(),
    );
    expect(styleLine(typ, 'example')).toContain('font: none, size: none');
    expect(styleLine(typ, 'tip')).toContain('font: none, size: none');
    expect(warnings).toEqual([
      {
        code: 'FONT_MISSING',
        message:
          'Font "Nope" for callout example was not found; "Libertinus Serif" is used',
        line: 0,
      },
    ]);
  });

  it('US-016 AC-12: a family name with a quote and a backslash goes through typstString', async () => {
    const {typ} = await run(
      '> [!example] E',
      {example: {font: {family: 'Say "hi" \\ Sans'}}},
      fonts(),
    );
    expect(styleLine(typ, 'example')).toContain(
      'font: "Say \\"hi\\" \\\\ Sans"',
    );
  });

  it('US-016 AC-12: the font of an unused style is not looked up and gives no warning', async () => {
    const {warnings} = await run(
      '> [!note] N',
      {example: {font: {family: 'Nope'}}},
      fonts(),
    );
    expect(warnings).toEqual([]);
  });
});

describe('US-016 AC-13 the icon of a style', () => {
  it('US-016 AC-13: is copied by the asset rules (outside the note folder: assets/_external) and its destination is written', async () => {
    const {typ, assets, warnings} = await run('> [!example] E', {
      example: {icon: `${ICONS}/quill.png`},
    });
    expect(styleLine(typ, 'example')).toContain(
      'icon: "assets/_external/quill.png")',
    );
    expect(assets).toEqual([
      {from: `${ICONS}/quill.png`, to: 'assets/_external/quill.png'},
    ]);
    expect(warnings).toEqual([]);
  });

  it('US-016 AC-13: an icon inside the note folder keeps its relative path', async () => {
    const {typ, assets} = await run('> [!tip] T', {
      tip: {icon: 'Sample/icons/rune.svg'},
    });
    expect(styleLine(typ, 'tip')).toContain('icon: "icons/rune.svg")');
    expect(assets).toEqual([
      {from: 'Sample/icons/rune.svg', to: 'icons/rune.svg'},
    ]);
  });

  it('US-016 AC-13: one icon used by two styles and three callouts is copied once', async () => {
    const {assets} = await run('> [!example] a\n\n> [!tip] b\n\n> [!tip] c', {
      example: {icon: `${ICONS}/quill.png`},
      tip: {icon: `${ICONS}/quill.png`},
    });
    expect(assets).toEqual([
      {from: `${ICONS}/quill.png`, to: 'assets/_external/quill.png'},
    ]);
  });

  it('US-016 AC-13: a missing icon and a file that is not an image warn once per style at line 0 and write icon: none', async () => {
    const {typ, assets, warnings} = await run(
      '> [!example] a\n\n> [!example] b\n\n> [!tip] c',
      {
        example: {icon: `${ICONS}/nope.png`},
        tip: {icon: `${ICONS}/fake.png`},
      },
    );
    expect(styleLine(typ, 'example')).toContain('icon: none)');
    expect(styleLine(typ, 'tip')).toContain('icon: none)');
    expect(assets).toEqual([]);
    expect(warnings).toEqual([
      {
        code: 'CALLOUT_ICON_MISSING',
        message:
          'Icon "Layouting/Icons/nope.png" of callout style "example" was not found; the box is drawn without it',
        line: 0,
      },
      {
        code: 'CALLOUT_ICON_MISSING',
        message:
          'Icon "Layouting/Icons/fake.png" of callout style "tip" is not an image; the box is drawn without it',
        line: 0,
      },
    ]);
  });

  it('US-016 AC-13: the icon of an unused style is neither copied nor warned about', async () => {
    const {assets, warnings} = await run('> [!note] N', {
      example: {icon: `${ICONS}/nope.png`},
      tip: {icon: `${ICONS}/quill.png`},
    });
    expect(assets).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('US-016 AC-13: icon "none" writes icon: none without a warning', async () => {
    const {typ, warnings} = await run('> [!example] E', {
      example: {icon: 'none'},
    });
    expect(styleLine(typ, 'example')).toContain('icon: none)');
    expect(warnings).toEqual([]);
  });

  it('US-016 AC-13: an icon next to a body image with the same name gets -2 (SCAR-011: one used-name set)', async () => {
    const index = new FakeIndex([
      NOTE_PATH,
      `${ICONS}/quill.png`,
      'Other/quill.png',
    ]);
    const {assets} = await convert({
      source: '![Q](../Other/quill.png)\n\n> [!example] E',
      noteName: 'Rules',
      notePath: NOTE_PATH,
      settings: {
        ...SETTINGS,
        callouts: {example: {icon: `${ICONS}/quill.png`}},
      },
      assets: index,
    });
    expect(assets.map((a) => a.to).sort()).toEqual([
      'assets/_external/quill-2.png',
      'assets/_external/quill.png',
    ]);
  });
});
