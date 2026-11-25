// US-043 AC-9 — where the block is drawn and where it is dropped, through the
// whole conversion with US-030's example settings (SCAR-002: composed with
// headings, containers, glossary terms, entries chapters, a preset without a
// statblock). The PDF side is in tests/integration/us-043-encounter-pdf.test.ts.
// Source of truth: docs/user-stories/US-043-prefilled-encounter-rows.md.
// Red until US-043 is implemented (G2, 2026-11-25).
import {describe, expect, it} from 'vitest';
import {
  FEN_HARE_DATA,
  US043_CODES,
  encounter,
  encounterCalls,
  row,
  runEncounter,
} from '../support/encounter';
import {statblockCalls, warningsOf} from '../support/entries';

const BLOCK = encounter([row('Fen Hare', '2', undefined, FEN_HARE_DATA)]);
const IN_CONTAINER =
  'ENCOUNTER_IN_CONTAINER An o2t-encounter block inside a quote, callout, list item or glossary term is left out';

describe('US-043 AC-9 placement', () => {
  it('US-043 AC-9: two blocks under one heading → two lists, in order', async () => {
    const {typ, warnings} = await runEncounter(
      [
        '## Mire Hollow',
        BLOCK,
        '',
        encounter([row('Bog Wight', '1')], 'Later'),
      ].join('\n'),
    );
    expect(encounterCalls(typ)).toBe(2);
    expect(typ.indexOf('Fen Hare')).toBeLessThan(typ.indexOf('Bog Wight'));
    expect(warningsOf(warnings, US043_CODES)).toEqual([]);
  });

  it.each([
    [
      'a quote',
      (b: string) =>
        b
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n'),
    ],
    [
      'a callout',
      (b: string) =>
        ['> [!note] Aside', ...b.split('\n').map((l) => `> ${l}`)].join('\n'),
    ],
    [
      'a list item',
      (b: string) =>
        ['- Item', ...b.split('\n').map((l) => `  ${l}`)].join('\n'),
    ],
  ])(
    'US-043 AC-9: a block inside %s is dropped with ENCOUNTER_IN_CONTAINER',
    async (_, wrap) => {
      const {typ, warnings} = await runEncounter(
        ['## Mire Hollow', '', wrap(BLOCK)].join('\n'),
      );
      expect(encounterCalls(typ)).toBe(0);
      expect(typ).not.toContain('count:');
      expect(warningsOf(warnings, US043_CODES)).toEqual([IN_CONTAINER]);
    },
  );

  it('US-043 AC-9: a block under a glossary term (US-017) is dropped the same way', async () => {
    const {typ, warnings} = await runEncounter(
      ['# Glossary', '', '## Ambush', '', 'A surprise attack.', '', BLOCK].join(
        '\n',
      ),
    );
    expect(encounterCalls(typ)).toBe(0);
    expect(warningsOf(warnings, US043_CODES)).toEqual([IN_CONTAINER]);
  });

  it('US-043 AC-9: in an entries chapter the rows are drawn where they stand; they are no entry', async () => {
    const {typ, warnings} = await runEncounter(
      ['# Menagerie', '', '## Mire Hollow', '', BLOCK].join('\n'),
      {headingRules: {Menagerie: 'entries'}},
    );
    expect(encounterCalls(typ)).toBe(1);
    expect(statblockCalls(typ)).toBe(0);
    expect(warningsOf(warnings, US043_CODES)).toEqual([]);
  });

  it('US-043 AC-9: a preset without entries.statblock → blank rows with the names and one ENCOUNTER_NO_STATBLOCK', async () => {
    const {typ, warnings} = await runEncounter(
      ['## Mire Hollow', BLOCK, '', encounter([row('Bog Wight', '1')])].join(
        '\n',
      ),
      {entries: undefined},
    );
    expect(encounterCalls(typ)).toBe(2);
    expect(typ).toContain('Fen Hare 1');
    expect(warningsOf(warnings, US043_CODES)).toEqual([
      'ENCOUNTER_NO_STATBLOCK The preset has no entries.statblock; the encounter rows are blank',
    ]);
  });

  it('US-043 AC-9: the warnings carry the source line of the block (rule 8)', async () => {
    const {warnings} = await runEncounter(
      [
        '## Mire Hollow',
        '',
        'Text.',
        '',
        encounter([row('Fen Hare', 'two')]),
      ].join('\n'),
    );
    const w = warnings.find((x) => x.code === 'ENCOUNTER_COUNT_INVALID');
    expect(w?.line).toBe(5);
  });

  it('US-043 AC-1 (SCAR-039): a note without any block converts exactly as before', async () => {
    const source = [
      '## Mire Hollow',
      '',
      '> [!note]',
      '> - 2 × Fen Hare',
      '',
      'Text.',
    ].join('\n');
    const {typ} = await runEncounter(source);
    expect(encounterCalls(typ)).toBe(0);
    expect(typ).not.toContain('o2t-encounter');
  });
});
