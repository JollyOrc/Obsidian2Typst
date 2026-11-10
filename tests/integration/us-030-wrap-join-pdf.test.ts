// US-030 AC-16c (amendment for #160) — a paragraph split at the statblock
// reads as one paragraph: the column takes the nearer line count, its
// leading changes by at most a tenth of a line so it ends at the
// statblock's foot, and the text below continues at the line spacing.
// Measured from the PDF: the baselines of the words on both sides of the cut
// (the split recorded in `<o2t-wrap>`), through the real conversion and
// compile (A5, the sample's settings).
// Source of truth: docs/user-stories/US-030-entry-data-and-statblock.md.
// Written red at G2 (2026-11-10); green with #164.
import {afterAll, describe, expect, it} from 'vitest';
import {openPdf} from '../../src/core/pdf/reader';
import {pageRuns} from '../../src/core/pdf/text';
import {bookSettings} from '../support/book';
import {ENTRIES, entry} from '../support/entries';
import {
  compileEntries,
  disposeEntriesCompiler,
  type CompiledEntries,
  type WrapFact,
} from '../support/entries-pdf';

afterAll(disposeEntriesCompiler);

// SCAR-030: one entry per compile; the limit as the other wrap tests.
// Measured 2026-11-10 under a full parallel run: the 8-entry sweep 1.2 s,
// the others under 0.5 s.
const SLOW = 30_000;
const MM = 25.4 / 72;
/** AC-16c: the sample's line pitch (line height + leading), mm. */
const PITCH = 4.62;
/** AC-16c: the paragraph spacing less the leading, mm (G0 measurement). */
const PAR_GAP = 1.93;

/** `n` distinct words `<p>0 … <p>(n-1)`. */
const words = (n: number, p = 'k'): string =>
  Array.from({length: n}, (_, i) => `${p}${i}`).join(' ');

/** A statblock of `attacks` attack lines (its height grows with them). */
const yaml = (attacks: number): string[] => [
  'vigour: 11',
  'might: 4',
  'wits: 2',
  ...(attacks === 0
    ? []
    : [
        'attacks:',
        ...Array.from({length: attacks}, (_, i) => `  - "Strike ${i}: 1d6"`),
      ]),
];

const compile = (
  body: string[],
  attacks: number,
  over: Record<string, unknown> = {},
): Promise<CompiledEntries> =>
  compileEntries(entry('### Fen Hare', yaml(attacks), body), {
    over: {entries: ENTRIES, ...over},
  });

/**
 * The baselines (PDF points, y up) of the lines on page `page` that hold a
 * word `<p>i` of the test text, top first — not the statblock's own lines,
 * which stand beside the column at other heights (SCAR-028).
 */
function baselines(c: CompiledEntries, page: number, p: string): number[] {
  const runs = pageRuns(openPdf(c.pdf))[page - 1] ?? [];
  const re = new RegExp(`(^|\\s)${p}\\d+(\\s|$)`);
  const ys = new Set<number>();
  for (const r of runs) {
    const text = r.items.map((i) => ('ch' in i ? i.ch : ' ')).join('');
    if (!r.furniture && re.test(text)) ys.add(Math.round(r.y * 100) / 100);
  }
  return [...ys].sort((a, b) => b - a);
}

/** The baseline (mm) of the line holding the whole word `word`. */
function yOf(c: CompiledEntries, page: number, word: string): number {
  const runs = pageRuns(openPdf(c.pdf))[page - 1] ?? [];
  const re = new RegExp(`(^|\\s)${word}(\\s|$)`);
  const hit = runs.find(
    (r) =>
      !r.furniture &&
      re.test(r.items.map((i) => ('ch' in i ? i.ch : ' ')).join('')),
  );
  if (hit === undefined) throw new Error(`no line holds ${word}`);
  return hit.y * MM;
}

/**
 * The cut of the wrap's split paragraph (its words named `<p>i`): the step
 * from the column's last line to the first line below, the pitch of the two
 * lines below the cut, and the pitch of the column's last two lines (mm).
 */
function cut(c: CompiledEntries, p: string) {
  const w = c.wraps[0] as WrapFact;
  if (w.split === null) throw new Error('nothing was split');
  const last = yOf(c, w.page, `${p}${w.split.words - 1}`);
  const first = yOf(c, w.page, `${p}${w.split.words}`);
  const ys = baselines(c, w.page, p).map((y) => y * MM);
  const below = ys.find((y) => y < first - 1) ?? NaN;
  // The column's line above its last one: the nearest baseline above it.
  const prev = [...ys].reverse().find((y) => y > last + 1) ?? NaN;
  return {
    w,
    step: last - first,
    pitchBelow: first - below,
    pitchColumn: prev - last,
  };
}

describe('US-030 AC-16c the join below the column', () => {
  it(
    'US-030 AC-16c: across statblocks of 1 to 8 attack lines the line below the cut follows at one line pitch, the column within a tenth of a line of it',
    async () => {
      let checked = 0;
      for (let attacks = 1; attacks <= 8; attacks++) {
        const c = await compile([words(150)], attacks);
        const {w, step, pitchBelow, pitchColumn} = cut(c, 'k');
        const at = `attacks=${attacks}`;
        expect(pitchBelow, at).toBeCloseTo(PITCH, 1);
        expect(Math.abs(step - PITCH), at).toBeLessThanOrEqual(0.1);
        expect(Math.abs(pitchColumn - PITCH), at).toBeLessThanOrEqual(
          PITCH / 10 + 0.01,
        );
        // The nearer line count: within half a line of the statblock's foot.
        expect(Math.abs(w.column - w.statblock), at).toBeLessThanOrEqual(
          PITCH / 2 + 0.01,
        );
        checked++;
      }
      expect(checked).toBe(8);
    },
    8 * SLOW,
  );

  it(
    'US-030 AC-16c: two attack lines — 59 words in the column (34.62 mm), squeezed to the statblock (34.48 mm), the next line one pitch below (before: 52 words, a step of 11.01 mm)',
    async () => {
      const c = await compile([words(150)], 2);
      const {w, step} = cut(c, 'k');
      expect(w.split?.words).toBe(59);
      expect(w.column).toBeCloseTo(34.62, 1);
      expect(w.statblock).toBeCloseTo(34.48, 1);
      expect(w.fill).toBeLessThan(0);
      expect(step).toBeCloseTo(PITCH, 1);
    },
    SLOW,
  );

  it(
    'US-030 AC-16c (decision 7): body 18 pt, one attack line — 4 column lines end 2.84 mm above the foot; filling would need more than a tenth of a line, so the leading stays',
    async () => {
      const base = bookSettings();
      const fonts = {...base.fonts, body: {...base.fonts?.body, size: 18}};
      const c = await compile([words(150)], 1, {fonts});
      const w = c.wraps[0] as WrapFact;
      expect(w.split).not.toBeNull();
      expect(w.fill).toBe(0);
      expect(w.statblock - w.column).toBeCloseTo(2.84, 1);
      const {step, pitchBelow} = cut(c, 'k');
      // The column ends above the foot by what the bound left; the line
      // below still follows at the leading, not the paragraph spacing.
      expect(step - pitchBelow).toBeCloseTo(2.84, 0);
    },
    SLOW,
  );

  it(
    'US-030 AC-16c: a paragraph that fits whole within half a line goes whole into the column; the next paragraph follows with the paragraph spacing',
    async () => {
      const c = await compile([words(56), '', words(30, 'm')], 2);
      const w = c.wraps[0] as WrapFact;
      expect(w.split).toBeNull();
      expect(w.beside).toBe(1);
      expect(w.column).toBeGreaterThan(w.statblock);
      expect(w.column).toBeLessThanOrEqual(w.statblock + PITCH / 2 + 0.01);
      expect(w.fill).toBe(0);
      const step = yOf(c, w.page, 'k55') - yOf(c, w.page, 'm0');
      expect(step).toBeCloseTo(PITCH + PAR_GAP, 0);
    },
    SLOW,
  );

  it(
    'US-030 AC-16c (SCAR-002): a column with a paragraph, a sub-heading or a list before the split paragraph also ends at the foot — the next line one pitch below',
    async () => {
      const cases: [string, string[], number][] = [
        ['a paragraph', [words(52), '', words(80, 'm')], 2],
        [
          'a sub-heading',
          [words(20), '', '#### Habits', '', words(120, 'm')],
          2,
        ],
        [
          'a list',
          [words(12), '', '- Fast', '- Shy', '- Small', '', words(120, 'm')],
          4,
        ],
      ];
      let checked = 0;
      for (const [name, body, attacks] of cases) {
        const c = await compile(body, attacks);
        const {w, step} = cut(c, 'm');
        expect(w.split?.block, name).toBeGreaterThan(0);
        expect(Math.abs(step - PITCH), name).toBeLessThanOrEqual(0.1);
        checked++;
      }
      expect(checked).toBe(cases.length);
    },
    3 * SLOW,
  );
});
