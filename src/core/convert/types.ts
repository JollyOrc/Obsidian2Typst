// US-015: the types of the conversion pipeline. Pure: no Obsidian, Node, or I/O
// imports.
import type {AssetUse} from '../assets';
import type {CoverSettings} from '../cover';
import type {FontInfo, Warning} from '../emit';
import type {FontsSettings} from '../fonts/types';
import type {PageFurniture, PageGeometry} from '../layout/page-setup';
import type {CalloutsSettings, HeadingRulesSettings} from '../markers';

/**
 * US-015 AC-13: the vault as the pipeline sees it. The plugin implements it
 * over the Obsidian vault; the core never reads a file itself.
 */
export interface AssetIndex {
  /** Every file of the vault by path (any type). */
  readonly files: readonly string[];
  /**
   * The first bytes of one file, `length` of them (default 16, the least that
   * is needed); may reject. A file shorter than `length` gives all it has.
   */
  readHead(path: string, length?: number): Promise<Uint8Array>;
}

/** US-015 AC-3: what the pipeline needs from the settings. */
export interface ConvertSettings {
  /** The resolved page geometry (US-009). Required. */
  page: PageGeometry;
  /** `#rrggbb`; default `#ffeb3b`. */
  highlightColor?: string;
  /** A Typst numbering pattern or `none`; default `1.1`. */
  headingNumbering?: string;
  /** Default true (US-004 AC-1c). */
  externalLinkFootnotes?: boolean;
  /**
   * US-018 AC-1, AC-6: page numbers after internal links; missing means off
   * (older callers and tests are unchanged). Level 1 to 6; the word as typed.
   */
  linkPageNumbers?: boolean;
  linkPageLevel?: number;
  linkPageWord?: string;
  /** True when a template file is copied next to the `.typ`; default false. */
  template?: boolean;
  /**
   * US-023 AC-1: true when that template defines `template` (the plugin reads
   * it with `definesTemplateHook`); ignored without `template`. Default false.
   */
  templateHook?: boolean;
  /** US-011: the cover settings; missing means no cover (mode `none`). */
  cover?: CoverSettings;
  /** US-010: the font settings; missing means no font rule (older callers). */
  fonts?: FontsSettings;
  /** US-016 AC-7, AC-8: callout styles of the preset; missing means `{}`. */
  callouts?: CalloutsSettings;
  /**
   * US-017 AC-1: heading rules of the preset; missing means `{}`. The
   * built-in mapping is added by `convert`.
   */
  headingRules?: HeadingRulesSettings;
  /**
   * US-019 AC-1, AC-8: folios and running header; missing means both off
   * (older callers and tests are unchanged).
   */
  pageFurniture?: PageFurniture;
}

/** US-015 AC-1: the input of {@link convert}. */
export interface ConvertInput {
  /** The text of the note, frontmatter included. */
  source: string;
  /** The name of the note without extension. */
  noteName: string;
  /** Vault path of the note. */
  notePath: string;
  settings: ConvertSettings;
  assets: AssetIndex;
  /**
   * Answers whether a font has a glyph (US-005 AC-6); optional. A catalog
   * (US-010) also gives the names of the families (`resolve`).
   */
  fonts?: FontInfo & {resolve?: (name: string) => string | null};
}

/** US-015 AC-8: one line of the `.typ` and the source line it comes from. */
export interface LineMapEntry {
  /** 1-based line of the `.typ`. */
  typLine: number;
  /** 1-based line of the source note, frontmatter counted. */
  sourceLine: number;
}

/** US-015 AC-1: the result of {@link convert}. */
export interface ConvertResult {
  typ: string;
  assets: AssetUse[];
  warnings: Warning[];
  lineMap: LineMapEntry[];
}
