// US-028 AC-14 to AC-17 (amendment #116) — the pure parts of a layout that
// settles: the helper's hints and its decision lines, the text a later
// compile writes (`withFitHints`), the choice of the next compile
// (`nextFitCompile`), the reading of Typst's warnings (`layoutSettled`), the
// two warnings and the notice. The functions are looked up by their expected
// names (red until the code, as in tests/unit/us-028-image-fit.test.ts).
// Source of truth: docs/user-stories/US-028-image-fit.md.
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import * as compile from '../../src/core/compile';
import {type ConvertSettings} from '../../src/core/convert';
import {PLUGIN_NAMES} from '../../src/core/template';
import {SETTINGS, run} from '../support/convert';

type Hint = {key: string; d: string; r: number};
type Step = {mode: 'seeded' | 'pinned'; hints: Hint[]};
type Warning = {code: string; message: string; line: number};

/** The function `name` of `core/compile` (red until the code). */
const fn = <T>(name: string): T => {
  const found = (compile as unknown as Record<string, unknown>)[name];
  if (typeof found !== 'function') throw new Error(`${name} is not defined`);
  return found as T;
};
const value = <T>(name: string): T => {
  const found = (compile as unknown as Record<string, unknown>)[name];
  if (found === undefined) throw new Error(`${name} is not defined`);
  return found as T;
};
const withFitHints = (typ: string, hints: Hint[], pinned: boolean): string =>
  fn<(t: string, h: Hint[], p: boolean) => string>('withFitHints')(
    typ,
    hints,
    pinned,
  );
const nextFitCompile = (
  step: Step,
  settled: boolean | undefined,
  decisions: unknown[] | undefined,
): Step | null | 'stuck' =>
  fn<(s: Step, settled?: boolean, d?: unknown[]) => Step | null | 'stuck'>(
    'nextFitCompile',
  )(step, settled, decisions);

/** The mode of a next step; null (the result) and 'stuck' as they are. */
const modeOf = (next: Step | null | 'stuck') =>
  next === null || next === 'stuck' ? next : next.mode;

const convertWith = (source: string, minScale: number) =>
  run(source, {
    settings: {...SETTINGS, images: {minScale}} as ConvertSettings,
  });

/** A decision as the helper writes it (AC-17), with the fields AC-5 reads. */
const dec = (
  n: number,
  d: string,
  r: number,
  want = d,
  wr = r,
): Record<string, unknown> => ({
  d,
  line: 10 * n,
  name: `img${n}.png`,
  key: `o2t-fit-${n}`,
  r,
  want,
  wr,
});

const HINTS_LINES = '#let o2t-fit-hints = (:)\n#let o2t-fit-pinned = false';

describe('US-028 AC-17 what is written', () => {
  it('US-028 AC-17: with fit-flow the preamble has the empty hints and pinned false, once, before the helper', async () => {
    const {typ} = await convertWith('A.\n\n![[map.png]]\n\nB.', 70);
    expect(typ.split(HINTS_LINES)).toHaveLength(2);
    expect(typ.indexOf(HINTS_LINES)).toBeLessThan(
      typ.indexOf('#let fit-flow('),
    );
  });

  it('US-028 AC-17, AC-10 guard: at 100 there are no hints lines (the output stays byte-identical to today)', async () => {
    const {typ} = await convertWith('A.\n\n![[map.png]]\n\nB.', 100);
    expect(typ).not.toContain('o2t-fit');
  });

  it('US-028 AC-17: the helper reads the hint by the probe label, uses it while the probe has no place or when pinned, and records want, wr and the key', async () => {
    const {typ} = await convertWith('A.\n\n![[map.png]]\n\nB.', 70);
    const helper = typ.slice(typ.indexOf('#let fit-flow('));
    for (const line of [
      '    let key = str(at)',
      '    let hint = o2t-fit-hints.at(key, default: none)',
      '    let known = query(at).len() > 0',
      '    let pos = if known { locate(at).position() } else { (page: 1, x: 0pt, y: 0pt) }',
      '      let want = if h + cap(w) <= room { "full" } else if h * min + cap(w * min) <= room { "shrink" } else if floats and (not sides or calc.even(pos.page)) { "float" } else { "move" }',
      '      let wr = if want == "shrink" { (room - cap(w)) / h } else { 1.0 }',
      '      let use = hint != none and (o2t-fit-pinned or not known)',
      '      let d = if use { hint.d } else { want }',
      '      let r = if use { hint.r } else { wr }',
      '      [#metadata((d: d, line: line, name: name, key: key, r: r, want: want, wr: wr)) <o2t-fit-decision>]',
      '      if d == "full" { fig(w) }',
      '      else if d == "shrink" { fig(w * r) }',
      '      else if d == "float" { place(top, float: true, clearance: 1em, [#fig(w) #label(str(at) + "-f")]) }',
      '      else { fig(w) }',
    ]) {
      expect(helper.split('\n'), line).toContain(line);
    }
    // the decision is made after the room and its own-page correction (AC-3)
    expect(helper.indexOf('let want =')).toBeGreaterThan(
      helper.indexOf('let own ='),
    );
    // the old record-and-place lines are gone
    expect(helper).not.toContain('let rec(d)');
  });

  it('US-028 AC-17 (US-016 AC-11): o2t-fit-hints and o2t-fit-pinned are plugin names', () => {
    expect(PLUGIN_NAMES).toContain('o2t-fit-hints');
    expect(PLUGIN_NAMES).toContain('o2t-fit-pinned');
  });

  it('US-028 AC-17: withFitHints writes the hints by key in order, ratios as numbers with a point, and pinned', () => {
    const typ = `#set page()\n${HINTS_LINES}\n#let fit-flow() = none\nBody.`;
    expect(
      withFitHints(
        typ,
        [
          {key: 'o2t-fit-1', d: 'float', r: 1},
          {key: 'o2t-fit-2', d: 'shrink', r: 0.875},
        ],
        true,
      ),
    ).toBe(
      '#set page()\n#let o2t-fit-hints = ("o2t-fit-1": (d: "float", r: 1.0), "o2t-fit-2": (d: "shrink", r: 0.875))\n#let o2t-fit-pinned = true\n#let fit-flow() = none\nBody.',
    );
    expect(withFitHints(typ, [], false)).toBe(typ);
  });

  it('US-028 AC-17: withFitHints leaves a text without the hints lines as it is (the rule is off)', () => {
    expect(withFitHints('= Rules\n', [{key: 'k', d: 'full', r: 1}], true)).toBe(
      '= Rules\n',
    );
  });

  it('US-028 AC-17 (rule 7): the same hints give the same text', () => {
    const typ = `${HINTS_LINES}\nBody.`;
    const hints = [{key: 'o2t-fit-1', d: 'move', r: 1}];
    expect(withFitHints(typ, hints, false)).toBe(
      withFitHints(typ, hints, false),
    );
  });
});

describe('US-028 AC-15 the next compile', () => {
  const seeded0: Step = {mode: 'seeded', hints: []};

  it('US-028 AC-15 step 2: a seeded compile that settles is the result', () => {
    expect(nextFitCompile(seeded0, true, [dec(1, 'full', 1)])).toBeNull();
  });

  it('US-028 AC-15 step 4: a seeded compile that does not settle and changed its decisions seeds the next with them (d, r)', () => {
    expect(
      nextFitCompile(seeded0, false, [
        dec(1, 'shrink', 0.8),
        dec(2, 'float', 1),
      ]),
    ).toEqual({
      mode: 'seeded',
      hints: [
        {key: 'o2t-fit-1', d: 'shrink', r: 0.8},
        {key: 'o2t-fit-2', d: 'float', r: 1},
      ],
    });
  });

  it('US-028 AC-15 step 3: a seeded compile that changed no decision against its hints pins the next to what the images want (want, wr)', () => {
    const step: Step = {
      mode: 'seeded',
      hints: [
        {key: 'o2t-fit-1', d: 'shrink', r: 0.8},
        {key: 'o2t-fit-2', d: 'float', r: 1},
      ],
    };
    expect(
      nextFitCompile(step, false, [
        dec(1, 'shrink', 0.8, 'full', 1),
        dec(2, 'float', 1, 'float', 1),
      ]),
    ).toEqual({
      mode: 'pinned',
      hints: [
        {key: 'o2t-fit-1', d: 'full', r: 1},
        {key: 'o2t-fit-2', d: 'float', r: 1},
      ],
    });
  });

  it('US-028 AC-15 step 3: a ratio within 0.001 of its hint counts as unchanged; more counts as changed', () => {
    const step: Step = {
      mode: 'seeded',
      hints: [{key: 'o2t-fit-1', d: 'shrink', r: 0.8}],
    };
    expect(
      modeOf(nextFitCompile(step, false, [dec(1, 'shrink', 0.8009)])),
    ).toBe('pinned');
    expect(modeOf(nextFitCompile(step, false, [dec(1, 'shrink', 0.802)]))).toBe(
      'seeded',
    );
  });

  it('US-028 AC-15 step 2: a pinned compile that settles with every image wanting its decision is the result', () => {
    const step: Step = {
      mode: 'pinned',
      hints: [{key: 'o2t-fit-1', d: 'shrink', r: 0.8}],
    };
    expect(
      nextFitCompile(step, true, [dec(1, 'shrink', 0.8, 'shrink', 0.8005)]),
    ).toBeNull();
  });

  it('US-028 AC-15 step 3: a pinned compile that settles but where an image wants otherwise pins the next to the wants', () => {
    const step: Step = {
      mode: 'pinned',
      hints: [{key: 'o2t-fit-1', d: 'move', r: 1}],
    };
    expect(nextFitCompile(step, true, [dec(1, 'move', 1, 'full', 1)])).toEqual({
      mode: 'pinned',
      hints: [{key: 'o2t-fit-1', d: 'full', r: 1}],
    });
  });

  it('US-028 AC-15 step 3: a pinned compile that does not settle, where an image wants otherwise, pins the next to the wants', () => {
    const step: Step = {
      mode: 'pinned',
      hints: [{key: 'o2t-fit-1', d: 'move', r: 1}],
    };
    expect(nextFitCompile(step, false, [dec(1, 'move', 1, 'full', 1)])).toEqual(
      {mode: 'pinned', hints: [{key: 'o2t-fit-1', d: 'full', r: 1}]},
    );
  });

  it('US-028 AC-15 step 5 (decision 17): a pinned compile that does not settle while every image wants its decision is stuck (the fallback follows)', () => {
    const step: Step = {
      mode: 'pinned',
      hints: [
        {key: 'o2t-fit-1', d: 'move', r: 1},
        {key: 'o2t-fit-2', d: 'shrink', r: 0.8},
      ],
    };
    expect(
      nextFitCompile(step, false, [
        dec(1, 'move', 1),
        dec(2, 'shrink', 0.8, 'shrink', 0.8004),
      ]),
    ).toBe('stuck');
    // guard: a seeded compile in the same state is not stuck (step 3 pins)
    expect(
      nextFitCompile({...step, mode: 'seeded'}, false, [
        dec(1, 'move', 1),
        dec(2, 'shrink', 0.8),
      ]),
    ).toEqual({...step, mode: 'pinned'});
  });

  it('US-028 AC-14, AC-15: unread warnings (undefined) or no decisions end the loop at once (nothing to go on; AC-5: never fail)', () => {
    expect(nextFitCompile(seeded0, undefined, [dec(1, 'full', 1)])).toBeNull();
    expect(nextFitCompile(seeded0, false, undefined)).toBeNull();
    expect(nextFitCompile(seeded0, false, [])).toBeNull();
  });

  it('US-028 AC-15 (SCAR-023): a value the helper does not write (foreign, without key, want or a finite ratio) is left out of the hints', () => {
    expect(
      nextFitCompile(seeded0, false, [
        dec(1, 'float', 1),
        {d: 'float', line: 3, name: 'x.png'},
        {...dec(2, 'shrink', 0.8), r: 'x'},
        {...dec(3, 'shrink', 0.8), want: 'big'},
        'text',
        null,
      ]),
    ).toEqual({mode: 'seeded', hints: [{key: 'o2t-fit-1', d: 'float', r: 1}]});
  });

  it('US-028 AC-15 (decision F): the limit is the constant 8', () => {
    expect(value<number>('FIT_COMPILE_LIMIT')).toBe(8);
  });
});

describe('US-028 AC-14, AC-16 the warnings and the notice', () => {
  const settled = (d: unknown[]) =>
    fn<(d: unknown[]) => boolean>('layoutSettled')(d);

  it("US-028 AC-14: Typst's non-convergence warning (unix and full form, measured) means not settled; other warnings and errors do not", () => {
    expect(
      settled([
        ': warning: layout did not converge within 5 attempts, hints: check if any states or queries are updating themselves',
      ]),
    ).toBe(false);
    expect(
      settled([
        {
          severity: 'warning',
          message:
            'layout did not converge within 5 attempts, hints: check if any states or queries are updating themselves',
        },
      ]),
    ).toBe(false);
    expect(
      settled(['/template.typ:24:39: warning: unknown font family: nope']),
    ).toBe(true);
    expect(settled([])).toBe(true);
  });

  it('US-028 AC-14, AC-16 (decision A): the two warnings, without a source line', () => {
    expect(value<Warning>('LAYOUT_NOT_SETTLED_WARNING')).toEqual({
      code: 'LAYOUT_NOT_SETTLED',
      message:
        'The layout did not settle; page numbers, running headers and image places may be wrong',
      line: 0,
    });
    expect(value<Warning>('IMAGE_FIT_OFF_WARNING')).toEqual({
      code: 'IMAGE_FIT_OFF',
      message:
        'Image fit did not settle the layout in 8 compiles; exported without it (images.minScale 100)',
      line: 0,
    });
  });

  it('US-028 AC-14, AC-16: both codes are in the warning registry with US-028', () => {
    const text = readFileSync('docs/technical/warning-codes.md', 'utf8');
    const row = (code: string) =>
      text.split('\n').find((line) => line.startsWith(`| \`${code}\` |`)) ?? '';
    expect(row('LAYOUT_NOT_SETTLED')).toContain('US-028');
    expect(row('IMAGE_FIT_OFF')).toContain('US-028');
  });

  it('US-028 AC-15 (decision D): the notice is "Compiling…" for compile 1 and names the compile and the limit from compile 2 on', () => {
    const notice = fn<(n: number, limit: number) => string>('compilingNotice');
    expect(notice(1, 8)).toBe('Compiling…');
    expect(notice(2, 8)).toBe('Compiling… (2 of up to 8)');
    expect(notice(8, 8)).toBe('Compiling… (8 of up to 8)');
  });
});
