// US-017 AC-1 to AC-9, AC-13, AC-14 — heading rules: the preset field
// `headingRules` and its messages, which headings match (every form, SCAR-009),
// which headings become terms, the Typst of a term (run-in and alone), the
// preamble rule `glossary`, labels and links (SCAR-011), the composed cases
// (SCAR-002), a section without terms, the fixture, and a deeper heading in a
// term. The Typst is compiled in tests/integration/us-017-glossary-pdf.test.ts.
// Source of truth: docs/user-stories/US-017-heading-rules-glossary.md.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {type ConvertSettings} from '../../src/core/convert';
import {PREAMBLE_RULES} from '../../src/core/convert/preamble';
import * as markers from '../../src/core/markers';
import {
  effectiveSettings,
  formatPresetError,
  parsePreset,
  validateFields,
} from '../../src/core/presets';
import {PLUGIN_NAMES, templateWarnings} from '../../src/core/template';
import {SETTINGS, run} from '../support/convert';
import {readManifest, readSample} from '../support/sample';

/** US-017 AC-1: the shape of the preset field (from the preset note). */
type HeadingRules = Record<string, 'glossary' | 'none'>;

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

/** The first error of a preset note, formatted; null when it is valid. */
function errorOf(...lines: string[]): string | null {
  const result = parsePreset(note(...lines));
  return result.ok ? null : formatPresetError(result.error);
}

/** Converts `source` with the preset field `headingRules` (default: unset). */
const convertWith = (source: string, headingRules?: HeadingRules) => {
  const settings = {...SETTINGS, headingRules} as ConvertSettings;
  return run(source, {settings});
};

/** The body of the `.typ`: everything after the first blank line. */
async function body(source: string, headingRules?: HeadingRules) {
  const {typ} = await convertWith(source, headingRules);
  const lines = typ.split('\n');
  return lines
    .slice(lines.indexOf('') + 1)
    .join('\n')
    .trimEnd();
}

const HELPER =
  '#let glossary-term(body, run-in: true) = { strong(body); if run-in [ — ] }';

describe('US-017 AC-1 the preset field headingRules', () => {
  it('US-017 AC-1: reads the mapping with its lines', () => {
    const result = parsePreset(
      note(
        'headingRules:',
        '  Glossary: glossary',
        '  Glossar: glossary',
        '  Terms: none',
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.headingRules).toEqual({
      Glossary: 'glossary',
      Glossar: 'glossary',
      Terms: 'none',
    });
    expect(result.lines['headingRules.Glossar']).toBe(5);
  });

  it('US-017 AC-1: null is unset', () => {
    expect(errorOf('headingRules: null')).toBeNull();
    expect(errorOf('headingRules:', '  Glossary: null')).toBeNull();
    // Unset, not `none`: a null entry must not switch the built-in rule off.
    const entry = parsePreset(note('headingRules:', '  Glossary: null'));
    expect(entry.ok && entry.fields.headingRules).toEqual({});
  });

  it('US-017 AC-1: refuses each invalid value with its message and line', () => {
    const cases: [string[], string][] = [
      [
        ['headingRules: glossary'],
        'headingRules must be a group of heading texts (line 3)',
      ],
      [
        ['headingRules: [Glossary]'],
        'headingRules must be a group of heading texts (line 3)',
      ],
      [
        ['headingRules:', '  Glossary: index'],
        'headingRules.Glossary must be a rule name: glossary, colophon, back-notes or none (line 4)',
      ],
      [
        ['headingRules:', '  Glossary: 5'],
        'headingRules.Glossary must be a rule name: glossary, colophon, back-notes or none (line 4)',
      ],
      [
        ['headingRules:', '  Glossary: {a: 1}'],
        'headingRules.Glossary must be a rule name: glossary, colophon, back-notes or none (line 4)',
      ],
      [
        ['headingRules:', '  Glossary: Glossary'],
        'headingRules.Glossary must be a rule name: glossary, colophon, back-notes or none (line 4)',
      ],
      [
        ['headingRules:', '  Glossary: glossary', '  glossary: none'],
        'headingRules has the heading text "glossary" twice (compared without case and trailing blanks) (line 5)',
      ],
      [
        ['headingRules:', '  "Glossary": glossary', '  "GLOSSARY  ": none'],
        'headingRules has the heading text "GLOSSARY  " twice (compared without case and trailing blanks) (line 5)',
      ],
    ];
    for (const [lines, message] of cases) {
      expect(errorOf(...lines), lines.join(' / ')).toBe(message);
    }
  });

  it('US-017 AC-1: the effective settings carry the preset headingRules; the Defaults have none', () => {
    const parsed = parsePreset(note('headingRules:', '  Glossar: glossary'));
    if (!parsed.ok) throw new Error('valid');
    const result = effectiveSettings(
      parsed,
      {headingRules: {Terms: 'glossary'}} as never,
      () => false,
    );
    expect(result.ok && result.settings.headingRules).toEqual({
      Glossar: 'glossary',
    });
    const plain = effectiveSettings({fields: {}, lines: {}}, {}, () => false);
    expect(plain.ok && plain.settings.headingRules).toEqual({});
    const fromDefaults = effectiveSettings(
      {fields: {}, lines: {}},
      {headingRules: {Terms: 'glossary'}} as never,
      () => false,
    );
    expect(fromDefaults.ok && fromDefaults.settings.headingRules).toEqual({});
    const defaults = validateFields({
      headingRules: {Glossary: 'none'},
      highlightColor: '#a5d6a7',
    });
    expect(defaults.ok && defaults.fields).toEqual({highlightColor: '#a5d6a7'});
  });

  it('US-017 AC-1: the built-in mapping holds Glossary: glossary (US-026 adds Colophon and Back notes)', () => {
    expect(
      (markers as Record<string, unknown>)['BUILTIN_HEADING_RULES'],
    ).toMatchObject({Glossary: 'glossary'});
  });

  it('US-017 AC-1: without the field the built-in rule applies; Glossary: none switches it off', async () => {
    const source = '# Glossary\n\n## Gambit\n\nA thing.';
    expect(await body(source)).toContain(
      '#glossary-term[Gambit] <h-gambit> A thing.',
    );
    expect(await body(source, {Glossary: 'none'})).toBe(
      '= Glossary <h-glossary>\n\n== Gambit <h-gambit>\n\nA thing.',
    );
    expect(await body(source, {'  glossary ': 'none'})).toContain(
      '== Gambit <h-gambit>',
    );
  });

  it('US-017 AC-1: a preset entry adds to the built-in mapping (Glossar and Glossary both match)', async () => {
    const result = await body(
      '# Glossar\n\n## A\n\na\n\n# Glossary\n\n## B\n\nb',
      {Glossar: 'glossary'},
    );
    expect(result).toContain('#glossary-term[A] <h-a> a');
    expect(result).toContain('#glossary-term[B] <h-b> b');
  });
});

describe('US-017 AC-2 which heading matches (every form, SCAR-009)', () => {
  const TERM = '\n\n## Gambit\n\nA thing.';
  const isTerm = async (heading: string): Promise<boolean> =>
    (await body(`${heading}${TERM}`)).includes('#glossary-term[Gambit]');

  it('US-017 AC-2: matches without case, with trailing blanks, with markup removed and with a comment', async () => {
    for (const heading of [
      '# Glossary',
      '# glossary',
      '# GLOSSARY',
      '# Glossary  ',
      '# Glossary <!-- c -->',
    ]) {
      expect(await isTerm(heading), heading).toBe(true);
    }
    expect(await body('## **Glossary**\n\n### Gambit\n\nA thing.')).toContain(
      '#glossary-term[Gambit] <h-gambit> A thing.',
    );
    expect(await body('## *Glossary*\n\n### Gambit\n\nA thing.')).toContain(
      '#glossary-term[Gambit]',
    );
  });

  it('US-017 AC-2: a run of blanks inside counts as one, and image alt text is left out (decided 2026-10-19)', async () => {
    expect(
      await body('# Tidal   Basin\n\n## Gambit\n\nA thing.', {
        'Tidal Basin': 'glossary',
      }),
    ).toContain('#glossary-term[Gambit] <h-gambit> A thing.');
    expect(
      await body('# Glossary\n\n## Gambit\n\nA thing.', {
        'Tidal   Basin': 'glossary',
        Glossary: 'none',
      }),
    ).not.toContain('glossary-term');
    expect(
      await body('# ![x](assets/map.png) Glossary\n\n## Gambit\n\nA thing.'),
    ).toContain('#glossary-term[Gambit] <h-gambit> A thing.');
  });

  it('US-017 AC-2: does not match another text or a paragraph that looks like a heading', async () => {
    for (const heading of [
      '# Glossary:',
      '# The Glossary',
      '# Glossaries',
      '#Glossary',
    ]) {
      expect(await isTerm(heading), heading).toBe(false);
    }
  });

  it('US-017 AC-2: a level-1 to level-5 heading can match; terms are one level below', async () => {
    for (let level = 1; level <= 5; level++) {
      const h = '#'.repeat(level);
      const t = '#'.repeat(level + 1);
      expect(
        await body(`${h} Glossary\n\n${t} Gambit\n\nA thing.`),
        String(level),
      ).toContain('#glossary-term[Gambit] <h-gambit> A thing.');
    }
  });
});

describe('US-017 AC-3 which headings become terms', () => {
  it('US-017 AC-3: the worked example: introduction kept, two terms, the next level-1 heading ends the section', async () => {
    expect(
      await body(
        '# Glossary\n\nBelow.\n\n## Gambit\n\nA thing.\n\n## Break\n\nDice.\n\n# End notes\n\nEnd.',
      ),
    ).toBe(
      [
        '= Glossary <h-glossary>',
        '',
        'Below.',
        '',
        '#glossary-term[Gambit] <h-gambit> A thing.',
        '',
        '#glossary-term[Break] <h-break> Dice.',
        '',
        '= End notes <h-end-notes>',
        '',
        'End.',
      ].join('\n'),
    );
  });

  it('US-017 AC-3: a heading of the same level as a level-2 Glossary ends the section; a level-1 heading too', async () => {
    const two = await body(
      '## Glossary\n\n### A\n\na\n\n## Next\n\n### B\n\nb',
    );
    expect(two).toContain('#glossary-term[A] <h-a> a');
    expect(two).toContain('== Next <h-next>');
    expect(two).toContain('=== B <h-b>');
    const one = await body('## Glossary\n\n### A\n\na\n\n# Up\n\n### B\n\nb');
    expect(one).toContain('= Up <h-up>');
    expect(one).toContain('=== B <h-b>');
  });

  it('US-017 AC-3: the section runs to the end of the note', async () => {
    expect(await body('# Glossary\n\n## A\n\na\n\n## B\n\nb')).toBe(
      '= Glossary <h-glossary>\n\n#glossary-term[A] <h-a> a\n\n#glossary-term[B] <h-b> b',
    );
  });

  it('US-017 AC-3: headings before the Glossary heading are not terms', async () => {
    expect(await body('## Early\n\nx\n\n# Glossary\n\n## A\n\na')).toContain(
      '== Early <h-early>',
    );
  });
});

describe('US-017 AC-4 the Typst of a run-in term', () => {
  it('US-017 AC-4: the call, the label, one blank, the paragraph text; later paragraphs as today', async () => {
    expect(
      await body(
        '# Glossary\n\n## Tidal Basin\n\nThe pool. Uses *dice*.\n\nSecond paragraph.',
      ),
    ).toBe(
      [
        '= Glossary <h-glossary>',
        '',
        '#glossary-term[Tidal Basin] <h-tidal-basin> The pool. Uses _dice_.',
        '',
        'Second paragraph.',
      ].join('\n'),
    );
  });

  it('US-017 AC-4: the term text goes through emitInline as heading text (markup, code)', async () => {
    expect(await body('# Glossary\n\n## Pool **bold** `x`\n\nText.')).toContain(
      '#glossary-term[Pool *bold* `x`] <h-pool-bold-x> Text.',
    );
  });

  it('US-017 AC-4: the term text is escaped at block start, because it starts a content block (decided 2026-10-19)', async () => {
    for (const [md, typ] of [
      ['- x', '\\- x'],
      ['+ x', '\\+ x'],
      ['1. x', '1\\. x'],
      ['= x', '\\= x'],
    ]) {
      expect(await body(`# Glossary\n\n## ${md}\n\nText.`), md).toContain(
        `#glossary-term[${typ}] <`,
      );
    }
  });

  it('US-017 AC-4: the paragraph keeps its escaping at block start (- , +, # and $ stay escaped)', async () => {
    const result = await body(
      '# Glossary\n\n## A\n\n\\- not a list\n\n## B\n\n\\# 5 and $3',
    );
    expect(result).toContain('#glossary-term[A] <h-a> \\- not a list');
    expect(result).toContain('#glossary-term[B] <h-b> \\# 5 and \\$3');
  });

  it('US-017 AC-4: a paragraph of several lines stays one paragraph after the term', async () => {
    expect(await body('# Glossary\n\n## A\n\nline one\nline two')).toContain(
      '#glossary-term[A] <h-a> line one\nline two',
    );
  });
});

describe('US-017 AC-5 a term without a leading paragraph', () => {
  it('US-017 AC-5: a list first: the term alone in a sticky block, no separator', async () => {
    expect(
      await body('# Glossary\n\n## Rapid Basin\n\n- list first\n- second'),
    ).toBe(
      [
        '= Glossary <h-glossary>',
        '',
        '#block(sticky: true)[#glossary-term(run-in: false)[Rapid Basin] <h-rapid-basin>]',
        '',
        '- list first',
        '- second',
      ].join('\n'),
    );
  });

  it('US-017 AC-5: an empty term before the next term, and at the end of the note', async () => {
    expect(await body('# Glossary\n\n## Empty term\n\n## Next\n\nx')).toBe(
      [
        '= Glossary <h-glossary>',
        '',
        '#block(sticky: true)[#glossary-term(run-in: false)[Empty term] <h-empty-term>]',
        '',
        '#glossary-term[Next] <h-next> x',
      ].join('\n'),
    );
    expect(await body('# Glossary\n\n## Last')).toBe(
      '= Glossary <h-glossary>\n\n#block(sticky: true)[#glossary-term(run-in: false)[Last] <h-last>]',
    );
  });

  it('US-017 AC-5: table, code, quote, callout and image first give the lone form', async () => {
    for (const first of [
      '| a |\n|---|\n| 1 |',
      '```\ncode\n```',
      '> quoted',
      '> [!example] E\n> body',
      '![Map](assets/map.png)',
    ]) {
      const result = await body(`# Glossary\n\n## A\n\n${first}`);
      expect(result, first).toContain(
        '#block(sticky: true)[#glossary-term(run-in: false)[A] <h-a>]\n\n',
      );
    }
  });

  it('US-017 AC-5: no warning for an empty explanation', async () => {
    const {warnings} = await convertWith('# Glossary\n\n## A\n\n## B\n\nb');
    expect(warnings).toEqual([]);
  });
});

describe('US-017 AC-6 the preamble rule glossary', () => {
  it('US-017 AC-6: is registered as glossary with order 86', () => {
    const rule = PREAMBLE_RULES.find((r) => r.id === 'glossary');
    expect(rule?.order).toBe(86);
  });

  it('US-017 AC-6: writes the helper of the story once, after callouts and before the cover', async () => {
    const {typ} = await convertWith(
      '> [!note] N\n\n# Glossary\n\n## A\n\na\n\n## B\n\n- b',
    );
    const preamble = typ.slice(0, typ.indexOf('\n\n= '));
    expect(preamble.split(HELPER).length - 1).toBe(1);
    expect(preamble.indexOf(HELPER)).toBeGreaterThan(
      preamble.indexOf('#let callout('),
    );
  });

  it('US-017 AC-6: is absent without a term (also with a Glossary heading that has none)', async () => {
    expect((await convertWith('# Rules\n\nText.')).typ).not.toContain(
      'glossary-term',
    );
    expect((await convertWith('# Glossary\n\nText.')).typ).not.toContain(
      'glossary-term',
    );
  });

  it('US-017 AC-6: PLUGIN_NAMES hold glossary-term; a template defining it gets TEMPLATE_NAME_TAKEN', () => {
    expect(PLUGIN_NAMES).toContain('glossary-term');
    expect(templateWarnings('#let x = 1\n#let glossary-term(b) = b\n')).toEqual(
      [
        {
          code: 'TEMPLATE_NAME_TAKEN',
          message:
            'Template line 2 defines "glossary-term", which the plugin also defines; the plugin\'s definition is used',
          line: 0,
        },
      ],
    );
  });

  it('US-017 AC-6: every #let of a preamble with terms defines a name of PLUGIN_NAMES (text check, SCAR-017)', async () => {
    const {typ} = await convertWith(
      '> [!note] N\n\n![Map](assets/map.png)\n\n# Glossary\n\n## A\n\na',
    );
    const preamble = typ.slice(0, typ.indexOf('\n\n= '));
    const names = [...preamble.matchAll(/^#let ([A-Za-z_][\w-]*)/gm)].map(
      (m) => m[1],
    );
    expect(names).toContain('glossary-term');
    for (const name of names) expect(PLUGIN_NAMES).toContain(name);
  });

  it('US-017 AC-6: the same note and settings give byte-identical Typst (rule 7)', async () => {
    const source = '# Glossary\n\nIntro.\n\n## A\n\na\n\n## B\n\n- b';
    const first = await convertWith(source, {Glossar: 'glossary'});
    const second = await convertWith(source, {Glossar: 'glossary'});
    expect(second.typ).toBe(first.typ);
  });
});

describe('US-017 AC-7 labels, links, numbering (SCAR-011)', () => {
  const NOTE = [
    '# Rules',
    '',
    'See [Tidal Basin](#tidal-basin) and [[#Gambit]].',
    '',
    '# Glossary',
    '',
    '## Gambit',
    '',
    'A thing, see [the pool](#tidal-basin).',
    '',
    '## Tidal Basin',
    '',
    'The pool.',
    '',
    '# End notes',
    '',
    'Back to [[#Gambit]].',
  ].join('\n');

  /** Every `<h-…>` label and every link target of `typ`, in order. */
  const labelsOf = (typ: string): string[] =>
    [...typ.matchAll(/(?<!link\()<(h-[a-z0-9-]+)>/g)].map(
      (m) => m[1] as string,
    );
  const targetsOf = (typ: string): string[] =>
    [...typ.matchAll(/#link\(<(h-[a-z0-9-]+)>\)/g)].map((m) => m[1] as string);

  it('US-017 AC-7: a term keeps the label it has as a heading', async () => {
    const result = await body(NOTE);
    expect(result).toContain('#glossary-term[Gambit] <h-gambit> A thing');
    expect(result).toContain(
      '#glossary-term[Tidal Basin] <h-tidal-basin> The pool.',
    );
  });

  it('US-017 AC-7: the labels and the link targets are the same with and without the rule (invariant)', async () => {
    const on = (await convertWith(NOTE)).typ;
    const off = (await convertWith(NOTE, {Glossary: 'none'})).typ;
    expect(labelsOf(on)).toEqual(labelsOf(off));
    expect(targetsOf(on)).toEqual(targetsOf(off));
    expect(targetsOf(on)).toEqual([
      'h-tidal-basin',
      'h-gambit',
      'h-tidal-basin',
      'h-gambit',
    ]);
  });

  it('US-017 AC-7: a term label is unique against a later heading of the same text (h-gambit-2)', async () => {
    const result = await body('# Glossary\n\n## Gambit\n\na\n\n# Gambit\n\nb');
    expect(result).toContain('#glossary-term[Gambit] <h-gambit> a');
    expect(result).toContain('= Gambit <h-gambit-2>');
  });

  it('US-017 AC-7: HEADING_EMPTY and HEADING_LEVEL_SKIPPED are unchanged by the rule', async () => {
    const source = '# Glossary\n\n##\n\n## A\n\na\n\n#### Deep skip\n\nd';
    const on = await convertWith(source);
    const off = await convertWith(source, {Glossary: 'none'});
    const codes = (w: {code: string; line: number}[]) =>
      w
        .filter(
          (x) => x.code.startsWith('HEADING_') && x.code !== 'HEADING_IN_TERM',
        )
        .map((x) => [x.code, x.line]);
    expect(codes(on.warnings)).toEqual(codes(off.warnings));
    expect(codes(on.warnings)).toContainEqual(['HEADING_EMPTY', 3]);
  });

  it('US-017 AC-7: the matched heading stays a heading with its label', async () => {
    expect(await body('# Glossary\n\n## A\n\na')).toMatch(
      /^= Glossary <h-glossary>\n/,
    );
  });
});

describe('US-017 AC-8 composed and nested cases (SCAR-002)', () => {
  it('US-017 AC-8: a level-2 Glossary has level-3 terms; ## Next ends it', async () => {
    expect(await body('## Glossary\n\n### Gambit\n\nA.\n\n## Next')).toBe(
      '== Glossary <h-glossary>\n\n#glossary-term[Gambit] <h-gambit> A.\n\n== Next <h-next>',
    );
  });

  it('US-017 AC-8: two sections are both applied', async () => {
    const result = await body(
      '# Glossary\n\n## A\n\na\n\n# Other\n\n## X\n\nx\n\n# Glossary\n\n## B\n\nb',
    );
    expect(result).toContain('#glossary-term[A] <h-a> a');
    expect(result).toContain('== X <h-x>');
    expect(result).toContain('#glossary-term[B] <h-b> b');
  });

  it('US-017 AC-8: a Glossary heading inside a callout or a list item gets no rule', async () => {
    expect(await body('> [!note] N\n> # Glossary\n> ## A\n> a')).toContain(
      '  == A <h-a>',
    );
    expect(await body('- x\n\n  ## Glossary\n\n  ### A\n\n  a')).toContain(
      '=== A <h-a>',
    );
  });

  it('US-017 AC-8: a callout after a term: lone term, then the callout', async () => {
    expect(
      await body('# Glossary\n\n## A\n\n> [!example] E\n> body'),
    ).toContain(
      '#block(sticky: true)[#glossary-term(run-in: false)[A] <h-a>]\n\n#callout("example", title: [E])[\n  body\n]',
    );
  });

  /** The text of the heading with `label` when the rule is off (as today). */
  async function headingText(source: string, label: string): Promise<string> {
    const off = await body(source, {Glossary: 'none'});
    const line = off.split('\n').find((l) => l.endsWith(` <${label}>`)) ?? '';
    return line.replace(/^=+ /, '').slice(0, -` <${label}>`.length);
  }

  it('US-017 AC-8: footnotes in the explanation and in the term are numbered in document order', async () => {
    const source =
      'Before[^a].\n\n# Glossary\n\n## A[^b]\n\nx[^c].\n\n[^a]: A.\n[^b]: B.\n[^c]: C.';
    const {typ} = await convertWith(source);
    const term = await headingText(source, 'h-a');
    expect(term).toContain('#footnote[B.]');
    expect(typ).toContain(`#glossary-term[${term}] <h-a> x`);
    const calls = [...typ.matchAll(/#footnote\[([ABC])\.\]/g)].map((m) => m[1]);
    expect(calls).toEqual(['A', 'B', 'C']);
  });

  it('US-017 AC-8: an image in a term is placed after the entry, with IMAGE_IN_HEADING', async () => {
    const result = await convertWith(
      '# Glossary\n\n## ![Map](assets/map.png) A\n\na',
    );
    expect(result.typ).toMatch(
      /#glossary-term\[A\] <h-a> a\n\n#figure\(fit-image\("assets\/map\.png"\)/,
    );
    expect(result.warnings.map((w) => [w.code, w.line])).toEqual([
      ['IMAGE_IN_HEADING', 3],
    ]);
  });

  it('US-017 AC-8: a wikilink as the term text is the link of US-004', async () => {
    const source = '# Tessera\n\n# Glossary\n\n## [[#Tessera]]\n\na';
    const term = await headingText(source, 'h-tessera-2');
    expect(term).toContain('#link(<h-tessera>)');
    expect(await body(source)).toContain(
      `#glossary-term[${term}] <h-tessera-2> a`,
    );
  });
});

describe('US-017 AC-9 a matched heading without terms', () => {
  it('US-017 AC-9: one warning at its line, nothing changed', async () => {
    const result = await convertWith(
      'Intro.\n\n# Glossary\n\nText.\n\n### Deep\n\nd',
    );
    expect(result.typ).toContain(
      '= Glossary <h-glossary>\n\nText.\n\n=== Deep <h-deep>',
    );
    expect(
      result.warnings.filter((w) => w.code === 'HEADING_RULE_NO_TERMS'),
    ).toEqual([
      {
        code: 'HEADING_RULE_NO_TERMS',
        message:
          'Heading "Glossary" has the rule glossary but no headings one level below it; nothing was changed',
        line: 3,
      },
    ]);
  });

  it('US-017 AC-9: a level-6 Glossary heading has no sub-level and warns; the text is as typed', async () => {
    const result = await convertWith('###### GLOSSARY\n\nx');
    expect(
      result.warnings.filter((w) => w.code === 'HEADING_RULE_NO_TERMS'),
    ).toEqual([
      {
        code: 'HEADING_RULE_NO_TERMS',
        message:
          'Heading "GLOSSARY" has the rule glossary but no headings one level below it; nothing was changed',
        line: 1,
      },
    ]);
  });

  it('US-017 AC-9: no warning when the mapping is none', async () => {
    const result = await convertWith('# Glossary\n\nText.', {Glossary: 'none'});
    expect(result.warnings).toEqual([]);
  });
});

describe('US-017 AC-13 the sample note', {timeout: 60_000}, () => {
  const source = readSample('Book.md');
  const {glossary, headings} = readManifest();

  it('US-017 AC-13: has the run-in terms of the manifest, no lone term, no HEADING_RULE_NO_TERMS, and the glossary rule', async () => {
    const result = await convertWith(source);
    const terms = [...result.typ.matchAll(/^#glossary-term\[/gm)];
    expect(terms).toHaveLength(glossary.terms.length);
    expect(result.typ).not.toContain('run-in: false');
    expect(result.typ).toContain(HELPER);
    expect(
      result.warnings.filter((w) =>
        ['HEADING_RULE_NO_TERMS', 'HEADING_IN_TERM'].includes(w.code),
      ),
    ).toEqual([]);
    // Every term run-in: the term, its label, then its first paragraph.
    for (const term of glossary.terms) {
      expect(result.typ, term).toMatch(
        new RegExp(`^#glossary-term\\[${term}\\] <h-[a-z0-9-]+> [A-Z]`, 'm'),
      );
    }
  });

  it('US-017 AC-13: outside the glossary section the Typst is the same as without the rule', async () => {
    const on = (await convertWith(source)).typ;
    const off = (await convertWith(source, {Glossary: 'none'})).typ;
    const bodyOf = (typ: string) => typ.slice(typ.indexOf('\n\n= '));
    const cut = (typ: string) => {
      const b = bodyOf(typ);
      // The H1 after the glossary ends its section.
      const h1 = headings['1'] ?? [];
      const after = h1[h1.indexOf(glossary.heading) + 1] as string;
      const end = b.indexOf(`\n= ${after} <`);
      expect(end).toBeGreaterThan(0);
      return [b.slice(0, b.indexOf('= Glossary <h-glossary>')), b.slice(end)];
    };
    expect(cut(on)).toEqual(cut(off));
    const warnings = (await convertWith(source)).warnings;
    const plain = (await convertWith(source, {Glossary: 'none'})).warnings;
    expect(warnings).toEqual(plain);
  });

  it('US-017 AC-13: the export is deterministic (rule 7)', async () => {
    expect((await convertWith(source)).typ).toBe(
      (await convertWith(source)).typ,
    );
  });
});

describe('US-017 AC-14 a deeper heading inside a term', () => {
  it('US-017 AC-14: stays a heading without number and outline entry, with HEADING_IN_TERM at its line', async () => {
    const result = await convertWith(
      '# Glossary\n\n## Gambit\n\nA thing.\n\n### Deep\n\ndeep text',
    );
    expect(result.typ).toContain(
      [
        '#glossary-term[Gambit] <h-gambit> A thing.',
        '',
        '#heading(level: 3, numbering: none, outlined: false)[Deep] <h-deep>',
        '',
        'deep text',
      ].join('\n'),
    );
    expect(result.warnings).toEqual([
      {
        code: 'HEADING_IN_TERM',
        message:
          'Heading "Deep" is inside the glossary term "Gambit"; it is printed without number and outline entry',
        line: 7,
      },
    ]);
  });

  it('US-017 AC-14: levels n + 3 and deeper too; the heading text goes through emitInline', async () => {
    const result = await convertWith(
      '# Glossary\n\n## A\n\na\n\n### B *x*\n\n#### C\n\nc',
    );
    expect(result.typ).toContain(
      '#heading(level: 3, numbering: none, outlined: false)[B _x_] <h-b-x>',
    );
    expect(result.typ).toContain(
      '#heading(level: 4, numbering: none, outlined: false)[C] <h-c>',
    );
    expect(
      result.warnings
        .filter((w) => w.code === 'HEADING_IN_TERM')
        .map((w) => w.line),
    ).toEqual([7, 9]);
  });

  it('US-017 AC-14: the text of an unnumbered heading is escaped at block start', async () => {
    const {typ} = await convertWith('# Glossary\n\n## A\n\na\n\n### - x\n\nd');
    expect(typ).toContain(
      '#heading(level: 3, numbering: none, outlined: false)[\\- x] <h-x>',
    );
  });

  it('US-017 AC-14: a deeper heading in the introduction (before the first term) stays as today', async () => {
    const result = await convertWith(
      '# Glossary\n\n### Intro\n\ni\n\n## A\n\na',
    );
    expect(result.typ).toContain('=== Intro <h-intro>');
    expect(result.warnings.map((w) => w.code)).toEqual([
      'HEADING_LEVEL_SKIPPED',
    ]);
  });
});

describe('US-017 warning codes', () => {
  it('US-017 AC-9, AC-14: the codes are listed as active for US-017 in docs/technical/warning-codes.md', () => {
    const text = readFileSync('docs/technical/warning-codes.md', 'utf8');
    for (const [code, ac] of [
      ['HEADING_RULE_NO_TERMS', 'AC-9'],
      ['HEADING_IN_TERM', 'AC-14'],
    ] as const) {
      const row = text.split('\n').find((l) => l.includes(`\`${code}\``));
      expect(row, code).toMatch(
        new RegExp(`\\| US-017 ${ac} \\|.*\\| active \\|$`),
      );
    }
  });
});

/** Every .ts file below `dir`. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sources(path)
      : path.endsWith('.ts')
        ? [path]
        : [];
  });
}

describe('US-017 one place writes terms (SCAR-017)', () => {
  it('US-017 AC-4, AC-5, AC-6: only src/core/emit/glossary.ts writes the text #glossary-term or #let glossary-term', () => {
    const writers = sources('src').filter((file) => {
      const text = readFileSync(file, 'utf8');
      return (
        text.includes('#glossary-term') || text.includes('#let glossary-term')
      );
    });
    expect(writers).toEqual([join('src', 'core', 'emit', 'glossary.ts')]);
  });
});
