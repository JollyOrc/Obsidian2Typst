// US-018 AC-1 to AC-3, AC-5, AC-6, AC-9 — page numbers after internal links
// in the conversion: the three fields and their messages, the effective
// settings, the built-in A4 digital note, which links get a number at every
// level (SCAR-019), the exact Typst of the call and the preamble rule
// `page-refs`, the composed cases (SCAR-002), the marks, the switches, the
// join guard over the fixture (SCAR-010), the template-name class and the one
// writer of the helper (SCAR-017). The pages are compiled in
// tests/integration/us-018-page-refs-pdf.test.ts.
// Source of truth: docs/user-stories/US-018-page-numbers-for-internal-links.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {type ConvertSettings} from '../../src/core/convert';
import {PREAMBLE_RULES} from '../../src/core/convert/preamble';
import {pageRefHelper} from '../../src/core/emit';
import {
  BUILTIN_DEFAULTS,
  BUILTIN_PRESET_TEXTS,
  effectiveSettings,
  formatPresetError,
  parsePreset,
  validateFields,
} from '../../src/core/presets';
import {PLUGIN_NAMES} from '../../src/core/template';
import {SETTINGS, run} from '../support/convert';
import {readManifest, readSample} from '../support/sample';
import {PAGE_REF, REF} from '../support/page-refs';

/** US-018: the settings `convert` gets (absent today, so passed untyped). */
interface Refs {
  linkPageNumbers: boolean;
  linkPageLevel: number;
  linkPageWord: string;
}
const ON: Refs = {linkPageNumbers: true, linkPageLevel: 2, linkPageWord: 'p.'};

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

/**
 * Converts `source` with the page-reference fields `refs` (unset: none) and
 * folios on or off (US-019; the header is off so that only the body counts).
 */
const convertWith = (source: string, refs?: Partial<Refs>, folios = true) =>
  run(source, {
    settings: {
      ...SETTINGS,
      pageFurniture: {folios, runningHeader: false, runningHeaderLevel: 2},
      ...refs,
    } as ConvertSettings,
  });

/** The preamble: everything before the first blank line. */
const preambleOf = (typ: string): string => typ.slice(0, typ.indexOf('\n\n'));

/** The labels that get a call in `text`, in order. */
const refsIn = (text: string): string[] =>
  [...text.matchAll(/#page-ref\(<([^>]+)>\)/g)].map((m) => m[1] as string);

describe('US-018 AC-1 the fields', () => {
  it('US-018 AC-1: reads linkPageNumbers, linkPageLevel and linkPageWord with their lines', () => {
    const result = parsePreset(
      note('linkPageNumbers: false', 'linkPageLevel: 3', 'linkPageWord: "S."'),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.linkPageNumbers).toBe(false);
    expect(result.fields.linkPageLevel).toBe(3);
    expect(result.fields.linkPageWord).toBe('S.');
    expect(result.lines['linkPageLevel']).toBe(4);
  });

  it('US-018 AC-1: accepts levels 1 and 6 and null as unset', () => {
    expect(errorOf('linkPageLevel: 1')).toBeNull();
    expect(errorOf('linkPageLevel: 6')).toBeNull();
    expect(errorOf('linkPageNumbers: null')).toBeNull();
    expect(errorOf('linkPageWord: null')).toBeNull();
  });

  it('US-018 AC-1: refuses each invalid value with its message and line', () => {
    const cases: [string, string][] = [
      [
        'linkPageNumbers: yes',
        'linkPageNumbers must be true or false (line 3)',
      ],
      ['linkPageNumbers: 1', 'linkPageNumbers must be true or false (line 3)'],
      [
        'linkPageLevel: 7',
        'linkPageLevel must be a whole number from 1 to 6 (line 3)',
      ],
      [
        'linkPageLevel: 0',
        'linkPageLevel must be a whole number from 1 to 6 (line 3)',
      ],
      [
        'linkPageLevel: 2.5',
        'linkPageLevel must be a whole number from 1 to 6 (line 3)',
      ],
      [
        'linkPageLevel: "2"',
        'linkPageLevel must be a whole number from 1 to 6 (line 3)',
      ],
      ['linkPageWord: ""', 'linkPageWord must be text (line 3)'],
      ['linkPageWord: 5', 'linkPageWord must be text (line 3)'],
    ];
    for (const [line, message] of cases) {
      expect(errorOf(line), line).toBe(message);
    }
  });

  it('US-018 AC-1: the Defaults may hold the fields too', () => {
    const result = validateFields({
      linkPageLevel: 3,
      linkPageWord: 'S.',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.linkPageLevel).toBe(3);
    expect(result.fields.linkPageWord).toBe('S.');
  });

  it('US-018 AC-1: built-in values are true, 2 and "p."', () => {
    expect(BUILTIN_DEFAULTS.linkPageNumbers).toBe(true);
    expect(BUILTIN_DEFAULTS.linkPageLevel).toBe(2);
    expect(BUILTIN_DEFAULTS.linkPageWord).toBe('p.');
  });

  it('US-018 AC-1: the effective settings take preset, then Defaults, then built-in, field by field', () => {
    const parsed = parsePreset(note('linkPageLevel: 3'));
    if (!parsed.ok) throw new Error('valid');
    const result = effectiveSettings(
      parsed,
      {linkPageLevel: 4, linkPageWord: 'S.'},
      () => false,
    );
    if (!result.ok) throw new Error('valid');
    expect(result.settings.linkPageNumbers).toBe(true);
    expect(result.settings.linkPageLevel).toBe(3);
    expect(result.settings.linkPageWord).toBe('S.');
    // the Defaults' level counts when the preset does not set one
    const inherited = effectiveSettings(
      {fields: {}, lines: {}},
      {linkPageLevel: 4},
      () => false,
    );
    if (!inherited.ok) throw new Error('valid');
    expect(inherited.settings.linkPageLevel).toBe(4);
    const plain = effectiveSettings({fields: {}, lines: {}}, {}, () => false);
    if (!plain.ok) throw new Error('valid');
    expect(plain.settings.linkPageNumbers).toBe(true);
    expect(plain.settings.linkPageLevel).toBe(2);
    expect(plain.settings.linkPageWord).toBe('p.');
  });

  it('US-018 AC-1: the built-in note A4 digital switches the numbers off; A5 print does not set them', () => {
    const digital = BUILTIN_PRESET_TEXTS['A4 digital'];
    expect(digital).toContain('\nlinkPageNumbers: false\n');
    const parsed = parsePreset(digital);
    expect(parsed.ok && parsed.fields.linkPageNumbers).toBe(false);
    expect(BUILTIN_PRESET_TEXTS['A5 print']).not.toContain('linkPage');
  });
});

describe('US-018 AC-2 which links get a number (every level, SCAR-019)', () => {
  const SOURCE = [
    '# Rules',
    '',
    'Body [Rules](#rules), [Tessera](#tessera), [Moss](#moss), [Detail](#detail), [Gambit](#gambit).',
    '',
    '## Tessera',
    '',
    '### Moss',
    '',
    '###### Detail',
    '',
    '# Glossary',
    '',
    '## Gambit',
    '',
    'Gloss [Rules](#rules), [Tessera](#tessera), [Moss](#moss), [Detail](#detail).',
    '',
    '## Bonus',
    '',
    'See [Gambit](#gambit).',
  ].join('\n');

  /** The labels with a call in the line that starts with `start`. */
  const refsOfLine = (typ: string, start: string): string[] =>
    refsIn(typ.split('\n').find((l) => l.includes(start)) ?? '');

  const table: [number, string[]][] = [
    [1, ['h-rules']],
    [2, ['h-rules', 'h-tessera', 'h-gambit']],
    [3, ['h-rules', 'h-tessera', 'h-moss', 'h-gambit']],
    [6, ['h-rules', 'h-tessera', 'h-moss', 'h-detail', 'h-gambit']],
  ];
  for (const [level, body] of table) {
    it(`US-018 AC-2: linkPageLevel ${level}: the body numbers ${body.join(', ')}; a glossary explanation numbers every link`, async () => {
      const {typ} = await convertWith(SOURCE, {...ON, linkPageLevel: level});
      expect(refsOfLine(typ, 'Body ')).toEqual(body);
      expect(refsOfLine(typ, 'Gloss ')).toEqual([
        'h-rules',
        'h-tessera',
        'h-moss',
        'h-detail',
      ]);
    });
  }

  it('US-018 AC-2: a link to a term inside another term explanation gets a number at level 1', async () => {
    const {typ} = await convertWith(SOURCE, {...ON, linkPageLevel: 1});
    expect(typ).toContain(`#link(<h-gambit>)[Gambit]${REF('h-gambit')};.`);
  });

  it('US-018 AC-2: a footnote called from an explanation follows it; one called from the body does not (decided 2026-10-21)', async () => {
    const source = [
      '# Rules',
      '',
      'Body note[^2].',
      '',
      '## Tessera',
      '',
      '### Moss',
      '',
      '# Glossary',
      '',
      '## Gambit',
      '',
      'An act[^1].',
      '',
      '[^1]: See [Moss](#moss).',
      '[^2]: Also [Moss](#moss).',
    ].join('\n');
    const {typ} = await convertWith(source, ON);
    expect(typ).toContain(
      `#footnote[See #link(<h-moss>)[Moss]${REF('h-moss')};.]`,
    );
    expect(typ).toContain('#footnote[Also #link(<h-moss>)[Moss];.]');
  });

  it('US-018 AC-2: a footnote called from the body and from an explanation reports its warning once (US-005)', async () => {
    const source = [
      '# Rules',
      '',
      'Body[^1].',
      '',
      '### Moss',
      '',
      '# Glossary',
      '',
      '## Gambit',
      '',
      'An act[^1].',
      '',
      '[^1]: See [Moss](#moss) and [x](#nowhere).',
    ].join('\n');
    const {typ, warnings} = await convertWith(source, ON);
    expect(typ).toContain('#footnote[See #link(<h-moss>)[Moss] and x.]');
    expect(typ).toContain(
      `#footnote[See #link(<h-moss>)[Moss]${REF('h-moss')} and x.]`,
    );
    expect(warnings.filter((w) => w.code === 'LINK_UNRESOLVED')).toHaveLength(
      1,
    );
  });

  it('US-018 AC-2: the glossary intro before the first term is not an explanation', async () => {
    const source = [
      '# Rules',
      '',
      '### Moss',
      '',
      '# Glossary',
      '',
      'Intro, see [Moss](#moss).',
      '',
      '## Gambit',
      '',
      'An act, see [Moss](#moss).',
    ].join('\n');
    const {typ} = await convertWith(source, ON);
    expect(typ).toContain('Intro, see #link(<h-moss>)[Moss];.');
    expect(typ).toContain(
      `An act, see #link(<h-moss>)[Moss]${REF('h-moss')};.`,
    );
  });

  it('US-018 AC-2: a callout inside an explanation is part of it (two levels deep)', async () => {
    const source = [
      '# Rules',
      '',
      '## Tessera',
      '',
      '### Moss',
      '',
      '# Glossary',
      '',
      '## Gambit',
      '',
      'An act.',
      '',
      '> [!note] N',
      '> See [Moss](#moss).',
    ].join('\n');
    const {typ} = await convertWith(source, ON);
    expect(typ).toContain(`  See #link(<h-moss>)[Moss]${REF('h-moss')};.\n`);
  });

  it('US-018 AC-2 rule 1: with folios off no link gets a number', async () => {
    const {typ} = await convertWith(SOURCE, {...ON, linkPageLevel: 6}, false);
    expect(refsIn(typ)).toEqual([]);
    expect(typ).not.toContain('page-ref');
  });

  it('US-018 AC-2 rule 2: a link in a heading gets none (also a term heading)', async () => {
    const source = [
      '# Rules',
      '',
      '## See [Tessera](#tessera)',
      '',
      '## Tessera',
      '',
      '# Glossary',
      '',
      '## See [Rules](#rules)',
      '',
      'x',
    ].join('\n');
    const {typ} = await convertWith(source, {...ON, linkPageLevel: 6});
    expect(refsIn(typ)).toEqual([]);
    expect(typ).toContain('== See #link(<h-tessera>)[Tessera] <h-see-tessera>');
  });

  it('US-018 AC-2: an unresolved link gets none', async () => {
    const {typ} = await convertWith('# Rules\n\nMissing [x](#nowhere) here.', {
      ...ON,
      linkPageLevel: 6,
    });
    expect(typ).toContain('Missing x here.');
    expect(typ).not.toContain('page-ref');
  });

  it('US-018 AC-2: a target on the link page still gets the number (decision 3)', async () => {
    const {typ} = await convertWith('# Rules\n\nSee [Rules](#rules).', ON);
    expect(typ).toContain(`See #link(<h-rules>)[Rules]${REF('h-rules')};.`);
  });
});

describe('US-018 AC-3 the Typst shape and the rule page-refs', () => {
  const SOURCE =
    '# Rules\n\n## Raising a Banner\n\nSee [Raising a Banner](#1.5-raising-a-banner).';

  it('US-018 AC-3: the call follows the link; the separator moves behind it', async () => {
    const {typ} = await convertWith(SOURCE, ON);
    expect(typ).toContain(
      'See #link(<h-raising-a-banner>)[Raising a Banner]#page-ref(<h-raising-a-banner>);.',
    );
  });

  it('US-018 AC-3: is registered as page-refs with order 47', () => {
    expect(PREAMBLE_RULES.find((r) => r.id === 'page-refs')?.order).toBe(47);
  });

  it('US-018 AC-3: the preamble holds the helper exactly, after page-furniture and before highlight', async () => {
    const preamble = preambleOf((await convertWith(SOURCE, ON)).typ);
    expect(preamble.split('\n')).toContain(PAGE_REF('p.'));
    const at = (part: string) => preamble.indexOf(part);
    expect(at('#let page-ref')).toBeGreaterThan(at('#set page(numbering:'));
    expect(at('#set highlight')).toBeGreaterThan(at('#let page-ref'));
  });

  it('US-018 AC-3: the word goes through escapeMarkup (S. as is, markup escaped)', async () => {
    const words: [string, string][] = [
      ['S.', 'S.'],
      ['p*', 'p\\*'],
      ['p]', 'p\\]'],
      ['@p', '\\@p'],
    ];
    for (const [word, escaped] of words) {
      const preamble = preambleOf(
        (await convertWith(SOURCE, {...ON, linkPageWord: word})).typ,
      );
      expect(preamble.split('\n'), word).toContain(PAGE_REF(escaped));
    }
  });

  it('US-018 AC-3: no rule when the body holds no call', async () => {
    const {typ} = await convertWith(
      '# Rules\n\n## Moss\n\nSee [Moss](#moss) and [x](https://example.org).',
      {...ON, linkPageLevel: 1},
    );
    expect(typ).not.toContain('page-ref');
  });

  it('US-018 AC-3: PLUGIN_NAMES hold page-ref', () => {
    expect(PLUGIN_NAMES).toContain('page-ref');
  });
});

describe('US-018 AC-5 composed cases (SCAR-002)', () => {
  const HEAD = '# Rules\n\n## Tessera\n\nc\n\n';
  const cases: [string, string, string][] = [
    [
      'glossary explanation',
      '# Glossary\n\n## Wandering\n\nConverts treasure. [see the Wandering chapter.](#raising-a-banner)\n\n# Rules\n\n## Raising a Banner\n\nx',
      '#glossary-term[Wandering] <h-wandering> Converts treasure. #link(<h-raising-a-banner>)[see the Wandering chapter.]#page-ref(<h-raising-a-banner>)',
    ],
    [
      'footnote',
      `${HEAD}x[^1]\n\n[^1]: See [Tessera](#tessera).`,
      `#footnote[See #link(<h-tessera>)[Tessera]${REF('h-tessera')};.]`,
    ],
    [
      'callout',
      `${HEAD}> [!note] N\n> See [Tessera](#tessera).`,
      `  See #link(<h-tessera>)[Tessera]${REF('h-tessera')};.\n`,
    ],
    [
      'table cell',
      `${HEAD}| [Tessera](#tessera) | b |\n|--|--|\n| c | d |`,
      `table.header([#link(<h-tessera>)[Tessera]${REF('h-tessera')}], [b])`,
    ],
    [
      'heading in a callout',
      `${HEAD}> [!note] N\n> ## Boxed\n> b\n\nSee [Boxed](#boxed).`,
      `See #link(<h-boxed>)[Boxed]${REF('h-boxed')};.`,
    ],
    [
      '( after a link',
      `${HEAD}[x](#tessera)(y)`,
      `#link(<h-tessera>)[x]${REF('h-tessera')};(y)`,
    ],
    [
      'letter after a link',
      `${HEAD}[x](#tessera)s`,
      `#link(<h-tessera>)[x]${REF('h-tessera')}s`,
    ],
    [
      'wikilinks',
      `${HEAD}[[#Tessera]], [[#Tessera|the fight]];`,
      `#link(<h-tessera>)[Tessera]${REF('h-tessera')}, #link(<h-tessera>)[the fight]${REF('h-tessera')};;`,
    ],
    [
      'footnote call after a link',
      `${HEAD}[Tessera](#tessera)[^2]\n\n[^2]: n`,
      `#link(<h-tessera>)[Tessera]${REF('h-tessera')}#footnote[n]`,
    ],
  ];
  for (const [name, source, expected] of cases) {
    it(`US-018 AC-5: ${name}`, async () => {
      const {typ} = await convertWith(source, ON);
      expect(typ).toContain(expected);
    });
  }
});

describe('US-018 AC-5 links inside marks (decided 2026-10-21)', () => {
  const HEAD = '# Rules\n\n## Tessera\n\nc\n\n';
  const cases: [string, string][] = [
    [
      'See **[Tessera](#tessera)** now.',
      'See *#link(<h-tessera>)[Tessera]*#page-ref(<h-tessera>) now.',
    ],
    [
      '**See [Tessera](#tessera).**',
      '*See #link(<h-tessera>)[Tessera]#page-ref(<h-tessera>);.*',
    ],
    [
      '***[Tessera](#tessera)***.',
      '_*#link(<h-tessera>)[Tessera]*_#page-ref(<h-tessera>);.',
    ],
    [
      'See ==[Tessera](#tessera)==.',
      'See #highlight[#link(<h-tessera>)[Tessera]]#page-ref(<h-tessera>);.',
    ],
    [
      'See ~~[Tessera](#tessera)~~(x)',
      'See #strike[#link(<h-tessera>)[Tessera]]#page-ref(<h-tessera>);(x)',
    ],
    [
      'See *[Tessera](#tessera)*[^1]\n\n[^1]: n',
      'See _#link(<h-tessera>)[Tessera]_#page-ref(<h-tessera>)#footnote[n]',
    ],
    [
      'See <u>[Tessera](#tessera)</u>.',
      'See #underline[#link(<h-tessera>)[Tessera]]#page-ref(<h-tessera>);.',
    ],
    [
      '**[Tessera](#tessera) and [Rules](#rules)**',
      '*#link(<h-tessera>)[Tessera]#page-ref(<h-tessera>) and #link(<h-rules>)[Rules]*#page-ref(<h-rules>)',
    ],
  ];
  for (const [md, expected] of cases) {
    it(`US-018 AC-5: ${md.split('\n')[0]}`, async () => {
      const {typ} = await convertWith(HEAD + md, ON);
      expect(typ).toContain(expected);
    });
  }
});

describe('US-018 AC-6 switches and determinism', () => {
  const SOURCE =
    '# Rules\n\nSee [Rules](#rules) and [Tessera](#tessera).\n\n## Tessera\n\nx';

  it('US-018 AC-6: linkPageNumbers false gives the Typst of a convert without the fields', async () => {
    const unset = (await convertWith(SOURCE)).typ;
    const off = (await convertWith(SOURCE, {...ON, linkPageNumbers: false}))
      .typ;
    expect(off).toBe(unset);
    expect(unset).not.toContain('page-ref');
  });

  it('US-018 AC-6: folios off gives the Typst of a convert without the fields', async () => {
    const unset = (await convertWith(SOURCE, undefined, false)).typ;
    const on = (await convertWith(SOURCE, ON, false)).typ;
    expect(on).toBe(unset);
  });

  it('US-018 AC-6: the same note and settings give the same Typst (rule 7)', async () => {
    const first = (await convertWith(SOURCE, ON)).typ;
    const second = (await convertWith(SOURCE, ON)).typ;
    expect(second).toBe(first);
    expect(refsIn(first)).toEqual(['h-rules', 'h-tessera']);
  });
});

describe('US-018 AC-9 the sample note', () => {
  const source = readSample('Book.md');
  const {numberedLinks} = readManifest();
  // The levels 1, 2 (default), 3 and 6; the counts are the generator's.
  const counts: [number, number][] = [1, 2, 3, 6].map((level) => [
    level,
    numberedLinks[String(level)] as number,
  ]);
  for (const [level, count] of counts) {
    it(`US-018 AC-9: linkPageLevel ${level} numbers the manifest's count of links`, async () => {
      const {typ} = await convertWith(source, {...ON, linkPageLevel: level});
      expect(refsIn(typ)).toHaveLength(count);
    });
  }

  it('US-018 AC-9: deterministic; the helper once', async () => {
    const first = (await convertWith(source, ON)).typ;
    const second = (await convertWith(source, ON)).typ;
    expect(second).toBe(first);
    expect(first.split('#let page-ref(').length - 1).toBe(1);
  });

  it('US-018 AC-3, SCAR-010: in the sample note every call follows a link to its own label and no . ( [ follows a call directly', async () => {
    const {typ} = await convertWith(source, {...ON, linkPageLevel: 6});
    const body = typ.slice(typ.indexOf('\n\n'));
    const calls = [...body.matchAll(/#page-ref\(<([^>]+)>\)([\s\S]?)/g)];
    expect(calls.length).toBe(numberedLinks['6']);
    for (const call of calls) {
      const before = body.slice(0, call.index);
      const lastLink = /^#link\(<([^>]+)>\)/.exec(
        before.slice(before.lastIndexOf('#link(')),
      );
      expect(lastLink?.[1], before.slice(-80)).toBe(call[1]);
      expect(['.', '(', '['], before.slice(-40)).not.toContain(call[2]);
    }
  });
});

describe('US-018 one writer of the helper (SCAR-017)', () => {
  it('US-018 AC-3: the emitter text equals the measured text of the tests', () => {
    expect(pageRefHelper('p.')).toBe(PAGE_REF('p.'));
  });

  it('US-018 AC-3: only one file under src/core/emit writes #let page-ref', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory()
          ? files(path)
          : path.endsWith('.ts')
            ? [path]
            : [];
      });
    const writers = files('src').filter((file) =>
      readFileSync(file, 'utf8').includes('#let page-ref'),
    );
    expect(writers).toHaveLength(1);
    expect(writers[0]).toMatch(/^src\/core\/emit\//);
  });
});
