// US-038 AC-6 to AC-9: the detail row in Typst — the helpers the prelude
// defines, the look it is drawn with, and the call for one heading. Pure: no
// Obsidian, Node, or I/O imports. What is drawn comes from the shared model
// (`src/core/details/model.ts`); the helper only draws it and records the row
// as `<o2t-details>` metadata (the test interface of US-038).
import type {DetailsModel} from '../details/model';
import {
  DETAILS_BUILTINS,
  type ColorMode,
  type DetailsSettings,
} from '../markers';
import {escapeMarkup} from './escape-markup';
import {typstString} from './typst-string';

/** US-038 AC-16: the Typst names of the row helper and its icon helper (plugin names). */
export const DETAILS_HELPER = 'o2t-details';
export const DETAILS_ICON_HELPER = 'o2t-detail-icon';

/** US-038 AC-6: the resolved look of the row (one source for PDF and preview). */
export interface DetailsLookValues {
  /** `#rrggbb`: the text and the icons. */
  color: string;
  /** pt. */
  size: number;
}

/**
 * US-038 | AC-6: the look: the preset's `details` over the built-ins
 * (`DETAILS_BUILTINS`: `#7a4a2e`, 9.5 pt). In grayscale the colour is
 * `#4d4d4d` whatever the preset says (text and icons alike).
 */
export function detailsLookValues(
  settings: DetailsSettings | undefined,
  colorMode: ColorMode | undefined,
): DetailsLookValues {
  const B = DETAILS_BUILTINS;
  return {
    color: colorMode === 'grayscale' ? B.gray : (settings?.color ?? B.color),
    size: settings?.size ?? B.size,
  };
}

/**
 * US-038 | AC-6 to AC-8, AC-10: the helpers. `o2t-detail-icon` draws an SVG
 * file recoloured (every fill and stroke but `none`) as a 0.95 em box raised
 * 0.15 em. `o2t-details(d)` draws one row: `d.items` as `(icon, body)`, the
 * icon followed by a non-breaking space (measured: a plain space or a gap
 * lets the icon part from its word, a non-breaking space never does),
 * joined by a 1.1 em gap; one paragraph, not justified, in `d.color` at
 * `d.size`; a block with 0.45 em below and nothing above, `sticky` so that
 * the heading, the row and the text after it stay together. Records
 * `(page, badges)` as `<o2t-details>`.
 */
export const DETAILS_HELPER_DEF = `#let ${DETAILS_ICON_HELPER}(path, colour) = box(baseline: 0.15em, image(bytes(read(path).replace(regex("\\\\b(fill|stroke)=\\"([^\\"]*)\\""), m => if m.captures.at(1).trim() == "none" { m.text } else { m.captures.at(0) + "=\\"" + colour + "\\"" })), format: "svg", width: 0.95em, height: 0.95em))
#let ${DETAILS_HELPER}(d) = block(above: 0pt, below: 0.45em, sticky: true, {
  set par(justify: false)
  set text(size: d.size, fill: d.color)
  context [#metadata((page: here().page(), badges: d.items.len())) <o2t-details>]
  d.items.map(it => { if it.icon != none { ${DETAILS_ICON_HELPER}(it.icon, d.color.to-hex()); [~] }; it.body }).join(h(1.1em))
})`;

const rgb = (hex: string): string => `rgb(${typstString(hex)})`;
const pt = (n: number): string => `${Number(n.toFixed(4))}pt`;

/** How the call writes values and finds icons. */
export interface DetailsWriter {
  /** A value of the block as Typst markup (typeset, links kept, escaped). */
  content: (value: string) => string;
  /** The Typst path of an icon (a vault path), or null when it is missing. */
  icon: (path: string) => string | null;
}

/**
 * US-038 | AC-7: `#o2t-details((color: …, size: …, items: ((icon: …, body:
 * […]), …)))` for one row's model, or null when it has no badge to draw (no
 * badge at all, or only badges without icon and text). Labels go through the
 * one escaping function, values through `writer.content`; the order is the
 * model's (the preset's), so the same data gives the same text byte for byte.
 */
export function detailsCall(
  model: DetailsModel,
  look: DetailsLookValues,
  writer: DetailsWriter,
): string | null {
  const items: string[] = [];
  for (const badge of model.badges) {
    const body =
      badge.label !== null
        ? escapeMarkup(badge.label, {atBlockStart: true})
        : badge.value !== null
          ? writer.content(badge.value)
          : '';
    const path = badge.icon === null ? null : writer.icon(badge.icon);
    if (path === null && body === '') continue;
    items.push(
      `(icon: ${path === null ? 'none' : typstString(path)}, body: [${body}])`,
    );
  }
  if (items.length === 0) return null;
  const list = items.length === 1 ? `(${items[0]},)` : `(${items.join(', ')})`;
  return `#${DETAILS_HELPER}((color: ${rgb(look.color)}, size: ${pt(look.size)}, items: ${list}))`;
}
