// US-030 AC-10 to AC-17: the statblock in Typst — the helper the prelude
// defines, the look it is drawn with, and the call for one entry. Pure: no
// Obsidian, Node, or I/O imports. What is drawn comes from the shared model
// (`src/core/entries/model.ts`); the helper only draws it and records what it
// drew as `<o2t-statblock>` metadata (the test interface of US-030).
import type {StatblockModel} from '../entries/model';
import {
  NARROW_COLUMN_SHARE,
  narrowLimits,
  STATBLOCK_BUILTINS,
  type ColorMode,
  type EntriesSettings,
} from '../markers';
import {escapeMarkup} from './escape-markup';
import {typstString} from './typst-string';

/** US-030 AC-15: the Typst name of the statblock helper (a plugin name). */
export const STATBLOCK_HELPER = 'o2t-statblock';

/**
 * US-030 AC-16, AC-12 (G0-C8): the named constants of the layout: the
 * statblock's share of the text width, the gutter beside the opening
 * paragraph, the box row's label column and its gaps (inside a group of 5,
 * between groups), the gray of grayscale and the icons' opacity.
 */
export const STATBLOCK_LAYOUT = Object.freeze({
  width: '55%',
  gutter: '4mm',
  labelColumn: '7.5mm',
  boxGap: '0.35mm',
  groupGap: '1.25mm',
  gray: '#4d4d4d',
  iconOpacity: '0.75',
});

const L = STATBLOCK_LAYOUT;

/**
 * US-030 | AC-10 to AC-17: the helper. `d` is the statblock (band, look,
 * boxes, track, attributes, traits, attacks, skills, tags); the body is
 * wrapped around it by `o2t-wrap` (#139, below). Draws the parts that
 * are present, separated by rules; 15 boxes per row in groups of 5, the box
 * size from the width; equal track cells with the SVG icon read, recoloured
 * (every fill and stroke but `none`) and drawn at 75 %; attacks with a 1 em
 * hanging indent; never split (`breakable: false`). Records
 * `(band, boxes, rows, cells, parts)` as `<o2t-statblock>`.
 */
/**
 * US-030 AC-12, AC-13, US-036 AC-3 (SCAR-017): the marks the statblock and
 * the encounter sheet both draw: the box size for a column width (15 a row,
 * groups of 5), rows of boxes, a track cell with its recoloured icon at
 * ${L.iconOpacity}.
 */
export const ENTRY_MARKS_DEF = `#let o2t-box-size(w) = (w - 12 * ${L.boxGap} - 2 * ${L.groupGap}) / 15
#let o2t-box-rows(count, s, lk) = {
  let one = box(width: s, height: s, fill: lk.box-fill, stroke: 0.5pt + lk.frame.color)
  let lines = range(calc.ceil(count / 15)).map(r => {
    let n = calc.min(15, count - r * 15)
    let row = ()
    for i in range(n) {
      row.push(one)
      if i < n - 1 { row.push(h(if calc.rem(i + 1, 5) == 0 { ${L.groupGap} } else { ${L.boxGap} })) }
    }
    row.join()
  })
  stack(spacing: ${L.boxGap}, ..lines)
}
#let o2t-icon(path, colour) = {
  let lk = (icon: colour)
  let svg = read(path).replace(regex("\\\\b(fill|stroke)=\\"([^\\"]*)\\""), m => if m.captures.at(1).trim() == "none" { m.text } else { m.captures.at(0) + "=\\"" + lk.icon + "\\"" })
  image(bytes(svg.replace(regex("<svg\\\\b"), "<svg opacity=\\"${L.iconOpacity}\\"", count: 1)), format: "svg", height: 100%)
}
#let o2t-cell(c, lk, height: 6mm) = box(
  width: 100%, height: height, fill: lk.box-fill, stroke: 0.5pt + lk.frame.color, inset: 0.5mm,
  align(center + horizon, if c.icon == none { none } else { o2t-icon(c.icon, lk.icon) }))`;

/**
 * US-030 | AC-16a, AC-16b, AC-17 (#139): the wrap. `o2t-wrap(sb, blocks,
 * width)` measures the statblock `sb` at 55 % of `width` and fills the column
 * beside it (the rest less the gutter) with `blocks` — `(kind, body)` with
 * kind `par` (may be split), `heading` (sticky), `block` (whole) or
 * `entry` (a nested entry, never beside) — while the column stays no taller
 * than the statblock (a paragraph: than the statblock plus half a line,
 * AC-16c). The first paragraph that does not fit is split at the
 * most words that fit (binary search with `measure()`; atoms: top-level
 * children, `text` split at spaces, leading and trailing spaces dropped),
 * its column part ended by `linebreak(justify: par.justify)`, the rest set
 * with no first-line indent. A heading goes beside only when two lines of
 * the paragraph after it (or all of a shorter one, or the whole block after
 * it) fit too. Returns `(top, rest)`: the unbreakable statblock-and-column
 * block (`below: par.spacing`, or `par.leading` after a split) and the
 * full-width blocks. Records `<o2t-wrap>`.
 *
 * US-030 | AC-16c (#160): `pitch` (line height + leading) is measured in the
 * column; the split takes the most words that end within half a pitch below
 * the statblock's foot (the nearer line count). After a split the column's
 * leading changes by `(sh − hc) / gaps` — `gaps` the column's leading gaps,
 * measured as its growth at +1 mm leading, so headings, lists and paragraph
 * breaks do not count — when that is at most a tenth of `pitch`, so the
 * column ends at the foot; `fill` (mm) is recorded. Reads only `measure()` and the context (no query, locate or
 * state), so it settles in one compile (spike-entry-wrap.md). Must be called
 * in a context. `narrow`: US-034 AC-6's limits for the column.
 */
export const WRAP_HELPER_DEF = `#let o2t-atoms(c) = {
  let kids = if c.func() == [].func() { c.children } else { (c,) }
  let out = ()
  for k in kids {
    if k.func() == text and k.fields().keys() == ("text",) {
      for (i, w) in k.text.split(" ").enumerate() {
        if i > 0 { out.push((space: true, c: [ ])) }
        if w != "" { out.push((space: false, c: text(w))) }
      }
    } else if k == [ ] { out.push((space: true, c: k)) }
    else { out.push((space: false, c: k)) }
  }
  while out.len() > 0 and out.first().space { let _ = out.remove(0) }
  while out.len() > 0 and out.last().space { let _ = out.pop() }
  out
}
#let o2t-wrap(sb, blocks, width, narrow: none, band: "") = {
  let nar(c) = if narrow == none { c } else { set par(justification-limits: narrow); c }
  let sbw = width * ${L.width}
  let cw = width - sbw - ${L.gutter}
  let sh = measure(block(width: sbw, sb)).height
  let hcol(items) = if items.len() == 0 { 0pt } else { measure(block(width: cw, nar(items.join(parbreak())))).height }
  let hcol0(c) = measure(block(width: cw, nar(c))).height
  let pitch = hcol0([A \\ A]) - hcol0([A])
  let col = ()
  let rest = ()
  let split = none
  let beside = 0
  let i = 0
  while i < blocks.len() {
    let b = blocks.at(i)
    if b.kind == "entry" { break }
    if hcol((..col, b.body)) <= sh + if b.kind == "par" { pitch / 2 } else { 0pt } {
      if b.kind == "heading" and i + 1 < blocks.len() {
        let nb = blocks.at(i + 1)
        let need = if nb.kind == "par" and hcol((nb.body,)) > hcol(([A \\ A],)) { [A \\ A] } else { nb.body }
        if nb.kind == "entry" or hcol((..col, b.body, need)) > sh { break }
      }
      col.push(b.body); beside += 1; i += 1; continue
    }
    if b.kind == "par" {
      let atoms = o2t-atoms(b.body)
      let cuts = atoms.enumerate().filter(((j, a)) => a.space).map(((j, a)) => j)
      let words = cuts.len() + if atoms.len() > 0 { 1 } else { 0 }
      let first(n) = atoms.slice(0, if n < words { cuts.at(n - 1) } else { atoms.len() }).map(a => a.c).join() + linebreak(justify: par.justify)
      let lo = 0
      let hi = words - 1
      while lo < hi {
        let mid = calc.div-euclid(lo + hi + 1, 2)
        if hcol((..col, first(mid))) <= sh + pitch / 2 { lo = mid } else { hi = mid - 1 }
      }
      if lo > 0 {
        col.push(first(lo))
        let r = atoms.slice(cuts.at(lo - 1) + 1).map(a => a.c).join()
        rest.push({ set par(first-line-indent: 0pt); r })
        split = (block: i, words: lo, of: words)
        i += 1
      }
    }
    break
  }
  while i < blocks.len() { rest.push(blocks.at(i).body); i += 1 }
  let hc = hcol(col)
  let lead = par.leading.to-absolute()
  let gaps = if col.len() == 0 { 0 } else { (measure(block(width: cw, { set par(leading: lead + 1mm); nar(col.join(parbreak())) })).height - hc) / 1mm }
  let fill = if split != none and gaps > 0.5 { (sh - hc) / gaps } else { 0pt }
  let fill = if calc.abs(fill) <= pitch / 10 { fill } else { 0pt }
  let colc = if col.len() == 0 { [] } else { set par(leading: lead + fill); nar(col.join(parbreak())) }
  let top = block(breakable: false, width: 100%, below: if split == none { par.spacing } else { par.leading }, {
    context [#metadata((band: band, beside: beside, split: split, column: hc / 1mm, statblock: sh / 1mm, fill: fill / 1mm, page: here().page(), y: here().position().y / 1mm)) <o2t-wrap>]
    grid(columns: (1fr, sbw), column-gutter: ${L.gutter}, colc, sb)
  })
  (top: top, rest: rest)
}`;

/**
 * US-030 | AC-10 to AC-17: the statblock helpers. `o2t-sb-box(d)` draws the
 * framed statblock (the parts present, separated by rules) and records
 * `<o2t-statblock>`; `o2t-statblock(d, blocks: ())` places it in the flow
 * with the entry's body wrapped around it (`o2t-wrap`, #139) at the width
 * of the container. An entry of an entries chapter hands `d` to
 * `o2t-entries` instead (breaks.ts), which wraps it at the text width.
 */
export const STATBLOCK_HELPER_DEF = `#let o2t-sb-box(d) = {
  let lk = d.look
  let fonted(role, body) = {
    let f = lk.fonts.at(role, default: none)
    if f == none { body } else { text(font: f, body) }
  }
  let rule = line(length: 100%, stroke: lk.rules.width + lk.rules.color)
  let pieces = ()
  let parts = ("band",)
  pieces.push(align(center, fonted("band", text(size: lk.sizes.band, fill: lk.accent)[◆ #d.band ◆])))
  let count = 0
  let rows = 0
  if d.boxes != none {
    parts.push("boxes")
    count = d.boxes.count
    rows = calc.ceil(count / 15)
    let label-col = stack(spacing: 0.6mm,
      text(size: lk.sizes.label, fill: lk.accent, d.boxes.label),
      fonted("values", text(size: lk.sizes.value, fill: lk.accent, d.boxes.value)))
    let field = layout(size => o2t-box-rows(count, o2t-box-size(size.width), lk))
    pieces.push(grid(columns: (${L.labelColumn}, 1fr), column-gutter: 1mm, align: left + horizon, label-col, field))
  }
  if d.track != none {
    parts.push("track")
    let cells = d.track.cells.map(c => o2t-cell(c, lk))
    let head = if d.track.label == none { () } else { (text(size: lk.sizes.label, fill: lk.accent, d.track.label),) }
    pieces.push(stack(spacing: 0.6mm, ..head, grid(columns: (1fr,) * cells.len(), column-gutter: 0.8mm, ..cells)))
  }
  if d.attributes != none { parts.push("attributes"); pieces.push(align(center, fonted("values", text(size: lk.sizes.text, d.attributes)))) }
  if d.traits != none { parts.push("traits"); pieces.push(align(center, fonted("values", text(size: lk.sizes.text, d.traits)))) }
  if d.attacks.len() > 0 {
    parts.push("attacks")
    pieces.push(fonted("text", text(size: lk.sizes.attacks, stack(spacing: 0.8mm, ..d.attacks.map(a => grid(columns: (1fr, auto), column-gutter: 2mm,
      par(hanging-indent: 1em, a.at(0)), if a.at(1) == none { [] } else { a.at(1) }))))))
  }
  if d.skills != none { parts.push("skills"); pieces.push(fonted("skills", text(size: lk.sizes.skills)[#emph[Skills:]#h(0.3em)#d.skills])) }
  if d.tags != none { parts.push("tags"); pieces.push(align(center, fonted("tags", text(size: lk.sizes.text, fill: lk.accent, d.tags)))) }
  [#metadata((band: d.band, boxes: count, rows: rows, cells: if d.track == none { () } else { d.track.cells.map(c => c.label) }, parts: parts)) <o2t-statblock>]
  block(width: 100%, breakable: false, fill: lk.fill, stroke: lk.frame.width + lk.frame.color, inset: 2mm,
    stack(spacing: 1.2mm, ..pieces.intersperse(rule)))
}
// US-034 AC-6 (decision 2): the column beside the statblock (100 % less the
// statblock's ${L.width} and the gutter) is under ${NARROW_COLUMN_SHARE} % of the width.
#let o2t-statblock(d, blocks: ()) = layout(size => {
  let w = o2t-wrap(o2t-sb-box(d), blocks, size.width, narrow: d.look.at("narrow", default: none), band: d.band)
  w.top
  w.rest.join(parbreak())
})`;

const rgb = (hex: string): string => `rgb(${typstString(hex)})`;
const colourOr = (value: string): string =>
  value === 'none' ? 'none' : rgb(value);
const pt = (n: number): string => `${Number(n.toFixed(4))}pt`;

/** US-030 AC-15, US-035 AC-3: the resolved look of a statblock (one source for PDF and preview). */
export interface StatblockLookValues {
  /** `none` or `#rrggbb`. */
  fill: string;
  frame: {color: string; width: number};
  rules: {color: string; width: number};
  /** `none` or `#rrggbb`. */
  boxFill: string;
  /** Band, box label and value, tags (the frame colour). */
  accent: string;
  /** The colour the track icons are recoloured to. */
  icon: string;
  /** Font families by role, as the preset names them. */
  fonts: Record<string, string>;
  /** Sizes in pt by role. */
  sizes: Record<string, number>;
}

/**
 * US-030 | AC-15 (G0-C6, G0-C7), US-035 AC-3: the look: the preset's
 * `entries.statblock` over the built-ins (`STATBLOCK_BUILTINS`). In
 * grayscale there is no fill; frame, rules, band, box label and value, icons
 * and tags are `#4d4d4d`; boxes and cells white; values, attacks and skills
 * keep the text colour.
 */
export function statblockLookValues(
  settings: EntriesSettings | undefined,
  colorMode: ColorMode | undefined,
): StatblockLookValues {
  const sb = settings?.statblock ?? {};
  const B = STATBLOCK_BUILTINS;
  const gray = colorMode === 'grayscale';
  const frame = {
    color: gray ? L.gray : (sb.frame?.color ?? B.frame.color),
    width: sb.frame?.width ?? B.frame.width,
  };
  return {
    fill: gray ? 'none' : (sb.fill ?? B.fill),
    frame,
    rules: {
      color: gray ? L.gray : (sb.rules?.color ?? B.rules.color),
      width: sb.rules?.width ?? B.rules.width,
    },
    boxFill: gray ? '#ffffff' : (sb.boxFill ?? B.boxFill),
    accent: frame.color,
    icon: frame.color,
    fonts: {...sb.fonts},
    sizes: {...B.sizes, ...sb.sizes},
  };
}

/**
 * US-030 | AC-15: the look as a Typst dictionary (`statblockLookValues`),
 * with the justification limits of the column beside it (US-034 AC-6).
 */
export function statblockLook(
  settings: EntriesSettings | undefined,
  colorMode: ColorMode | undefined,
): string {
  const v = statblockLookValues(settings, colorMode);
  const fonts = Object.entries(v.fonts)
    .map(([role, family]) => `${role}: ${typstString(family)}`)
    .join(', ');
  return `(${[
    `fill: ${colourOr(v.fill)}`,
    `frame: (color: ${rgb(v.frame.color)}, width: ${pt(v.frame.width)})`,
    `rules: (color: ${rgb(v.rules.color)}, width: ${pt(v.rules.width)})`,
    `box-fill: ${colourOr(v.boxFill)}`,
    `accent: ${rgb(v.accent)}`,
    `icon: ${typstString(v.icon)}`,
    `fonts: (${fonts === '' ? ':' : fonts})`,
    `sizes: (${Object.entries(v.sizes)
      .map(([role, size]) => `${role}: ${pt(size)}`)
      .join(', ')})`,
    // US-034 AC-6: the limits of the column beside the statblock (#139).
    `narrow: ${narrowLimits(settings?.narrowJustification)}`,
  ].join(', ')})`;
}

/** Typst array text; one item keeps its trailing comma. */
const array = (items: readonly string[]): string =>
  items.length === 1 ? `(${items[0]},)` : `(${items.join(', ')})`;

/** Text as Typst markup inside `[…]` (labels, written by the preset). */
const label = (text: string): string =>
  `[${escapeMarkup(text, {atBlockStart: true})}]`;

/** How the call writes values and finds icons. */
export interface StatblockWriter {
  /** A value of the block as Typst markup (bold and italic typeset, escaped). */
  content: (value: string) => string;
  /** The Typst path of a track icon (a vault path), or null when it is missing. */
  icon: (path: string) => string | null;
}

/** US-030 AC-16a (#139): one block of an entry's body, as the wrap reads it. */
export interface WrapBlock {
  /** `par` may be split, `heading` is sticky, `block` whole, `entry` a nested entry. */
  kind: 'par' | 'heading' | 'block' | 'entry';
  /** The block's Typst. */
  body: string;
}

/**
 * US-030 | AC-16a (#139): the blocks as a Typst array of `(kind, body)`
 * dictionaries (a side channel to the wrap, not markers in the text,
 * SCAR-039); `()` for none, a trailing comma for one.
 */
export function wrapBlocks(blocks: readonly WrapBlock[]): string {
  return array(
    blocks.map((b) => `(kind: ${typstString(b.kind)}, body: [\n${b.body}\n])`),
  );
}

/**
 * US-030 | AC-10 to AC-16a, AC-22: `#o2t-statblock((…), blocks: (…))` for one
 * entry's model, the body wrapped around it in the flow (an entry outside
 * the chapters or nested, AC-16b). Values go through `writer.content`,
 * labels through the one escaping function; the order is the model's (the
 * preset's), so the same data gives the same text byte for byte.
 */
export function statblockCall(
  model: StatblockModel,
  look: string,
  writer: StatblockWriter,
  blocks: readonly WrapBlock[],
): string {
  const data = statblockData(model, look, writer);
  return blocks.length === 0
    ? `#${STATBLOCK_HELPER}(${data})`
    : `#${STATBLOCK_HELPER}(${data}, blocks: ${wrapBlocks(blocks)})`;
}

/**
 * US-030 | AC-10 to AC-15, AC-22: the statblock's data dictionary `(band: …,
 * look: …, …)` — what `o2t-sb-box` draws. An entry of an entries chapter
 * hands it to `o2t-entries` as `sb:` (AC-16a, #139).
 */
export function statblockData(
  model: StatblockModel,
  look: string,
  writer: StatblockWriter,
): string {
  const {content} = writer;
  const line = (
    values: readonly {label: string; value: string | null}[],
  ): string =>
    values.length === 0
      ? 'none'
      : `[${values
          .map(
            (v) =>
              `${escapeMarkup(v.label, {atBlockStart: false})} ${v.value === null ? '—' : content(v.value)}`,
          )
          .join(' · ')}]`;
  const boxes =
    model.boxLabel === null || model.boxValue === null
      ? 'none'
      : `(label: ${label(model.boxLabel)}, value: [${content(model.boxValue)}], count: ${model.boxes})`;
  const cells = model.cells.map((cell) => {
    const path = writer.icon(cell.icon);
    return `(label: ${typstString(cell.label)}, icon: ${path === null ? 'none' : typstString(path)})`;
  });
  const track =
    cells.length === 0
      ? 'none'
      : `(label: ${model.trackLabel === null ? 'none' : label(model.trackLabel)}, cells: ${array(cells)})`;
  const attacks = model.attacks.map(
    (a) =>
      `([${content(a.name)}], ${a.dice === '' ? 'none' : `[${content(a.dice)}]`})`,
  );
  const fields = [
    `band: ${typstString(model.band)}`,
    `look: ${look}`,
    `boxes: ${boxes}`,
    `track: ${track}`,
    `attributes: ${line(model.stats)}`,
    `traits: ${line(model.traitValues)}`,
    `attacks: ${attacks.length === 0 ? '()' : array(attacks)}`,
    `skills: ${model.skillItems.length === 0 ? 'none' : `[${model.skillItems.map(content).join(', ')}]`}`,
    `tags: ${model.tagLabels.length === 0 ? 'none' : `[${model.tagLabels.map((t) => escapeMarkup(t, {atBlockStart: false})).join(' · ')}]`}`,
  ];
  return `(${fields.join(', ')})`;
}
