// US-034 AC-7, AC-8, AC-10: the word-gap scan of an exported PDF. Pure: no
// Obsidian, Node, or I/O imports; a module of its own so that the compile
// worker, where the scan runs (AC-11), imports only the PDF reader.
import type {Warning} from '../emit/context';
import {openPdf, type PdfFile} from '../pdf/reader';
import {pageRuns, type TextRun} from '../pdf/text';

/** US-034 AC-7: one justified line and its widest gap (percent). */
export interface GapLine {
  /** 1-based PDF page. */
  page: number;
  text: string;
  maxGap: number;
}

/** US-034 AC-7: the pages an entry stands on (its own and its overflow). */
export interface EntryPages {
  heading: string;
  first: number;
  last: number;
}

/**
 * US-034 AC-7: runs on one baseline whose ends are further apart than this
 * share of the font size are different lines (two columns, a table's cells,
 * the lede beside the statblock). Within a line Typst's runs touch: a run
 * ends with its space glyph and its adjustment. Measured 2026-11-07 on a
 * justified 11 pt line with bold, italic, a link and code: at most 0.73 pt
 * between runs; a table's cells 10 pt apart (two 5 pt insets).
 */
const COLUMN_SPLIT_EM = 0.5;

/** Two runs are on one baseline when their y differ by less than this (pt). */
const BASELINE_PT = 0.5;

/**
 * US-034 AC-7: the lines of one page: runs grouped by baseline, ordered by
 * x, split where a gap wider than `COLUMN_SPLIT_EM` separates them. Header
 * and footer runs are left out.
 */
function linesOf(runs: readonly TextRun[]): TextRun[][] {
  const body = runs.filter((r) => !r.furniture && r.items.length > 0);
  const rows: TextRun[][] = [];
  for (const run of [...body].sort((a, b) => b.y - a.y || a.x0 - b.x0)) {
    const row = rows.find(
      (r) => Math.abs((r[0] as TextRun).y - run.y) < BASELINE_PT,
    );
    if (row === undefined) rows.push([run]);
    else row.push(run);
  }
  const out: TextRun[][] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x0 - b.x0);
    let line: TextRun[] = [];
    let end = Number.NEGATIVE_INFINITY;
    for (const run of row) {
      if (line.length > 0 && run.x0 - end > COLUMN_SPLIT_EM * run.size) {
        out.push(line);
        line = [];
      }
      line.push(run);
      end = Math.max(end, run.x1);
    }
    if (line.length > 0) out.push(line);
  }
  return out;
}

/**
 * US-034 AC-7, AC-10: a line's text and its widest gap: each space glyph
 * followed by a `TJ` adjustment gives (advance − adjustment) / advance ×
 * 100 (both in thousandths of an em; a negative adjustment widens); null
 * when no space of the line is adjusted (not justified or stretched).
 */
function measureLine(
  line: readonly TextRun[],
): {text: string; gap: number} | null {
  let text = '';
  let gap = 0;
  let adjusted = false;
  for (const run of line) {
    run.items.forEach((item, i) => {
      if (!('ch' in item)) return;
      text += item.ch;
      if (item.ch !== ' ' || item.adv <= 0) return;
      const next = run.items[i + 1];
      const kern = next !== undefined && 'kern' in next ? next.kern : 0;
      if (kern !== 0) adjusted = true;
      gap = Math.max(gap, ((item.adv - kern) / item.adv) * 100);
    });
  }
  // A hyphen Typst adds at a line break maps to U+00AD (soft hyphen).
  const shown = text
    .replace(/\u00ad/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return adjusted ? {text: shown, gap} : null;
}

const ROMAN: [number, string][] = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];
const roman = (n: number): string => {
  let out = '';
  for (const [v, s] of ROMAN)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
};

/**
 * US-034 AC-7: the folio of each page from the catalog's `/PageLabels`
 * (decimal, roman; `/St` the first number); a page without a numbered
 * label gets its PDF page number.
 */
function folios(file: PdfFile, count: number): string[] {
  const out = Array.from({length: count}, (_, i) => String(i + 1));
  const root = /\/Root\s+(\d+)\s+0\s+R/.exec(file.text);
  if (root === null) return out;
  const catalog = file.object(Number(root[1]));
  const ref = /\/PageLabels\s+(\d+)\s+0\s+R/.exec(catalog);
  const labels = ref === null ? catalog : file.object(Number(ref[1]));
  const nums = /\/Nums\s*\[([\s\S]*?)\]/.exec(labels);
  if (nums === null) return out;
  const runs: {start: number; dict: string}[] = [];
  for (const m of (nums[1] as string).matchAll(
    /(\d+)\s+(?:(\d+)\s+0\s+R|<<([\s\S]*?)>>)/g,
  )) {
    runs.push({
      start: Number(m[1]),
      dict: m[2] !== undefined ? file.object(Number(m[2])) : (m[3] ?? ''),
    });
  }
  for (let i = 0; i < count; i++) {
    const run = runs.filter((r) => r.start <= i).pop();
    if (run === undefined) continue;
    const style = /\/S\s*\/([DrRaA])/.exec(run.dict)?.[1];
    const n = Number(/\/St\s+(\d+)/.exec(run.dict)?.[1] ?? 1) + i - run.start;
    if (style === 'D') out[i] = String(n);
    else if (style === 'r') out[i] = roman(n);
    else if (style === 'R') out[i] = roman(n).toUpperCase();
  }
  return out;
}

/**
 * US-034 | AC-7, AC-8, AC-10: the justified lines of `pdf` and their widest
 * gaps, and `TEXT_WIDE_GAP "<where>": "<line>" (<n> %)` for each line over
 * `maxWordGap` (`<where>` the entry on whose pages the line stands,
 * else `p. <folio>`). Any failure to read the PDF gives one
 * `TEXT_GAP_SCAN_FAILED` and no lines; it never throws. `maxWordGap` 0
 * scans nothing.
 */
export function scanWordGaps(
  pdf: Uint8Array,
  options: {maxWordGap: number; entries?: readonly EntryPages[]},
): {lines: GapLine[]; warnings: Warning[]} {
  if (options.maxWordGap <= 0) return {lines: [], warnings: []};
  try {
    const file = openPdf(pdf);
    const pages = pageRuns(file);
    const folio = folios(file, pages.length);
    const lines: GapLine[] = [];
    const warnings: Warning[] = [];
    pages.forEach((runs, index) => {
      const page = index + 1;
      for (const line of linesOf(runs)) {
        const measured = measureLine(line);
        if (measured === null) continue;
        lines.push({page, text: measured.text, maxGap: measured.gap});
        if (measured.gap <= options.maxWordGap) continue;
        const entry = options.entries?.find(
          (e) => e.first <= page && page <= e.last,
        );
        const where = entry?.heading ?? `p. ${folio[index] ?? page}`;
        warnings.push({
          code: 'TEXT_WIDE_GAP',
          message: `"${where}": "${measured.text}" (${Math.round(measured.gap)} %)`,
          line: 0,
        });
      }
    });
    return {lines, warnings};
  } catch (error) {
    return {
      lines: [],
      warnings: [
        {
          code: 'TEXT_GAP_SCAN_FAILED',
          message: `The word-gap scan could not read the PDF (${error instanceof Error ? error.message : String(error)}); no line was checked`,
          line: 0,
        },
      ],
    };
  }
}

/**
 * US-034 AC-7: the pages of each placed entry from the compile's
 * `<o2t-entry>` and `<o2t-entry-end>` facts, paired in order by heading
 * (inline entries have none of their own).
 */
export function entryPages(
  places: readonly {heading: string; size: string; page: number}[],
  ends: readonly {heading: string; page: number}[],
): EntryPages[] {
  const used = new Set<number>();
  return places.flatMap((p) => {
    if (p.size === 'inline') return [];
    const at = ends.findIndex(
      (e, i) => !used.has(i) && e.heading === p.heading,
    );
    if (at >= 0) used.add(at);
    const last = at < 0 ? p.page : (ends[at] as {page: number}).page;
    return [{heading: p.heading, first: p.page, last: Math.max(last, p.page)}];
  });
}
