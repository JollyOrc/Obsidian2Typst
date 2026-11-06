// US-030 AC-10 to AC-17: the statblock in Typst — the helper the prelude
// defines, the look it is drawn with, and the call for one entry. Pure: no
// Obsidian, Node, or I/O imports. What is drawn comes from the shared model
// (`src/core/entries/model.ts`); the helper only draws it and records what it
// drew as `<o2t-statblock>` metadata (the test interface of US-030).
import type {StatblockModel} from '../entries/model';
import {
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
 * boxes, track, attributes, traits, attacks, skills, tags), `lede` the
 * opening paragraph (or the first block) set beside it. Draws the parts that
 * are present, separated by rules; 15 boxes per row in groups of 5, the box
 * size from the width; equal track cells with the SVG icon read, recoloured
 * (every fill and stroke but `none`) and drawn at 75 %; attacks with a 1 em
 * hanging indent; never split (`breakable: false`). Records
 * `(band, boxes, rows, cells, parts)` as `<o2t-statblock>`.
 */
export const STATBLOCK_HELPER_DEF = `#let o2t-statblock(d, lede: none) = {
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
    let field = layout(size => {
      let s = (size.width - 12 * ${L.boxGap} - 2 * ${L.groupGap}) / 15
      let one = box(width: s, height: s, fill: lk.box-fill, stroke: 0.5pt + lk.frame.color)
      let lines = range(rows).map(r => {
        let n = calc.min(15, count - r * 15)
        let row = ()
        for i in range(n) {
          row.push(one)
          if i < n - 1 { row.push(h(if calc.rem(i + 1, 5) == 0 { ${L.groupGap} } else { ${L.boxGap} })) }
        }
        row.join()
      })
      stack(spacing: ${L.boxGap}, ..lines)
    })
    pieces.push(grid(columns: (${L.labelColumn}, 1fr), column-gutter: 1mm, align: left + horizon, label-col, field))
  }
  if d.track != none {
    parts.push("track")
    let cells = d.track.cells.map(c => box(
      width: 100%, height: 6mm, fill: lk.box-fill, stroke: 0.5pt + lk.frame.color, inset: 0.5mm,
      align(center + horizon, if c.icon == none { none } else {
        let svg = read(c.icon).replace(regex("\\\\b(fill|stroke)=\\"([^\\"]*)\\""), m => if m.captures.at(1).trim() == "none" { m.text } else { m.captures.at(0) + "=\\"" + lk.icon + "\\"" })
        image(bytes(svg.replace(regex("<svg\\\\b"), "<svg opacity=\\"${L.iconOpacity}\\"", count: 1)), format: "svg", height: 100%)
      })))
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
  let sb = block(width: 100%, breakable: false, fill: lk.fill, stroke: lk.frame.width + lk.frame.color, inset: 2mm,
    stack(spacing: 1.2mm, ..pieces.intersperse(rule)))
  [#metadata((band: d.band, boxes: count, rows: rows, cells: if d.track == none { () } else { d.track.cells.map(c => c.label) }, parts: parts)) <o2t-statblock>]
  block(breakable: false, width: 100%, grid(columns: (1fr, ${L.width}), column-gutter: ${L.gutter}, if lede == none { [] } else { lede }, sb))
}`;

const rgb = (hex: string): string => `rgb(${typstString(hex)})`;
const colourOr = (value: string): string =>
  value === 'none' ? 'none' : rgb(value);
const pt = (n: number): string => `${Number(n.toFixed(4))}pt`;

/**
 * US-030 | AC-15 (G0-C6, G0-C7): the look as a Typst dictionary: the
 * preset's `entries.statblock` over the built-ins (`STATBLOCK_BUILTINS`). In
 * grayscale there is no fill; frame, rules, band, box label and value, icons
 * and tags are `#4d4d4d`; boxes and cells white; values, attacks and skills
 * keep the text colour.
 */
export function statblockLook(
  settings: EntriesSettings | undefined,
  colorMode: ColorMode | undefined,
): string {
  const sb = settings?.statblock ?? {};
  const B = STATBLOCK_BUILTINS;
  const gray = colorMode === 'grayscale';
  const frame = {
    color: gray ? L.gray : (sb.frame?.color ?? B.frame.color),
    width: sb.frame?.width ?? B.frame.width,
  };
  const rules = {
    color: gray ? L.gray : (sb.rules?.color ?? B.rules.color),
    width: sb.rules?.width ?? B.rules.width,
  };
  const fill = gray ? 'none' : (sb.fill ?? B.fill);
  const boxFill = gray ? '#ffffff' : (sb.boxFill ?? B.boxFill);
  const sizes = {...B.sizes, ...sb.sizes};
  const fonts = Object.entries(sb.fonts ?? {})
    .map(([role, family]) => `${role}: ${typstString(family)}`)
    .join(', ');
  return `(${[
    `fill: ${colourOr(fill)}`,
    `frame: (color: ${rgb(frame.color)}, width: ${pt(frame.width)})`,
    `rules: (color: ${rgb(rules.color)}, width: ${pt(rules.width)})`,
    `box-fill: ${colourOr(boxFill)}`,
    `accent: ${rgb(frame.color)}`,
    `icon: ${typstString(frame.color)}`,
    `fonts: (${fonts === '' ? ':' : fonts})`,
    `sizes: (${Object.entries(sizes)
      .map(([role, size]) => `${role}: ${pt(size)}`)
      .join(', ')})`,
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

/**
 * US-030 | AC-10 to AC-16, AC-22: `#o2t-statblock((…), lede: […])` for one
 * entry's model. Values go through `writer.content`, labels through the one
 * escaping function; the order is the model's (the preset's), so the same
 * data gives the same text byte for byte. `lede` is the Typst of the block
 * set beside the statblock, or null.
 */
export function statblockCall(
  model: StatblockModel,
  look: string,
  writer: StatblockWriter,
  lede: string | null,
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
  const leded = lede === null ? '' : `, lede: [\n${lede}\n]`;
  return `#${STATBLOCK_HELPER}((${fields.join(', ')})${leded})`;
}
