// US-038 AC-1 to AC-3, AC-12 — reading the `o2t-details` block: never
// printed, taken out right after parsing, every heading level and fence, the
// YAML rules, and the places a block is not read (each with its one warning).
// Source of truth: docs/user-stories/US-038-detail-rows.md and the contract
// docs/technical/details-block.md.
// Red until US-038 is implemented (G2, 2026-11-09).
import {describe, expect, it} from 'vitest';
import {entry} from '../support/entries';
import {
  detailWarnings,
  details,
  detailsCalls,
  runDetails,
} from '../support/details';

const PACE = ['pace: brisk'];

describe('US-038 AC-1 the block is data, never text', () => {
  it('US-038 AC-1: the example prints the heading and the body, none of the block', async () => {
    const {typ, warnings} = await runDetails(
      details('###### Reed Weaving', ['pace: brisk', 'kind: craft']),
    );
    expect(typ).toContain('Reed Weaving');
    expect(typ).toContain('You weave reeds');
    expect(typ).not.toContain('pace: brisk');
    expect(typ).not.toContain('o2t-details\n');
    expect(typ).not.toContain('```');
    expect(detailsCalls(typ)).toHaveLength(1);
    expect(detailWarnings(warnings)).toEqual([]);
  });

  it('US-038 AC-1: every heading level 1 to 6, with blank lines between heading and block', async () => {
    for (let level = 1; level <= 6; level++) {
      const source = details(`${'#'.repeat(level)} Reed Weaving\n\n`, PACE);
      const {typ, warnings} = await runDetails(source);
      expect(detailsCalls(typ), `h${level}`).toHaveLength(1);
      expect(detailWarnings(warnings), `h${level}`).toEqual([]);
    }
  });

  it('US-038 AC-1: a four-backtick fence holding three backticks, and a tilde fence, are read whole', async () => {
    const four = details(
      '### Reed Weaving',
      [...PACE, 'note: "Uses ```code``` here"'],
      undefined,
      '````',
    );
    const tilde = details('### Reed Weaving', PACE, undefined, '~~~');
    for (const source of [four, tilde]) {
      const {typ, warnings} = await runDetails(source);
      expect(detailsCalls(typ)).toHaveLength(1);
      expect(typ).not.toContain('```');
      expect(typ).not.toContain('pace:');
      expect(detailWarnings(warnings)).toEqual([]);
    }
  });

  it('US-038 AC-1: the entry scan sees no o2t-details node and an entry next to it keeps its place', async () => {
    // details first, entry after (the entry must still be directly under the heading)
    const source = [
      '### Fen Hare',
      '```o2t-details',
      'pace: brisk',
      '```',
      '```o2t-entry',
      'vigour: 11',
      '```',
      'Fen hares are quick and shy and live in reed beds for most of the year.',
    ].join('\n');
    const {warnings} = await runDetails(source, {
      entries: {statblock: {stats: [{key: 'might', label: 'Might'}]}},
    });
    const codes = warnings.map((w) => w.code);
    expect(codes).not.toContain('ENTRY_ORPHAN_BLOCK');
    expect(codes).toContain('DETAIL_BLOCK_WITH_ENTRY');
  });
});

describe('US-038 AC-2 the YAML', () => {
  it('US-038 AC-2: an empty block is no row and no warning', async () => {
    for (const yaml of [[], ['{}']]) {
      const {typ, warnings} = await runDetails(
        details('### Reed Weaving', yaml),
      );
      expect(detailsCalls(typ)).toEqual([]);
      expect(detailWarnings(warnings)).toEqual([]);
    }
  });

  it('US-038 AC-2: keys compare in lower case and the first of a case pair wins', async () => {
    const {typ} = await runDetails(
      details('### Reed Weaving', ['Pace: slow', 'pace: swift']),
    );
    const call = detailsCalls(typ)[0] ?? '';
    expect(call).toContain('body: [Slow]');
    expect(call).not.toContain('Swift');
  });

  it('US-038 AC-2: keys no item names are ignored without a warning', async () => {
    const {typ, warnings} = await runDetails(
      details('### Reed Weaving', [
        'pace: slow',
        'colour: red',
        'tags: [a, b]',
      ]),
    );
    expect(detailsCalls(typ)).toHaveLength(1);
    expect(detailWarnings(warnings)).toEqual([]);
  });

  it('US-038 AC-2: YAML that does not parse, or is not a mapping, gives DETAIL_YAML_INVALID at the first line', async () => {
    for (const yaml of [['pace: [brisk'], ['- a', '- b'], ['just text']]) {
      const source = [
        'intro',
        '',
        ...details('### Reed Weaving', yaml).split('\n'),
      ].join('\n');
      const {typ, warnings} = await runDetails(source);
      expect(detailWarnings(warnings)).toEqual([
        'DETAIL_YAML_INVALID "Reed Weaving" (line 4)',
      ]);
      expect(detailsCalls(typ)).toEqual([]);
      expect(typ).not.toContain('o2t-details\n');
    }
  });
});

describe('US-038 AC-3 the places that are not read', () => {
  it('US-038 AC-3: text before the block, no heading above → DETAIL_ORPHAN_BLOCK', async () => {
    const source = ['Some text.', '```o2t-details', 'pace: slow', '```'].join(
      '\n',
    );
    const {typ, warnings} = await runDetails(source);
    expect(detailWarnings(warnings)).toEqual([
      expect.stringMatching(/^DETAIL_ORPHAN_BLOCK .* \(line 2\)$/),
    ]);
    expect(detailsCalls(typ)).toEqual([]);
    expect(typ).not.toContain('pace: slow');
  });

  it('US-038 AC-3: text between the heading and the block → DETAIL_ORPHAN_BLOCK', async () => {
    const source = [
      '### Reed Weaving',
      'Words first.',
      '```o2t-details',
      'pace: slow',
      '```',
    ].join('\n');
    const {warnings} = await runDetails(source);
    expect(detailWarnings(warnings)).toEqual([
      expect.stringMatching(/^DETAIL_ORPHAN_BLOCK .* \(line 3\)$/),
    ]);
  });

  it('US-038 AC-3: a second block under one heading → DETAIL_BLOCK_TWICE; the first counts', async () => {
    const source = [
      '### Reed Weaving',
      '```o2t-details',
      'pace: slow',
      '```',
      '```o2t-details',
      'pace: swift',
      '```',
      'Text.',
    ].join('\n');
    const {typ, warnings} = await runDetails(source);
    expect(detailWarnings(warnings)).toEqual([
      'DETAIL_BLOCK_TWICE "Reed Weaving" (line 5)',
    ]);
    const calls = detailsCalls(typ);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('body: [Slow]');
  });

  it('US-038 AC-3: in a quote, a callout, and a quote inside a list item, at any depth → DETAIL_BLOCK_IN_CONTAINER', async () => {
    const quote = [
      '> ### Reed Weaving',
      '> ```o2t-details',
      '> pace: slow',
      '> ```',
    ].join('\n');
    const callout = [
      '> [!note] Title',
      '> ```o2t-details',
      '> pace: slow',
      '> ```',
    ].join('\n');
    const deep = ['> > ```o2t-details', '> > pace: slow', '> > ```'].join('\n');
    const inList = [
      '- item',
      '  > ```o2t-details',
      '  > pace: slow',
      '  > ```',
    ].join('\n');
    for (const source of [quote, callout, deep, inList]) {
      const {typ, warnings} = await runDetails(source);
      expect(detailWarnings(warnings), source).toEqual([
        expect.stringMatching(/^DETAIL_BLOCK_IN_CONTAINER .* \(line \d\)$/),
      ]);
      expect(detailsCalls(typ)).toEqual([]);
      expect(typ).not.toContain('pace: slow');
    }
  });

  it('US-038 AC-3: under a glossary term → DETAIL_IN_GLOSSARY "<term>", no row', async () => {
    const source = [
      '# Glossary',
      '',
      '## Reed',
      '```o2t-details',
      'pace: slow',
      '```',
      'A tall plant.',
    ].join('\n');
    const {typ, warnings} = await runDetails(source, {
      headingRules: {Glossary: 'glossary'},
    });
    expect(detailWarnings(warnings)).toEqual([
      'DETAIL_IN_GLOSSARY "Reed" (line 4)',
    ]);
    expect(detailsCalls(typ)).toEqual([]);
    expect(typ).not.toContain('pace: slow');
  });

  it('US-038 AC-3: a heading with an o2t-entry block too, in either order → the entry is read, the details dropped', async () => {
    const entries = {statblock: {stats: [{key: 'might', label: 'Might'}]}};
    const entryFirst = [
      '### Fen Hare',
      '```o2t-entry',
      'might: 4',
      '```',
      '```o2t-details',
      'pace: slow',
      '```',
      'Fen hares are quick and shy and live in reed beds for most of the year.',
    ].join('\n');
    const detailsFirst = [
      '### Fen Hare',
      '```o2t-details',
      'pace: slow',
      '```',
      '```o2t-entry',
      'might: 4',
      '```',
      'Fen hares are quick and shy and live in reed beds for most of the year.',
    ].join('\n');
    for (const [source, line] of [
      [entryFirst, 5],
      [detailsFirst, 2],
    ] as const) {
      const {typ, warnings} = await runDetails(source, {entries});
      expect(detailWarnings(warnings)).toEqual([
        `DETAIL_BLOCK_WITH_ENTRY "Fen Hare" (line ${line})`,
      ]);
      expect(detailsCalls(typ)).toEqual([]);
      expect(typ).toContain('o2t-statblock');
      expect(warnings.map((w) => w.code)).not.toContain('ENTRY_ORPHAN_BLOCK');
    }
  });

  it('US-038 AC-3, AC-12: a note with entries and no details blocks has no DETAIL warning', async () => {
    const {warnings} = await runDetails(entry('### Fen Hare', ['might: 4']), {
      entries: {statblock: {stats: [{key: 'might', label: 'Might'}]}},
    });
    expect(detailWarnings(warnings)).toEqual([]);
  });
});
