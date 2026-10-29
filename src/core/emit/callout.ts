// US-016: the Typst of callouts. The only file that writes `#callout(` and
// `callout-styles` (SCAR-017; a text check in the US-016 tests). Pure: no
// Obsidian, Node, or I/O imports. Recognising a callout and resolving its style
// is core/markers; this file only writes text.
//
// Transforms used (shared-utility register): typstString for style names,
// families and icon paths; ptLength for numbers; colours lower-cased.
import {
  defaultCalloutTitle,
  resolveCalloutStyle,
  type CalloutStyle,
  type CalloutsSettings,
} from '../markers';
import {ptLength} from './length';
import {typstString} from './typst-string';

/**
 * US-016 AC-11: the helper the body calls. Measured with Typst 0.14.2: every
 * composed shape compiles; `breakable` lets the box cross pages (AC-14) and
 * `sticky` keeps the title with the first body line (sweep in the tests).
 */
export const CALLOUT_HELPER = [
  '#let callout(style, title: none, body) = {',
  '  let s = callout-styles.at(style)',
  '  let txt = (:)',
  '  if s.font != none { txt.insert("font", s.font) }',
  '  if s.size != none { txt.insert("size", s.size) }',
  '  block(width: 100%, breakable: true, fill: s.fill, stroke: s.stroke, inset: s.inset, {',
  '    set text(..txt)',
  '    if title != none {',
  '      block(sticky: true, below: 0.6em, text(fill: s.title-color, weight: "bold", {',
  '        if s.icon != none { box(image(s.icon, height: 1em), baseline: 0.15em); h(0.4em) }',
  '        title',
  '      }))',
  '    }',
  '    body',
  '  })',
  '}',
].join('\n');

/** What the emitter learns about one callout type (US-016 AC-3, AC-8, AC-10). */
export interface CalloutChoice {
  /** The style name to write (`default` for an unknown type). */
  name: string;
  /** False for a type without style or alias (warning of AC-10). */
  known: boolean;
  /** The plain-text title when the header has none ('' = no title line). */
  defaultTitle: string;
  /**
   * US-028 AC-6: the pt the box takes below its body: the style's inset plus
   * its border width (measured 2026-10-28, 2026-10-29).
   */
  reserve: number;
}

/** Resolves callout types for the emitter and remembers the styles it used. */
export interface CalloutRecorder {
  use(type: string, typed: string): CalloutChoice;
  /** The used styles by name, sorted by name (AC-11). */
  used(): ReadonlyMap<string, CalloutStyle>;
}

/**
 * US-016 | AC-8, AC-10, AC-11: A recorder over the preset's `callouts`.
 *
 * `use` resolves a type with `resolveCalloutStyle` and remembers the style
 * under its name; `used` lists them sorted by name (code-unit order), so the
 * dictionary does not depend on the order of the note. No warnings here: the
 * emitter reports unknown types at the header line.
 */
export function createCalloutRecorder(
  settings: CalloutsSettings = {},
): CalloutRecorder {
  const styles = new Map<string, CalloutStyle>();
  return {
    use(type, typed) {
      const {name, style, known} = resolveCalloutStyle(type, settings);
      styles.set(name, style);
      return {
        name,
        known,
        defaultTitle: defaultCalloutTitle(typed, style),
        reserve: style.inset + style.border.width,
      };
    },
    used() {
      return new Map(
        [...styles].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    },
  };
}

/**
 * US-016 | AC-2, AC-6: One callout call in the layout of a quote (US-001
 * AC-6b): the call on its own line, the body indented by 2, `]` alone.
 *
 * `title` is Typst markup already escaped by the caller, or null for
 * `title: none`; `body` is the rendered body already indented by the caller
 * (the block emitter's `indent`); '' gives an empty body `[⏎]`. The style
 * name goes through typstString.
 */
export function emitCallout(
  name: string,
  title: string | null,
  body: string,
): string {
  const head = `#callout(${typstString(name)}, title: ${
    title === null ? 'none' : `[${title}]`
  })[`;
  return body === '' ? `${head}\n]` : `${head}\n${body}\n]`;
}

/** A used style with the font and icon the pipeline resolved (AC-12, AC-13). */
export interface CalloutStyleEntry {
  name: string;
  style: CalloutStyle;
  /** The family as the font reports it, or null for the body font. */
  family: string | null;
  /** The icon's path below the export folder, or null for none. */
  icon: string | null;
}

const colour = (hex: string): string =>
  `rgb(${typstString(hex.toLowerCase())})`;

/**
 * US-016 | AC-11: The preamble rule `callouts`: the dictionary of the used
 * styles in the order given (the caller sorts by name) and the helper.
 *
 * Writes `fill: none` for no fill, `stroke: none` for border width 0, numbers
 * through ptLength, colours lower-cased in `rgb("…")`, family and icon path
 * through typstString. Returns null without entries (no callout, no rule).
 */
export function calloutStylesRule(
  entries: readonly CalloutStyleEntry[],
): string | null {
  if (entries.length === 0) return null;
  const lines = entries.map(({name, style, family, icon}) => {
    const fields = [
      `fill: ${style.fill === null ? 'none' : colour(style.fill)}`,
      `stroke: ${
        style.border.width === 0
          ? 'none'
          : `${ptLength(style.border.width)} + ${colour(style.border.color)}`
      }`,
      `inset: ${ptLength(style.inset)}`,
      `title-color: ${colour(style.title.color)}`,
      `font: ${family === null ? 'none' : typstString(family)}`,
      `size: ${style.font.size === null ? 'none' : ptLength(style.font.size)}`,
      `icon: ${icon === null ? 'none' : typstString(icon)}`,
    ];
    return `  ${typstString(name)}: (${fields.join(', ')}),`;
  });
  return ['#let callout-styles = (', ...lines, ')', CALLOUT_HELPER].join('\n');
}
