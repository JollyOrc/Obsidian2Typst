// US-036: the encounter sheet — blank tracker rows (a name and the stats, the
// tick boxes and every track cell, three attack slots) on an A4 page of its own
// and on a page in the book. Pure: no Obsidian, Node, or I/O imports. One
// row drawing for both forms, and the statblock's own box and cell drawing
// (`ENTRY_MARKS_DEF`, SCAR-017). The row count is measured in the compile
// (`measure()` of one row against the page's room, SCAR-021).
import type {Warning} from '../emit/context';
import {ENTRY_MARKS_DEF, statblockLook} from '../emit/entry';
import {escapeMarkup} from '../emit/escape-markup';
import {typstString} from '../emit/typst-string';
import type {ColorMode, EntriesSettings} from '../markers/entries';

/** US-036 AC-1: the sheet's texts; `rule` and `credit` empty → left out. */
export interface SheetText {
  title: string;
  name: string;
  attack: string;
  dice: string;
  rule: string;
  credit: string;
}

/** US-036 AC-1: the built-in texts and box count. */
export const SHEET_BUILTINS = Object.freeze({
  boxes: 30,
  text: Object.freeze<SheetText>({
    title: 'Encounter Sheet',
    name: 'NAME',
    attack: 'ATTACK',
    dice: 'DICE',
    rule: '',
    credit: '',
  }),
});

/** US-036 AC-1: the box counts a sheet row may have. */
export const SHEET_BOX_COUNTS: readonly number[] = [15, 30, 45];

/**
 * US-036 AC-5, AC-6, AC-8: the measured geometry. A4: margins 12 mm (sides,
 * top) and 10 mm (bottom), rows 91 mm in two columns 4 mm apart, box column
 * 46 mm. The book: one column at the text width with a 55 mm box column; two
 * across when two rows of at least 88 mm and the 4 mm gap fit.
 */
export const SHEET_LAYOUT = Object.freeze({
  a4: {
    margin: {side: 12, top: 12, bottom: 10},
    width: 210,
    height: 297,
    row: 91,
    boxColumn: 46,
  },
  book: {boxColumn: 55, twoAcrossRow: 88},
  gap: 4,
  /** AC-3 (decision 2): the smallest box that prints well (mm). */
  minBox: 2.0,
});

/** US-036 AC-2: the warning of a switched-on sheet with nothing to track. */
export const SHEET_EMPTY_WARNING: Warning = Object.freeze({
  code: 'ENCOUNTER_SHEET_EMPTY',
  message:
    'The encounter sheet needs entries.statblock.track or entries.statblock.boxes; no sheet is made',
  line: 0,
});

/**
 * US-036 AC-5: the warning of an A4 sheet that did not compile (`error`, the
 * compiler's text); the book is written as usual.
 */
export const sheetFailedWarning = (error: string): Warning => ({
  code: 'ENCOUNTER_SHEET_FAILED',
  message: `The encounter sheet did not compile; the book was written. ${error}`,
  line: 0,
});

/**
 * US-036 | AC-3, AC-7: the row and the sheet. `o2t-sheet-row(d, w, box-col)`
 * draws one framed row (0.4 pt, 2.5 mm padding) of three lines 1.6 mm
 * apart: the name and 7 × 4.5 mm stat boxes; the tick boxes in the box
 * column (shrunk when the row is narrower) with the track cells beside them
 * when each gets 4.5 mm, else under them; three attack slots (M23,
 * 2026-11-07), two side by side and the third below
 * from 100 mm, else stacked 1.2 mm apart; and records `<o2t-sheet-row>`.
 * `o2t-sheet(d, …)` draws the header (the heading or title,
 * the icon key, the rule between two lines), as many lines of rows as fit
 * `th` below it and above the credit with a 2 mm gap (`measure()` of one
 * row), the credit at the foot, and records `<o2t-sheet>` (form, rows,
 * columns, the box size in mm, the key).
 *
 * US-036 | AC-7a (#157): each key item (the 4 mm icon, 1 mm, the label) is
 * one box, so a line breaks only between items; the icon is moved down so
 * its middle sits half an x-height above the baseline (the key line stays
 * 4 mm high, AC-8's counts unchanged). The gap is 4 mm, shrunk to fit `tw`
 * (less 0.01 mm against rounding) down to 1.5 mm; it is weak, so a wrapped
 * line starts at the left edge. Assumes the items are measured in the
 * styles they are drawn in: the sheet's text font (`in-font`) wraps every
 * measurement of the key as it wraps the drawn sheet. The
 * fact's `key` holds the gap, the line count (from the measured key height
 * and the paragraph leading) and the icon's shift, in mm.
 */
export const SHEET_HELPER_DEF = `#let o2t-sheet-row(d, w, box-col) = {
  let lk = d.look
  let lab(t) = text(size: lk.sizes.text, fill: lk.accent, t)
  let wline = box(width: 100%, height: 1em, stroke: (bottom: 0.5pt + lk.frame.color))
  let iw = w - 5mm - 0.8pt
  let cols = (auto, 1fr)
  let items = (lab(d.text.name), wline)
  for s in d.stats {
    cols += (auto, 7mm)
    items += (lab(s), box(width: 7mm, height: 4.5mm, fill: lk.box-fill, stroke: 0.5pt + lk.frame.color))
  }
  let line1 = grid(columns: cols, column-gutter: 1.5mm, align: bottom, ..items)
  let bc = calc.min(box-col, iw)
  let boxes = o2t-box-rows(d.boxes, o2t-box-size(bc), lk)
  let n = d.cells.len()
  let cells = grid(columns: (1fr,) * calc.max(n, 1), column-gutter: 0.8mm, ..d.cells.map(c => o2t-cell(c, lk)))
  let rest = iw - bc - 2mm
  let line2 = if n == 0 { boxes } else if d.boxes == 0 { cells } else if rest >= n * 4.5mm + (n - 1) * 0.8mm {
    grid(columns: (bc, 1fr), column-gutter: 2mm, align: horizon, boxes, cells)
  } else { stack(spacing: 1.6mm, boxes, cells) }
  let slot = grid(columns: (auto, 1fr, auto, 10mm), column-gutter: 1.5mm, align: bottom, lab(d.text.attack), wline, lab(d.text.dice), wline)
  let line3 = if w >= 100mm { grid(columns: (1fr, 1fr), column-gutter: 4mm, row-gutter: 1.2mm, slot, slot, slot) } else { stack(spacing: 1.2mm, slot, slot, slot) }
  block(width: w, breakable: false, stroke: 0.4pt + lk.frame.color, inset: 2.5mm, fill: lk.fill, stack(spacing: 1.6mm, line1, line2, line3))
  [#metadata((boxes: d.boxes, cells: d.cells.map(c => c.label), stats: d.stats, attacks: 3)) <o2t-sheet-row>]
}
#let o2t-sheet(d, form: "book", tw: 0mm, th: 0mm, columns: 1, row-w: 0mm, box-col: 55mm, head: none) = context {
  let lk = d.look
  let lab(t) = text(size: lk.sizes.text, fill: lk.accent, t)
  let title = if head != none { head } else {
    text(size: lk.sizes.band * 1.4, weight: "bold", fill: lk.accent, d.text.title)
  }
  let f = lk.fonts.at("text", default: none)
  let in-font(x) = if f == none { x } else { text(font: f, x) }
  let xh = measure(in-font(text(size: lk.sizes.text, top-edge: "x-height", bottom-edge: "baseline", "x"))).height
  let items = d.cells.map(c => box(box(height: 4mm, baseline: 2mm - xh / 2, if c.icon == none { none } else { o2t-icon(c.icon, lk.icon) }) + h(1mm) + lab(c.label)))
  let n = items.len()
  let gap = if n < 2 { 0mm } else { calc.max(1.5mm, calc.min(4mm, (tw - items.map(x => measure(in-font(x)).width).sum()) / (n - 1) - 0.01mm)) }
  let key = if n == 0 { none } else { items.join(h(gap, weak: true)) }
  let lead = par.leading.to-absolute()
  let key-lines = if key == none { 0 } else { calc.round((measure(in-font(block(width: tw, key))).height + lead) / (4mm + lead)) }
  let header = block(width: tw, {
    title
    if key != none { v(1.5mm); key }
    if d.text.rule != none {
      v(1mm)
      line(length: 100%, stroke: 0.4pt + lk.frame.color)
      align(center, lab(d.text.rule))
      line(length: 100%, stroke: 0.4pt + lk.frame.color)
    }
  })
  let credit = if d.text.credit == none { none } else { text(size: lk.sizes.label, d.text.credit) }
  let rh = measure(o2t-sheet-row(d, row-w, box-col)).height
  let hh = measure(header).height + 3mm
  let ch = if credit == none { 0pt } else { measure(block(width: tw, credit)).height + 2mm }
  // One millimetre to spare: the heading's spacing is not measured.
  let lines = calc.max(1, calc.floor((th - hh - ch - 1mm + 2mm) / (rh + 2mm)))
  let n = lines * columns
  let bc = calc.min(box-col, row-w - 5mm - 0.8pt)
  let body = {
    [#metadata((form: form, rows: n, columns: columns, boxMm: calc.round(o2t-box-size(bc) / 1mm, digits: 3), key: (gapMm: calc.round(gap / 1mm, digits: 2), lines: key-lines, shiftMm: calc.round((2mm - xh / 2) / 1mm, digits: 2)))) <o2t-sheet>]
    header
    v(3mm)
    grid(columns: (row-w,) * columns, column-gutter: ${SHEET_LAYOUT.gap}mm, row-gutter: 2mm, ..range(n).map(_ => o2t-sheet-row(d, row-w, box-col)))
    if credit != none { place(bottom + left, credit) }
  }
  in-font(body)
}`;

/** The sheet's settings in effect, or null when no sheet can be made (AC-2). */
export function sheetSettings(entries: EntriesSettings | undefined): {
  boxes: number;
  text: SheetText;
} | null {
  const sb = entries?.statblock;
  const track = sb?.track ?? [];
  const boxKey = sb?.boxes;
  if (track.length === 0 && boxKey === undefined) return null;
  return {
    boxes:
      boxKey === undefined
        ? 0
        : (entries?.encounterSheetBoxes ?? SHEET_BUILTINS.boxes),
    text: {...SHEET_BUILTINS.text, ...entries?.encounterSheetText},
  };
}

/** Text as Typst content, escaped (US-013); `none` for ''. */
const content = (text: string): string =>
  text === '' ? 'none' : `[${escapeMarkup(text, {atBlockStart: false})}]`;

/**
 * US-036 AC-3, AC-7: the sheet's data as a Typst dictionary: the
 * statblock's look, the stat labels in upper case (the box key left out, as
 * on the statblock), the box count, every track cell with its icon's Typst
 * path (`icon`; none when missing), the texts. Null without a sheet (AC-2).
 */
export function sheetData(
  entries: EntriesSettings | undefined,
  colorMode: ColorMode | undefined,
  icon: (path: string) => string | null,
): string | null {
  const settings = sheetSettings(entries);
  if (settings === null) return null;
  const sb = entries?.statblock ?? {};
  const boxKey = sb.boxes?.toLowerCase();
  const stats = (sb.stats ?? [])
    .filter((f) => f.key.toLowerCase() !== boxKey)
    .map((f) => typstString(f.label.toUpperCase()));
  const cells = (sb.track ?? []).map((c) => {
    const path = icon(c.icon);
    return `(label: ${typstString(c.label)}, icon: ${path === null ? 'none' : typstString(path)})`;
  });
  const array = (items: readonly string[]): string =>
    items.length === 0
      ? '()'
      : items.length === 1
        ? `(${items[0]},)`
        : `(${items.join(', ')})`;
  const t = settings.text;
  const text = `(title: ${content(t.title)}, name: ${content(t.name)}, attack: ${content(t.attack)}, dice: ${content(t.dice)}, rule: ${content(t.rule)}, credit: ${content(t.credit)})`;
  return `(look: ${statblockLook(entries, colorMode)}, stats: ${array(stats)}, boxes: ${settings.boxes}, cells: ${array(cells)}, text: ${text})`;
}

/**
 * US-036 | AC-2, AC-5, AC-7, AC-8: the Typst source of the A4 file: one A4
 * portrait page with the measured margins, rows 91 mm wide two across with
 * a 46 mm box column, as many lines as fit. `typ` is null when the file is
 * off or there is nothing to track (then `ENCOUNTER_SHEET_EMPTY`). Icons
 * are written at `icon(path)` (the vault path by default).
 */
export function encounterSheetTyp(
  entries: unknown,
  options: {colorMode?: string; icon?: (path: string) => string | null} = {},
): {typ: string | null; warnings: Warning[]} {
  const settings = entries as EntriesSettings | undefined;
  if (settings?.encounterSheetFile !== true) return {typ: null, warnings: []};
  const data = sheetData(
    settings,
    options.colorMode as ColorMode | undefined,
    options.icon ?? ((path) => path),
  );
  if (data === null) return {typ: null, warnings: [SHEET_EMPTY_WARNING]};
  const a4 = SHEET_LAYOUT.a4;
  const tw = a4.width - 2 * a4.margin.side;
  const th = a4.height - a4.margin.top - a4.margin.bottom;
  const typ = [
    '// The encounter sheet (US-036), written by Obsidian2Typst on every export.',
    `#set page(width: ${a4.width}mm, height: ${a4.height}mm, margin: (left: ${a4.margin.side}mm, right: ${a4.margin.side}mm, top: ${a4.margin.top}mm, bottom: ${a4.margin.bottom}mm))`,
    ENTRY_MARKS_DEF,
    SHEET_HELPER_DEF,
    `#o2t-sheet(${data}, form: "A4", tw: ${tw}mm, th: ${th}mm, columns: 2, row-w: ${a4.row}mm, box-col: ${a4.boxColumn}mm)`,
    '',
  ].join('\n');
  return {typ, warnings: []};
}

/**
 * US-036 | AC-6: the call of the sheet page in the book for a text area of
 * `tw` × `th` mm: one column with the 55 mm box column, or two across like
 * the A4 file when two 88 mm rows and the gap fit; `head` is the Typst of
 * the page's heading (or '' for none).
 */
export function bookSheetCall(
  data: string,
  tw: number,
  th: number,
  head: string,
): string {
  const L = SHEET_LAYOUT;
  const two = tw >= 2 * L.book.twoAcrossRow + L.gap;
  const row = two ? (tw - L.gap) / 2 : tw;
  const mm = (n: number): string => `${Number(n.toFixed(3))}mm`;
  const box = two ? L.a4.boxColumn : L.book.boxColumn;
  const headArg = head === '' ? '' : `, head: [\n${head}\n]`;
  return `#o2t-sheet(${data}, form: "book", tw: ${mm(tw)}, th: ${mm(th)}, columns: ${two ? 2 : 1}, row-w: ${mm(row)}, box-col: ${mm(box)}${headArg})`;
}
