// US-043 AC-5 to AC-8: the prefilled encounter rows in Typst — the helpers
// the prelude defines and the call for one block. Pure: no Obsidian, Node,
// or I/O imports. What is drawn comes from the model
// (`src/core/encounter/model.ts`); the helpers draw it in the statblock's
// look with the marks the statblock and the sheet share (`ENTRY_MARKS_DEF`:
// `o2t-box-size`, `o2t-box-rows`, `o2t-cell`) and record each row as
// `<o2t-encounter-row>` and each block as `<o2t-encounter>` (the test
// interface of US-043). Every text is a Typst string: shown as written,
// never read as markup (rule 6).
import type {EncounterModel} from '../encounter/model';
import {typstString} from './typst-string';

/** US-043: the Typst names of the helpers (plugin names, US-016 AC-11). */
export const ENCOUNTER_HELPER = 'o2t-encounter';
export const ENCOUNTER_ROW_HELPER = 'o2t-encounter-row';

/** US-043 AC-8: two rows across from this row width (US-036 AC-6's rule). */
export const ENCOUNTER_TWO_ACROSS_MM = 88;

/**
 * US-043 | AC-5 to AC-8: the helpers. `o2t-encounter-row(r, d, w)` draws one
 * row `w` wide, framed (0.4 pt, 2.5 mm padding, the statblock's fill), never
 * split, lines 1.6 mm apart: (1) the label in the band font, bold, the note
 * under it in italics, the stat labels and their values in 7 × 4.5 mm boxes
 * on the right; the traits line when set; (2) exactly `r.boxes` boxes in a
 * box column of at most 46 mm, the cells (6 mm high, 5.4 mm wide each) on the
 * right; (3) every attack, name and dice in bold; a blank row: three
 * ATTACK/DICE write-in slots; (4) NOTES and a 4.5 mm write-in line. It
 * records its label, values, boxes, cells, attacks, slots, page and height,
 * and the rectangles of its writing space (`zones`: the box rows, the
 * cells, the notes line) and of its texts (`texts`), in mm from its corner.
 * `o2t-encounter(d)` lays the rows out two across when two rows of 88 mm and
 * the 4 mm gap fit the width, else one; 2 mm between rows; the title (if
 * any) sticks to the first row; records the block.
 */
export const ENCOUNTER_HELPER_DEF = `#let ${ENCOUNTER_ROW_HELPER}(r, d, w) = {
  let lk = d.look
  let pad = 2.5mm
  let iw = w - 2 * pad - 0.8pt
  let f-band = lk.fonts.at("band", default: none)
  let f-text = lk.fonts.at("text", default: none)
  let in-font(f, x) = if f == none { x } else { text(font: f, x) }
  let lab(t) = in-font(f-text, text(size: lk.sizes.label, fill: lk.accent, upper(t)))
  let txt(t, ..args) = in-font(f-text, text(size: lk.sizes.text, ..args, t))
  let statbox(v) = box(width: 7mm, height: 4.5mm, fill: lk.box-fill, stroke: 0.5pt + lk.frame.color, align(center + horizon, txt(v, weight: "bold")))
  let name = {
    in-font(f-band, text(size: lk.sizes.band, weight: "bold", fill: lk.accent, r.label))
    if r.note != none { linebreak(); txt(r.note, style: "italic") }
  }
  let stats = if d.stats.len() == 0 { none } else {
    grid(columns: d.stats.len() * 2, column-gutter: 1mm, align: horizon,
      ..d.stats.zip(r.stats).map(p => (lab(p.at(0)), statbox(p.at(1)))).flatten())
  }
  let line1 = grid(columns: (1fr, auto), column-gutter: 2mm, align: (left + top, right + top), name, stats)
  let traits = if r.traits.len() == 0 { none } else { txt(r.traits.join("  ·  "), fill: lk.accent) }
  let bc = calc.min(46mm, iw * 0.55)
  let boxes = if r.boxes == 0 { none } else { o2t-box-rows(r.boxes, o2t-box-size(bc), lk) }
  let cells = if r.cells.len() == 0 { none } else {
    grid(columns: (5.4mm,) * r.cells.len(), column-gutter: 0.8mm, ..r.cells.map(c => o2t-cell(c, lk)))
  }
  let line2 = grid(columns: (bc, 1fr), column-gutter: 2mm, align: (left + horizon, right + horizon), boxes, cells)
  let wline = box(width: 100%, height: 4.5mm, stroke: (bottom: 0.4pt + lk.frame.color))
  let line3 = if r.slots > 0 {
    let slot = grid(columns: (auto, 1fr, auto, 10mm), column-gutter: 1.5mm, align: bottom, lab("Attack"), wline, lab("Dice"), wline)
    stack(spacing: 1.2mm, ..range(r.slots).map(_ => slot))
  } else if r.attacks.len() == 0 { none } else {
    grid(columns: (auto, 1fr), column-gutter: 2mm, row-gutter: 1mm,
      ..r.attacks.map(a => (txt(a.at(0)), txt(a.at(1), weight: "bold"))).flatten())
  }
  let notes-label = lab("Notes")
  let line4 = grid(columns: (auto, 1fr), column-gutter: 1.5mm, align: bottom, notes-label, wline)
  let parts = (line1, traits, line2, line3, line4).filter(p => p != none)
  let body = stack(spacing: 1.6mm, ..parts)
  context {
    let m(x) = measure(block(width: iw, x))
    let mm(x) = calc.round(x / 1mm, digits: 3)
    let rect(x, y, w, h) = (x: mm(x), y: mm(y), w: mm(w), h: mm(h))
    let y = pad
    let texts = ()
    let zones = ()
    let h1 = m(line1).height
    texts.push(rect(pad, y, iw, h1))
    y += h1 + 1.6mm
    if traits != none {
      let t = m(traits)
      texts.push(rect(pad, y, measure(traits).width, t.height))
      y += t.height + 1.6mm
    }
    let h2 = m(line2).height
    if boxes != none {
      let b = measure(boxes)
      zones.push(rect(pad, y + (h2 - b.height) / 2, b.width, b.height))
    }
    if cells != none {
      let c = measure(cells)
      zones.push(rect(pad + iw - c.width, y + (h2 - c.height) / 2, c.width, c.height))
    }
    y += h2 + 1.6mm
    if line3 != none {
      let h3 = m(line3).height
      texts.push(rect(pad, y, iw, h3))
      y += h3 + 1.6mm
    }
    let lw = measure(notes-label).width
    let h4 = m(line4).height
    texts.push(rect(pad, y + h4 - measure(notes-label).height, lw, measure(notes-label).height))
    zones.push(rect(pad + lw + 1.5mm, y + h4 - 4.5mm, iw - lw - 1.5mm, 4.5mm))
    let row = block(width: w, breakable: false, stroke: 0.4pt + lk.frame.color, inset: pad, fill: lk.fill, body)
    [#metadata((block: d.id, label: r.label, note: r.note, blank: r.blank, stats: r.stats, traits: r.traits, boxes: r.boxes, cells: r.cells.map(c => c.label), attacks: r.attacks, slots: r.slots, zones: zones, texts: texts, page: here().page(), height: mm(measure(row).height))) <o2t-encounter-row>]
    row
  }
}
#let ${ENCOUNTER_HELPER}(d) = layout(size => {
  let two = size.width >= 2 * ${ENCOUNTER_TWO_ACROSS_MM}mm + 4mm
  let cols = if two { 2 } else { 1 }
  let rw = if two { (size.width - 4mm) / 2 } else { size.width }
  let lk = d.look
  if d.title != none {
    block(sticky: true, below: 1.5mm, text(size: lk.sizes.band, weight: "bold", fill: lk.accent, d.title))
  }
  grid(columns: (rw,) * cols, column-gutter: 4mm, row-gutter: 2mm, ..d.rows.map(r => ${ENCOUNTER_ROW_HELPER}(r, d, rw)))
  context {
    let mine = query(<o2t-encounter-row>).map(x => x.value).filter(v => v.block == d.id)
    [#metadata((title: d.title, rows: d.rows.len(), columns: cols, rowMm: calc.round(rw / 1mm, digits: 3), pages: mine.map(v => v.page), heightsMm: mine.map(v => v.height))) <o2t-encounter>]
  }
})`;

const array = (items: readonly string[]): string =>
  items.length === 0
    ? '()'
    : items.length === 1
      ? `(${items[0]},)`
      : `(${items.join(', ')})`;

const textOrNone = (value: string | null): string =>
  value === null ? 'none' : typstString(value);

/**
 * US-043 | AC-5 to AC-8: `#o2t-encounter((id: …, look: …, stats: (…),
 * title: …, rows: (…)))` for one block's model. `look` is the statblock's
 * look dictionary; `statLabels` the preset's stat labels; `icon(label)` the
 * Typst path of a track cell's icon (none when missing). Every text is a
 * Typst string (rule 6). The same model gives the same text byte for byte.
 */
export function encounterCall(
  id: number,
  model: EncounterModel,
  look: string,
  statLabels: readonly string[],
  icon: (label: string) => string | null,
): string {
  const rows = model.rows.map((r) => {
    const cells = r.cells.map(
      (label) =>
        `(label: ${typstString(label)}, icon: ${textOrNone(icon(label))})`,
    );
    const attacks = r.attacks.map(
      (a) => `(${typstString(a.name)}, ${typstString(a.dice)})`,
    );
    return `(label: ${typstString(r.label)}, note: ${textOrNone(r.note)}, blank: ${r.blank}, stats: ${array(r.stats.map(typstString))}, traits: ${array(r.traits.map(typstString))}, boxes: ${r.boxes}, cells: ${array(cells)}, attacks: ${array(attacks)}, slots: ${r.slots})`;
  });
  return `#${ENCOUNTER_HELPER}((id: ${id}, look: ${look}, stats: ${array(statLabels.map(typstString))}, title: ${textOrNone(model.title)}, rows: ${array(rows)}))`;
}
