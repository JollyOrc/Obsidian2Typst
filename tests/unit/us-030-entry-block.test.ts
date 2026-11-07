// US-030 AC-1 to AC-7, AC-19 to AC-22 — reading the `o2t-entry` block: never
// printed, data of the heading above, every fence form, the places a block
// may not stand, value shapes and formatting, the warnings, composed cases.
// Source of truth: docs/user-stories/US-030-entry-data-and-statblock.md.
// Red until US-030 is implemented (G2, 2026-11-06).
import {existsSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {
  ENTRIES,
  FEN_HARE,
  FEN_HARE_YAML,
  US030_CODES,
  entry,
  runEntries,
  statblockCalls,
  warningsOf,
} from '../support/entries';

const codes = [...US030_CODES];

describe('US-030 AC-1 the block is data, never text', () => {
  it('US-030 AC-1: the example prints the heading and the body, none of the block', async () => {
    const {typ} = await runEntries(FEN_HARE);
    expect(typ).toContain('Fen Hare');
    expect(typ).toContain('Fen hares are quick');
    expect(typ).not.toContain('vigour:');
    expect(typ).not.toContain('o2t-entry');
    expect(typ).not.toContain('Kick: 2d6');
    expect(statblockCalls(typ)).toBe(1);
  });

  it('US-030 AC-1: every heading level 1 to 6, with blank lines between heading and block', async () => {
    for (let level = 1; level <= 6; level++) {
      const source = entry(`${'#'.repeat(level)} Fen Hare\n\n`, FEN_HARE_YAML);
      const {typ, warnings} = await runEntries(source);
      expect(statblockCalls(typ), `h${level}`).toBe(1);
      expect(warningsOf(warnings, codes), `h${level}`).toEqual([]);
    }
  });

  it('US-030 AC-1: a four-backtick fence holding three backticks, and a tilde fence, are read whole', async () => {
    const four = entry(
      '### Fen Hare',
      [...FEN_HARE_YAML, 'note: "Uses ```code``` here"'],
      undefined,
      '````',
    );
    const tilde = entry('### Fen Hare', FEN_HARE_YAML, undefined, '~~~');
    for (const source of [four, tilde]) {
      const {typ, warnings} = await runEntries(source);
      expect(statblockCalls(typ)).toBe(1);
      expect(typ).not.toContain('```');
      expect(typ).not.toContain('vigour:');
      expect(warningsOf(warnings, codes)).toEqual([]);
    }
  });
});

describe('US-030 AC-2 the contract is written once', () => {
  it('US-030 AC-2: docs/technical/entry-block.md exists and names its reader and writer', async () => {
    expect(existsSync('docs/technical/entry-block.md')).toBe(true);
    const {readFileSync} = await import('node:fs');
    const doc = readFileSync('docs/technical/entry-block.md', 'utf8');
    expect(doc).toContain('o2t-entry');
    expect(doc).toContain('ObsidianVaultCompiler#108');
    expect(doc).toMatch(/nullStr/);
  });
});

describe('US-030 AC-3 invalid YAML', () => {
  it('US-030 AC-3: YAML that does not parse gives ENTRY_YAML_INVALID with the line; no statblock', async () => {
    const source = entry('### Fen Hare', ['vigour: [11', 'might: 4']);
    const {typ, warnings} = await runEntries(source);
    expect(warnings.filter((w) => w.code === 'ENTRY_YAML_INVALID')).toEqual([
      {code: 'ENTRY_YAML_INVALID', message: '"Fen Hare"', line: 2},
    ]);
    expect(statblockCalls(typ)).toBe(0);
    expect(typ).toContain('Fen hares are quick');
  });

  it('US-030 AC-3: a block that is a list or a single value is not a mapping', async () => {
    for (const yaml of [['- a', '- b'], ['just text']]) {
      const {warnings} = await runEntries(entry('### Fen Hare', yaml));
      expect(warnings.filter((w) => w.code === 'ENTRY_YAML_INVALID')).toEqual([
        {code: 'ENTRY_YAML_INVALID', message: '"Fen Hare"', line: 2},
      ]);
    }
  });
});

describe('US-030 AC-4 blocks in the wrong place', () => {
  it('US-030 AC-4: text between heading and block, and a block with no heading, give ENTRY_ORPHAN_BLOCK and are not printed', async () => {
    const between = [
      '### Fen Hare',
      'A line.',
      '```o2t-entry',
      'might: 4',
      '```',
    ].join('\n');
    const headless = ['```o2t-entry', 'might: 4', '```', 'Text.'].join('\n');
    for (const source of [between, headless]) {
      const {typ, warnings} = await runEntries(source);
      expect(
        warnings.filter((w) => w.code === 'ENTRY_ORPHAN_BLOCK'),
      ).toHaveLength(1);
      expect(typ).not.toContain('might:');
      expect(statblockCalls(typ)).toBe(0);
    }
  });

  it('US-030 AC-4: a second block under one heading gives ENTRY_BLOCK_TWICE; the first counts', async () => {
    const source = [
      entry('### Fen Hare', FEN_HARE_YAML, []),
      '```o2t-entry',
      'might: 9',
      '```',
      // An opening paragraph of 10+ words, so AC-16 adds no warning (G4 #125).
      'The body after the second block, long enough to be a lede.',
    ].join('\n');
    const {typ, warnings} = await runEntries(source);
    expect(warningsOf(warnings, codes)).toEqual([
      'ENTRY_BLOCK_TWICE "Fen Hare"',
    ]);
    expect(statblockCalls(typ)).toBe(1);
    expect(typ).not.toContain('might: 9');
  });

  it('US-030 AC-4: a block inside a quote or callout gives ENTRY_BLOCK_IN_CONTAINER and is not printed', async () => {
    const quote = [
      '### Fen Hare',
      '> ```o2t-entry',
      '> might: 4',
      '> ```',
    ].join('\n');
    const callout = [
      '### Fen Hare',
      '> [!note]',
      '> ```o2t-entry',
      '> might: 4',
      '> ```',
    ].join('\n');
    for (const source of [quote, callout]) {
      const {typ, warnings} = await runEntries(source);
      expect(
        warnings.filter((w) => w.code === 'ENTRY_BLOCK_IN_CONTAINER'),
      ).toHaveLength(1);
      expect(typ).not.toContain('might:');
      expect(statblockCalls(typ)).toBe(0);
    }
  });
});

describe('US-030 AC-5 values', () => {
  it('US-030 AC-5: a map where text is expected gives ENTRY_VALUE_NOT_TEXT and is left out', async () => {
    const yaml = ['might: 4', 'attacks:', '  - B: 2d6', '  - "Kick: 2d6"'];
    const {typ, warnings} = await runEntries(entry('### Fen Hare', yaml));
    expect(warningsOf(warnings, codes)).toEqual([
      'ENTRY_VALUE_NOT_TEXT "Fen Hare": attacks',
    ]);
    expect(typ).toContain('Kick');
    expect(typ).not.toContain('[object Object]');
  });

  it('US-030 AC-5: 4 and "4" print the same; unknown keys and null values give no warning', async () => {
    const a = await runEntries(
      entry('### Fen Hare', ['might: 4', 'colour: red', 'empty:']),
    );
    const b = await runEntries(
      entry('### Fen Hare', ['might: "4"', 'colour: red', 'empty:']),
    );
    expect(a.typ).toBe(b.typ);
    expect(warningsOf(a.warnings, codes)).toEqual([]);
  });

  it('US-030 AC-5 (decision 2): one word for a list key is a one-item list', async () => {
    const {typ, warnings} = await runEntries(
      entry('### Fen Hare', ['might: 4', 'states: Fine', 'skills: Quick Step']),
    );
    expect(warningsOf(warnings, codes)).toEqual([]);
    expect(statblockCalls(typ)).toBe(1);
  });

  it('US-030 AC-5: keys are compared in lower case', async () => {
    const a = await runEntries(entry('### Fen Hare', ['Might: 4']));
    const b = await runEntries(entry('### Fen Hare', ['might: 4']));
    expect(a.typ).toBe(b.typ);
  });
});

describe('US-030 AC-6 formatting in values', () => {
  it('US-030 AC-6: bold is typeset; link markup prints its text, never a link', async () => {
    const yaml = [
      'might: 4',
      'attacks:',
      '  - "**Bite**: 1d6"',
      'skills:',
      '  - "[[Quick Step]]"',
      '  - "[[Skills/Keen Nose|Keen Nose]]"',
      '  - "[Swift](x.md)"',
    ];
    const {typ} = await runEntries(entry('### Fen Hare', yaml));
    expect(typ).toMatch(/strong\(\[?Bite|\*Bite\*/);
    for (const text of ['Quick Step', 'Keen Nose', 'Swift'])
      expect(typ).toContain(text);
    expect(typ).not.toContain('[[');
    expect(typ).not.toContain('Skills/Keen');
    expect(typ).not.toContain('x.md');
  });

  it('US-030 AC-6: # $ < @ and \\ in a value print as written (escaped)', async () => {
    const {typ} = await runEntries(
      entry('### Fen Hare', [
        'might: 4',
        'attacks:',
        '  - "Rake #1 $2 <a> @b \\\\c: 1d6"',
      ]),
    );
    expect(typ).toContain('\\#1');
    expect(typ).toContain('\\$2');
    expect(typ).toContain('\\@b');
  });
});

describe('US-030 AC-7 the illustration value', () => {
  it('US-030 AC-7: an illustration that is not found gives the missing-image warning', async () => {
    const yaml = [
      'might: 4',
      'illustration: "![Drawn by A. Nobody](assets/missing.png)"',
    ];
    const {warnings} = await runEntries(entry('### Fen Hare', yaml));
    expect(warnings.map((w) => w.code)).toContain('ASSET_MISSING');
  });
});

describe('US-030 AC-19 warnings once per entry', () => {
  it('US-030 AC-19: a composed note gives each warning once, in order', async () => {
    const source = [
      entry(
        '### One',
        ['might: 4', 'vigour: 46', 'tags: [rare]'],
        ['Short lede.'],
      ),
      entry(
        '### Two',
        ['might: 4', 'states: [Lost]', 'attacks: ["Glare: frightens"]'],
        ['- A list first'],
      ),
    ].join('\n\n');
    const {warnings} = await runEntries(source);
    expect(warningsOf(warnings, codes)).toEqual([
      'STAT_BOXES_MANY "One": 46',
      'TAG_UNMAPPED "One": rare',
      'ENTRY_LEDE_SHORT "One": 2 words',
      'ENTRY_TRACK_UNKNOWN "Two": Lost',
      'STAT_ATTACK_NO_DICE "Two": "Glare: frightens"',
      'ENTRY_NO_LEDE "Two": starts with list',
    ]);
  });
});

describe('US-030 AC-20 and AC-21 composed cases', () => {
  it('US-030 AC-20: an entry inside an entry gets its own statblock', async () => {
    const source = [
      entry('### Fen Hare', FEN_HARE_YAML),
      '',
      entry('#### Fen Kit', ['might: 1'], ['A small one.']),
    ].join('\n');
    const {typ} = await runEntries(source);
    expect(statblockCalls(typ)).toBe(2);
  });

  it('US-030 AC-21 (decision 3): a block under a glossary term is not read: ENTRY_IN_GLOSSARY', async () => {
    const source = [
      '# Glossary',
      '',
      entry('## Fen Hare', ['might: 4'], ['A term.']),
    ].join('\n');
    const {typ, warnings} = await runEntries(source, {
      headingRules: {Glossary: 'glossary'},
    });
    expect(warningsOf(warnings, codes)).toEqual([
      'ENTRY_IN_GLOSSARY "Fen Hare"',
    ]);
    expect(statblockCalls(typ)).toBe(0);
    expect(typ).not.toContain('might:');
  });

  it("US-030 AC-21: the writer's repeat comment between two entries adds nothing to the first", async () => {
    const plain = [
      entry('### One', ['might: 4']),
      entry('### Two', ['might: 5']),
    ].join('\n\n');
    const withComment = [
      entry('### One', ['might: 4']),
      '<!-- repeat of "Fen Hare" omitted -->',
      entry('### Two', ['might: 5']),
    ].join('\n\n');
    const a = await runEntries(plain);
    const b = await runEntries(withComment);
    expect(b.typ).not.toContain('repeat of');
    expect(statblockCalls(b.typ)).toBe(2);
    expect(statblockCalls(a.typ)).toBe(2);
  });
});

describe('US-030 AC-22 determinism', () => {
  it('US-030 AC-22: key order and flow lists do not change the output', async () => {
    const block = await runEntries(
      entry('### Fen Hare', ['might: 4', 'attacks:', '  - "Kick: 2d6"']),
    );
    const flow = await runEntries(
      entry('### Fen Hare', ['attacks: ["Kick: 2d6"]', 'might: 4']),
    );
    expect(flow.typ).toBe(block.typ);
  });

  it('US-030 AC-22: two runs give the same Typst byte for byte', async () => {
    const a = await runEntries(FEN_HARE);
    const b = await runEntries(FEN_HARE);
    expect(a.typ).toBe(b.typ);
    expect(statblockCalls(a.typ)).toBe(1);
    expect(ENTRIES.statblock.boxes).toBe('vigour');
  });
});
