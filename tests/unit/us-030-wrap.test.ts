// US-030 AC-16a, AC-16b; US-033 AC-7, AC-9 (amendment for #139) — what the
// converter writes for the wrap and the quick reference: the body handed to
// the statblock as blocks with kinds (a side channel, SCAR-039), where the
// blocks end, the statblock of a chapter entry handed to the layout, the
// box column's label, the section rows and links, and the one header rule
// for the pages after a chapter's last entry.
// Source of truth: docs/user-stories/US-030-entry-data-and-statblock.md,
// US-033-entry-openers-navigation-quick-reference.md.
// Red until #139 is implemented (G2, 2026-11-09).
import {describe, expect, it} from 'vitest';
import {
  ENTRIES,
  FEN_HARE,
  FEN_HARE_YAML,
  entry,
  runEntries,
} from '../support/entries';

const MODEL = '../../src/core/entries/model';
interface ModelModule {
  /** US-033 AC-9 (G0 answer 14): the box column's label, or null without boxes. */
  boxColumnLabel(
    boxes: string | undefined,
    stats: readonly {key: string; label: string}[] | undefined,
  ): string | null;
}
const model = async (): Promise<ModelModule> => {
  const path: string = MODEL;
  return (await import(/* @vite-ignore */ path)) as ModelModule;
};

describe('US-030 AC-16a the body as blocks with kinds', () => {
  it('US-030 AC-16a: outside a chapter the statblock call carries the body blocks: a paragraph, a sub-heading, a paragraph', async () => {
    const {typ} = await runEntries(FEN_HARE);
    const call = typ.slice(typ.indexOf('#o2t-statblock('));
    expect(call).toMatch(/blocks: \(\(kind: "par", body: \[/);
    const kinds = [...call.matchAll(/\(kind: "(\w+)", body: /g)].map(
      (m) => m[1],
    );
    expect(kinds).toEqual(['par', 'heading', 'par']);
    // Nothing of the body is written again after the call.
    expect(typ.split('They gather at dusk').length - 1).toBe(1);
    expect(typ).not.toContain('lede:');
  });

  it('US-030 AC-16a: a list, a quote and code are blocks that are not split', async () => {
    const {typ} = await runEntries(
      entry('### Fen Hare', FEN_HARE_YAML, [
        'Fen hares are quick and shy, they flee at once.',
        '',
        '- Fast',
        '',
        '> A quote',
        '',
        '```',
        'code',
        '```',
      ]),
    );
    const call = typ.slice(typ.indexOf('#o2t-statblock('));
    const kinds = [...call.matchAll(/\(kind: "(\w+)", body: /g)].map(
      (m) => m[1],
    );
    expect(kinds).toEqual(['par', 'block', 'block', 'block']);
  });

  it('US-030 AC-16b, AC-20: the blocks end at a nested entry; the nested entry has its own call with its own blocks', async () => {
    const source = [
      entry('### Fen Hare', FEN_HARE_YAML, [
        'Outer text of the hare entry here.',
      ]),
      '',
      entry(
        '#### Hare Kit',
        ['might: 1'],
        ['Inner text of the kit entry here.'],
      ),
    ].join('\n');
    const {typ} = await runEntries(source);
    const calls = typ.split('#o2t-statblock(').slice(1);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('Outer text');
    expect(calls[0]?.split('#o2t-statblock(')[0]).not.toContain('Inner text');
    expect(calls[1]).toContain('Inner text');
  });

  it('US-030 AC-16b: outside a chapter, a heading with a US-025 page break ends the blocks; its break is written in the flow', async () => {
    const source = entry('### Fen Hare', FEN_HARE_YAML, [
      'Text before the break here.',
      '',
      '#### Habits',
      '',
      'They gather at dusk.',
    ]);
    const {typ} = await runEntries(source, {breakBefore: {h4: 'page'}});
    const call = typ.slice(
      typ.indexOf('#o2t-statblock('),
      typ.indexOf('#pagebreak('),
    );
    expect(call).toContain('Text before the break');
    expect(call).not.toContain('Habits');
    expect(typ).toContain('#pagebreak(');
  });

  it('US-030 AC-16a: in an entries chapter the statblock is handed to the layout (sb:) with every body block, not written in the head', async () => {
    const {typ} = await runEntries(['# Menagerie', '', FEN_HARE].join('\n'), {
      headingRules: {Menagerie: 'entries'},
    });
    const call = typ.slice(typ.indexOf('#o2t-entries(('));
    expect(call).toMatch(/sb: \(band: "Fen Hare"/);
    expect(call).toMatch(/blocks: \(\(kind: "par", body: \[/);
    expect(typ).not.toContain('#o2t-statblock(');
  });

  it('US-030 AC-16 (unchanged warnings): ENTRY_NO_LEDE and ENTRY_LEDE_SHORT still come from the first block', async () => {
    const list = await runEntries(
      entry('### Fen Hare', FEN_HARE_YAML, ['- Fast']),
    );
    expect(list.warnings.map((w) => `${w.code} ${w.message}`)).toContain(
      'ENTRY_NO_LEDE "Fen Hare": starts with list',
    );
    const short = await runEntries(
      entry('### Fen Hare', FEN_HARE_YAML, ['Too short a lede.']),
    );
    expect(short.warnings.map((w) => w.code)).toContain('ENTRY_LEDE_SHORT');
  });
});

describe('US-033 AC-9 (amended) the box column label', () => {
  it('US-033 AC-9 (G0 answer 14): the key with its first character in upper case, the rest as written; a stats label wins; no boxes → null', async () => {
    const {boxColumnLabel} = await model();
    expect(boxColumnLabel('vigour', [])).toBe('Vigour');
    expect(boxColumnLabel('hit_points', undefined)).toBe('Hit_points');
    expect(boxColumnLabel('xVigour', [])).toBe('XVigour');
    expect(boxColumnLabel('v', [])).toBe('V');
    expect(boxColumnLabel('vigour', [{key: 'Vigour', label: 'Stamina'}])).toBe(
      'Stamina',
    );
    expect(
      boxColumnLabel(undefined, [{key: 'might', label: 'Might'}]),
    ).toBeNull();
  });
});

describe('US-033 AC-9 (amended) the quick reference written', () => {
  const chapter = [
    '# Menagerie',
    '',
    '## Beasts',
    '',
    'Intro.',
    '',
    entry(
      '### Fen Hare',
      ['might: 4', 'vigour: 11'],
      ['A lede that is long enough to count here.'],
    ),
    '',
    '## Horrors',
    '',
    'Intro.',
    '',
    entry(
      '### Bog Wight',
      ['might: 6', 'vigour: 9'],
      ['A lede that is long enough to count here.'],
    ),
  ].join('\n');
  const settings = {
    headingRules: {Menagerie: 'entries'},
    entries: {...ENTRIES, quickReference: true},
  };

  it('US-033 AC-9: no Section column; a section row per section (a leveled header); names link to their labels', async () => {
    const {typ} = await runEntries(chapter, settings);
    const table = typ.slice(typ.indexOf('#table('));
    expect(table).not.toContain('[*Section*]');
    expect(table).toContain('[*Vigour*]');
    expect(table.match(/table\.header\(level: 2, repeat: true/g)).toHaveLength(
      2,
    );
    expect(table).toMatch(/link\(<[^>]+>\)\[Fen Hare\]/);
  });

  it('US-033 AC-9 (G0 answer 17): a chapter without sections writes no section rows', async () => {
    const flat = [
      '# Menagerie',
      '',
      entry(
        '## Fen Hare',
        ['might: 4'],
        ['A lede that is long enough to count here.'],
      ),
    ].join('\n');
    const {typ} = await runEntries(flat, settings);
    expect(typ).not.toContain('table.header(level: 2');
  });

  it('US-033 AC-7 (amended): the quick reference and the sheet page carry their title for the header (one rule, in the furniture)', async () => {
    const {typ} = await runEntries(chapter, {
      ...settings,
      entries: {...settings.entries, encounterSheet: true},
      pageFurniture: {folios: true, runningHeader: true, runningHeaderLevel: 3},
    });
    expect(typ).toMatch(/<o2t-tail>/);
    expect(typ).toContain('o2t-tail-header(');
    expect(typ).toMatch(/metadata\(\(title: "Quick Reference"\)\) <o2t-tail>/);
    expect(typ).toMatch(/metadata\(\(title: "Encounter Sheet"\)\) <o2t-tail>/);
  });
});
