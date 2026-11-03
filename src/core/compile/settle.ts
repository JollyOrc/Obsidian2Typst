// US-028 AC-14 to AC-17 (amendment #116): the pure parts of an export that
// compiles until Typst's layout settles — the text a later compile writes,
// the choice of the next compile, the reading of Typst's warnings, the two
// warnings and the notice. No Obsidian, Node or I/O imports.
//
// Transforms used (shared-utility register): typstString (the hint keys).
import {FIT_HINT_LINES, type Warning} from '../emit';
import {typstString} from '../emit/typst-string';

/** US-028 AC-15 (decision F): the most compiles before the fallback. */
export const FIT_COMPILE_LIMIT = 8;

/** A decision an image of `fit-flow` takes, by its probe's label. */
export interface FitHint {
  key: string;
  d: 'full' | 'shrink' | 'float' | 'move';
  r: number;
}

/** One compile of the loop: how the helper uses the hints, and the hints. */
export interface FitStep {
  mode: 'seeded' | 'pinned';
  hints: readonly FitHint[];
}

/** The largest ratio difference that still counts as the same decision. */
const RATIO_TOLERANCE = 0.001;

const KINDS: ReadonlySet<string> = new Set(['full', 'shrink', 'float', 'move']);

/** The decision record of AC-17, when `value` is one the helper writes. */
interface Record17 {
  key: string;
  d: FitHint['d'];
  r: number;
  want: FitHint['d'];
  wr: number;
}

/**
 * US-028 | AC-15: `value` as the helper's record (AC-17): a text `key`, `d`
 * and `want` among the four decisions, finite `r` and `wr`; anything else
 * (a foreign label, an older engine's record) is null.
 */
function recordOf(value: unknown): Record17 | null {
  if (typeof value !== 'object' || value === null) return null;
  const {key, d, r, want, wr} = value as Record<string, unknown>;
  if (typeof key !== 'string') return null;
  if (typeof d !== 'string' || !KINDS.has(d)) return null;
  if (typeof want !== 'string' || !KINDS.has(want)) return null;
  if (typeof r !== 'number' || !Number.isFinite(r)) return null;
  if (typeof wr !== 'number' || !Number.isFinite(wr)) return null;
  return {key, d: d as FitHint['d'], r, want: want as FitHint['d'], wr};
}

/** True when two decisions are the same within the ratio tolerance. */
const same = (a: FitHint['d'], ar: number, b: FitHint['d'], br: number) =>
  a === b && Math.abs(ar - br) <= RATIO_TOLERANCE;

/**
 * US-028 | AC-15: The next compile after one with `step` that gave `settled`
 * and the decision values `decisions`, or null when this compile is the
 * result, or `'stuck'` when the loop ends without one (step 5, decision 17).
 *
 * In order: unread warnings (`undefined`) or no decisions end the loop (null;
 * nothing to go on, AC-5 never fails an export). A settled seeded compile is
 * the result; a settled pinned compile is the result when every image wants
 * its decision (`d` = `want`, ratios within 0.001). A pinned compile that
 * does not settle while every image wants its decision is stuck. A seeded
 * compile whose decisions equal its hints, and any other pinned compile, pin
 * the next to the wants (`want`, `wr`); else the next is seeded with the
 * decisions taken (`d`, `r`). Values that are not the helper's record are
 * left out; hints keep the document order of the values.
 */
export function nextFitCompile(
  step: FitStep,
  settled: boolean | undefined,
  decisions: readonly unknown[] | undefined,
): FitStep | null | 'stuck' {
  if (settled === undefined || decisions === undefined) return null;
  const records = decisions
    .map(recordOf)
    .filter((record): record is Record17 => record !== null);
  if (records.length === 0) return null;
  const content = records.every((x) => same(x.d, x.r, x.want, x.wr));
  if (settled && (step.mode === 'seeded' || content)) return null;
  if (step.mode === 'pinned' && content) return 'stuck';
  const wanted = (): FitStep => ({
    mode: 'pinned',
    hints: records.map((x) => ({key: x.key, d: x.want, r: x.wr})),
  });
  if (step.mode === 'pinned') return wanted();
  const hinted = new Map(step.hints.map((h) => [h.key, h]));
  const unchanged = records.every((x) => {
    const hint = hinted.get(x.key);
    return hint !== undefined && same(hint.d, hint.r, x.d, x.r);
  });
  if (unchanged) return wanted();
  return {
    mode: 'seeded',
    hints: records.map((x) => ({key: x.key, d: x.d, r: x.r})),
  };
}

/** A ratio as a Typst float: always with a point (`1.0`, `0.875`). */
const ratioText = (r: number): string =>
  Number.isInteger(r) ? r.toFixed(1) : String(r);

/**
 * US-028 | AC-17: `typ` with its hints lines (`FIT_HINT_LINES`) replaced by
 * `hints` (in their order, keyed through `typstString`, a ratio with a
 * point) and `pinned`. A text without the lines (the rule is off) is
 * returned as it is; no hints and not pinned give the lines as written.
 */
export function withFitHints(
  typ: string,
  hints: readonly FitHint[],
  pinned: boolean,
): string {
  if (!typ.includes(FIT_HINT_LINES)) return typ;
  const entries = hints
    .map((h) => `${typstString(h.key)}: (d: "${h.d}", r: ${ratioText(h.r)})`)
    .join(', ');
  const lines = [
    `#let o2t-fit-hints = (${entries === '' ? ':' : entries})`,
    `#let o2t-fit-pinned = ${pinned ? 'true' : 'false'}`,
  ].join('\n');
  return typ.replace(FIT_HINT_LINES, () => lines);
}

const NOT_CONVERGED = 'layout did not converge';

/**
 * US-028 | AC-14: False when one of Typst's diagnostics says the layout did
 * not converge (measured texts: the `unix` string `: warning: layout did not
 * converge within 5 attempts, …` and a `full` object with that `message`);
 * any other warning or error leaves it true.
 */
export function layoutSettled(diagnostics: readonly unknown[]): boolean {
  return !diagnostics.some((d) => {
    const text =
      typeof d === 'string'
        ? d
        : typeof d === 'object' && d !== null
          ? String((d as {message?: unknown}).message ?? '')
          : '';
    return text.includes(NOT_CONVERGED);
  });
}

/** US-028 | AC-14 (decision A): the export's last compile did not settle. */
export const LAYOUT_NOT_SETTLED_WARNING: Warning = Object.freeze({
  code: 'LAYOUT_NOT_SETTLED',
  message:
    'The layout did not settle; page numbers, running headers and image places may be wrong',
  line: 0,
});

/** US-028 | AC-16 (decision A): the export fell back to `images.minScale: 100`. */
export const IMAGE_FIT_OFF_WARNING: Warning = Object.freeze({
  code: 'IMAGE_FIT_OFF',
  message: `Image fit did not settle the layout in ${FIT_COMPILE_LIMIT} compiles; exported without it (images.minScale 100)`,
  line: 0,
});

/**
 * US-028 | AC-15 (decision D): the notice of compile `n` of at most `limit`:
 * `Compiling…` for the first, `Compiling… (n of up to limit)` after it.
 */
export function compilingNotice(n: number, limit: number): string {
  return n <= 1 ? 'Compiling…' : `Compiling… (${n} of up to ${limit})`;
}
