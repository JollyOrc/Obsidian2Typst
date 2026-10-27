// US-010 AC-2, AC-5, AC-6: what is known about the available font faces: the
// family names (compared without regard to case) and which characters each
// family has. Pure core: the faces come from the compiler (`get_font_info`),
// the core reads no file.
import type {FaceInfo} from './types';

/** Half-open ranges `[from, to)` of code points. */
export type CodePointRange = readonly [number, number];

/**
 * Decodes the coverage of a face: alternating run lengths of code points that
 * are not covered and covered, starting with not covered.
 */
export function decodeCoverage(runs: readonly number[]): CodePointRange[] {
  const ranges: CodePointRange[] = [];
  let position = 0;
  let covered = false;
  for (const length of runs) {
    if (covered && length > 0) ranges.push([position, position + length]);
    position += length;
    covered = !covered;
  }
  return ranges;
}

/** The families that are available and what they cover. */
export interface FontCatalog {
  /** Every family once, sorted without regard to case. */
  families(): string[];
  /** The name the font reports for `name` (any case); null when unknown. */
  resolve(name: string): string | null;
  /** True when some face of `family` (any case) has the code point. */
  hasGlyph(family: string, codePoint: number): boolean;
}

const key = (name: string): string => name.trim().toLowerCase();

function merge(ranges: CodePointRange[]): CodePointRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [from, to] of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && from <= last[1]) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }
  return out;
}

/** The catalog of `faces`; the faces of one family add up. */
export function createFontCatalog(faces: readonly FaceInfo[]): FontCatalog {
  const names = new Map<string, string>();
  const collected = new Map<string, CodePointRange[]>();
  for (const face of faces) {
    const id = key(face.family);
    if (!names.has(id)) names.set(id, face.family.trim());
    const list = collected.get(id) ?? [];
    list.push(...decodeCoverage(face.coverage));
    collected.set(id, list);
  }
  const ranges = new Map<string, CodePointRange[]>(
    [...collected].map(([id, list]) => [id, merge(list)]),
  );
  const sorted = [...names.values()].sort((a, b) => {
    const [x, y] = [a.toLowerCase(), b.toLowerCase()];
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return {
    families: () => [...sorted],
    resolve: (name) => names.get(key(name)) ?? null,
    hasGlyph(family, codePoint) {
      const list = ranges.get(key(family));
      if (list === undefined) return false;
      let low = 0;
      let high = list.length - 1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        const [from, to] = list[middle] as CodePointRange;
        if (codePoint < from) high = middle - 1;
        else if (codePoint >= to) low = middle + 1;
        else return true;
      }
      return false;
    },
  };
}
