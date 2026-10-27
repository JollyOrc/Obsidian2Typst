// US-008 AC-10, AC-13 — facts about Typst that the presets rely on, checked
// against the bundled compiler: the counting symbols, what a numbering pattern
// needs, and the names a template can shadow. Source of truth:
// docs/user-stories/US-008-presets-and-settings.md.
import {describe, expect, it} from 'vitest';
import {COUNTING_SYMBOLS, isValidNumbering} from '../../src/core/presets';
import {STD_NAMES} from '../../src/core/template';
import {diagnose} from '../support/typst-node';

const errorsOf = async (source: string): Promise<string[]> =>
  (await diagnose(source, {}))
    .filter((d) => d.severity === 'error')
    .map((d) => d.message);

const PATTERNS = [
  '1.1',
  '1.',
  '1.a',
  'a.1',
  'A.1',
  'i.1',
  'I.1',
  'a)',
  '1)',
  '(1)',
  '§1',
  'Chapter 1:',
  '一',
  '*',
  '①',
  '1.1.1',
  'x',
  '',
  'abc',
  '.',
  '#',
  '(',
];

describe('US-008 AC-13 heading numbering patterns', () => {
  it('US-008 AC-13: every counting symbol is accepted by the compiler', async () => {
    expect(COUNTING_SYMBOLS.length).toBeGreaterThan(5);
    for (const symbol of COUNTING_SYMBOLS) {
      const errors = await errorsOf(
        `#set heading(numbering: "${symbol}")\n= Title\n`,
      );
      expect(errors, symbol).toEqual([]);
    }
  });

  it('US-008 AC-13: COUNTING_SYMBOLS is complete: the compiler accepts no other character between U+0020 and U+27FFF', async () => {
    const found: string[] = [];
    const walk = async (chars: string[]): Promise<void> => {
      const pattern = chars
        .join('')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      const errors = await errorsOf(
        `#set heading(numbering: "${pattern}")\n= Title\n`,
      );
      if (errors.length > 0) return;
      if (chars.length === 1) {
        found.push(chars[0] as string);
        return;
      }
      const middle = chars.length >> 1;
      await walk(chars.slice(0, middle));
      await walk(chars.slice(middle));
    };
    for (let start = 0x20; start < 0x28000; start += 0x2000) {
      const chars: string[] = [];
      for (let c = start; c < start + 0x2000; c++) {
        const control = c >= 0x7f && c <= 0x9f;
        const surrogate = c >= 0xd800 && c <= 0xdfff;
        if (!control && !surrogate) chars.push(String.fromCodePoint(c));
      }
      await walk(chars);
    }
    expect(found.sort()).toEqual([...COUNTING_SYMBOLS].sort());
  }, 120_000);

  it('US-008 AC-13: a pattern without a counting symbol is refused by the compiler with "invalid numbering pattern"', async () => {
    const errors = await errorsOf(`#set heading(numbering: "x")\n= Title\n`);
    expect(errors.join('\n')).toContain('invalid numbering pattern');
  });

  it('US-008 AC-13: isValidNumbering gives the same answer as the compiler for sample patterns', async () => {
    for (const pattern of PATTERNS) {
      const escaped = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const errors = await errorsOf(
        `#set heading(numbering: "${escaped}")\n= Title\n`,
      );
      expect(isValidNumbering(pattern), JSON.stringify(pattern)).toBe(
        errors.length === 0,
      );
    }
  });
});

describe('US-008 AC-10 names a template can shadow', () => {
  it('US-008 AC-10: STD_NAMES is exactly the list of names the compiler has in std', async () => {
    const errors = await errorsOf(
      `#let names = dictionary(std).keys()\n#assert.eq(names.len(), ${STD_NAMES.length})\n` +
        `#let expected = (${STD_NAMES.map((n) => JSON.stringify(n)).join(', ')},)\n` +
        `#assert.eq(names.sorted(), expected.sorted())\n`,
    );
    expect(errors).toEqual([]);
  });

  it('US-008 AC-10: STD_NAMES has no duplicates and contains the usual built-ins', () => {
    expect(new Set(STD_NAMES).size).toBe(STD_NAMES.length);
    for (const name of ['quote', 'link', 'image', 'heading', 'text', 'page']) {
      expect(STD_NAMES, name).toContain(name);
    }
  });
});
