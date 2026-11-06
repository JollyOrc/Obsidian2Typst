// US-031 AC-1 to AC-3, AC-13 — the entries chapter through `headingRules`,
// entries outside it, nested entries, the `layout` value, and body images
// inside entries without US-028's fit-flow. Through `convert`; placement is
// read from the PDF in tests/integration/us-031-layouts-pdf.test.ts.
// Source of truth: docs/user-stories/US-031-entry-layouts-on-facing-pages.md.
// Red until US-031 is implemented (G2, 2026-11-06).
import {describe, expect, it} from 'vitest';
import {formatPresetError, parsePreset} from '../../src/core/presets';
import {
  entry,
  runEntries,
  statblockCalls,
  warningsOf,
} from '../support/entries';

const CODES = [
  'ENTRY_OUTSIDE_CHAPTER',
  'ENTRY_NESTED_LAYOUT',
  'ENTRY_LAYOUT_UNKNOWN',
];
const RULES = {headingRules: {Menagerie: 'entries'}};
const LEDE = [
  'Fen hares are quick and shy. They live in reed beds and flee at the first sound.',
];

const note = (...lines: string[]): string =>
  ['---', 'schemaVersion: 1', ...lines, '---', ''].join('\n');

describe('US-031 AC-1 the entries chapter', () => {
  it('US-031 AC-1: headingRules accepts the rule entries', () => {
    const result = parsePreset(
      note('headingRules:', '  Menagerie: entries', '  Relics: entries'),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it('US-031 AC-1 (SCAR-027): the message names all five rule names', () => {
    const result = parsePreset(note('headingRules:', '  Glossary: index'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(formatPresetError(result.error)).toBe(
      'headingRules.Glossary must be a rule name: glossary, colophon, back-notes, entries or none (line 4)',
    );
  });

  it('US-031 AC-1 (decision 3): a nested entry with a layout gives ENTRY_NESTED_LAYOUT; with auto none', async () => {
    const outer = entry('### Fen Hare', ['might: 4'], LEDE);
    const nested = (layout: string) =>
      entry(
        '#### Fen Kit',
        ['might: 1', `layout: ${layout}`],
        ['A small one.'],
      );
    const set = await runEntries(
      ['# Menagerie', '', outer, '', nested('page-text')].join('\n'),
      RULES,
    );
    expect(warningsOf(set.warnings, CODES)).toEqual([
      'ENTRY_NESTED_LAYOUT "Fen Kit": page-text',
    ]);
    expect(statblockCalls(set.typ)).toBe(2);
    const auto = await runEntries(
      ['# Menagerie', '', outer, '', nested('auto')].join('\n'),
      RULES,
    );
    expect(warningsOf(auto.warnings, CODES)).toEqual([]);
    expect(statblockCalls(auto.typ)).toBe(2);
  });

  it('US-031 AC-1: a matched heading with no entry is ignored without a warning', async () => {
    const source = [
      '# Players',
      '',
      '### Menagerie',
      '',
      'Text.',
      '',
      '# Menagerie',
      '',
      entry('### Fen Hare', ['might: 4'], LEDE),
    ].join('\n');
    const {typ, warnings} = await runEntries(source, RULES);
    expect(warningsOf(warnings, CODES)).toEqual([]);
    expect(statblockCalls(typ)).toBe(1);
  });
});

describe('US-031 AC-2 entries outside the chapter', () => {
  it('US-031 AC-2: an entry under another chapter keeps its statblock and gives ENTRY_OUTSIDE_CHAPTER', async () => {
    const source = [
      '# Menagerie',
      '',
      entry('### Fen Hare', ['might: 4'], LEDE),
      '',
      '# Example Crypt',
      '',
      entry('### Fen Hare', ['might: 4'], LEDE),
    ].join('\n');
    const {typ, warnings} = await runEntries(source, RULES);
    expect(warningsOf(warnings, CODES)).toEqual([
      'ENTRY_OUTSIDE_CHAPTER "Fen Hare"',
    ]);
    expect(warnings.find((w) => w.code === 'ENTRY_OUTSIDE_CHAPTER')?.line).toBe(
      7,
    );
    expect(statblockCalls(typ)).toBe(2);
  });

  it('US-031 AC-2: without an entries rule every entry is outside, and warns', async () => {
    const {warnings} = await runEntries(
      entry('### Fen Hare', ['might: 4'], LEDE),
    );
    expect(warningsOf(warnings, CODES)).toEqual([
      'ENTRY_OUTSIDE_CHAPTER "Fen Hare"',
    ]);
  });
});

describe('US-031 AC-3 the layout value', () => {
  it('US-031 AC-3: an unknown value gives ENTRY_LAYOUT_UNKNOWN; the seven layouts and auto do not', async () => {
    const values = [
      'full-image',
      'spread-landscape',
      'spread-portrait',
      'spread-text',
      'page-landscape',
      'page-portrait',
      'page-text',
      'auto',
    ];
    for (const layout of values) {
      const {warnings} = await runEntries(
        [
          '# Menagerie',
          '',
          entry('### Fen Hare', ['might: 4', `layout: ${layout}`], LEDE),
        ].join('\n'),
        RULES,
      );
      expect(warningsOf(warnings, CODES), layout).toEqual([]);
      expect(
        warnings.map((w) => w.code),
        layout,
      ).not.toContain('ENTRY_YAML_INVALID');
    }
    const odd = await runEntries(
      [
        '# Menagerie',
        '',
        entry('### Fen Hare', ['might: 4', 'layout: sideways'], LEDE),
      ].join('\n'),
      RULES,
    );
    expect(warningsOf(odd.warnings, CODES)).toEqual([
      'ENTRY_LAYOUT_UNKNOWN "Fen Hare: sideways"',
    ]);
    expect(statblockCalls(odd.typ)).toBe(1);
  });
});

describe('US-031 AC-13 images in an entry body', () => {
  it('US-031 AC-13 (G0-C5): a body image inside an entry is not written with fit-flow; outside it is', async () => {
    const over = {...RULES, images: {minScale: 70}};
    const inside = await runEntries(
      [
        '# Menagerie',
        '',
        entry(
          '### Fen Hare',
          ['might: 4'],
          [...LEDE, '', '![](assets/map.png)'],
        ),
      ].join('\n'),
      over,
    );
    const outside = await runEntries(
      ['# Players', '', 'Text.', '', '![](assets/map.png)'].join('\n'),
      over,
    );
    expect(outside.typ).toContain('fit-flow');
    expect(inside.typ).not.toContain('fit-flow');
    expect(statblockCalls(inside.typ)).toBe(1);
  });
});
