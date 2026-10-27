// US-005 AC-6: the marker of a task item. Pure: no Obsidian, Node, or I/O
// imports; the core never reads font files, it asks an injected `FontInfo`.
import type {EmitContext} from './context';

/** The default body family of Typst; used when no body font is set. */
export const DEFAULT_BODY_FAMILY = 'Libertinus Serif';

/** Answers whether a font family has a glyph (injected; US-010 AC-5, AC-7). */
export interface FontInfo {
  hasGlyph(family: string, codePoint: number): boolean;
}

const UNCHECKED = 0x2610; // ☐
const CHECKED = 0x2612; // ☒

/** Decides once per export whether the glyphs or the plain notation is used. */
export class TaskMarkers {
  private glyphs: boolean | undefined;

  constructor(
    private readonly ctx: EmitContext,
    private readonly fonts: FontInfo | undefined,
    private readonly family: string = DEFAULT_BODY_FAMILY,
  ) {}

  /** The text that starts a task item; `line` is the line of the item. */
  marker(checked: boolean, line: number): string {
    if (this.glyphs === undefined) this.glyphs = this.decide(line);
    if (this.glyphs) return String.fromCodePoint(checked ? CHECKED : UNCHECKED);
    return checked ? '\\[x\\]' : '\\[ \\]';
  }

  private decide(line: number): boolean {
    if (this.fonts === undefined) return false;
    const missing = [UNCHECKED, CHECKED].find(
      (code) => !(this.fonts as FontInfo).hasGlyph(this.family, code),
    );
    if (missing === undefined) return true;
    const hex = missing.toString(16).toUpperCase();
    this.ctx.warn(
      'FONT_GLYPH_MISSING',
      `Font "${this.family}" lacks U+${hex}; task lists use [ ] / [x]`,
      line,
    );
    return false;
  }
}
