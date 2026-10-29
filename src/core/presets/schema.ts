// US-008: the fields of a preset, the schema version and the built-in values.
// Pure core: no Obsidian, Node, or I/O imports.
import type {CoverMode} from '../cover/types';
import type {
  BookSettings,
  BreakLevel,
  BreakRule,
  ImagesSettings,
  TocSettings,
} from '../layout/page-setup';
import type {FontsPresetFields} from '../fonts/types';
import type {CalloutsSettings, HeadingRulesSettings} from '../markers';

/** The version of the preset note format that this plugin writes and reads. */
export const SCHEMA_VERSION = 1;

/** The page settings of a preset; every part is optional (US-009). */
export interface PagePresetFields {
  trimSize?: string;
  trimWidth?: number;
  trimHeight?: number;
  margins?: {
    top?: number;
    bottom?: number;
    inside?: number;
    outside?: number;
  };
  gutter?: number;
  bleed?: number;
  slug?: number;
  facingPages?: boolean;
  /** US-019 AC-1: page numbers on body pages. */
  folios?: boolean;
  /** US-019 AC-1: the chapter title at the top of body pages. */
  runningHeader?: boolean;
  /** US-019 AC-1: the heading level of the running header, 1 to 6. */
  runningHeaderLevel?: number;
  /** US-025 AC-1: the break rule per heading level; missing keys are unset. */
  breakBefore?: Partial<Record<BreakLevel, BreakRule>>;
}

/** US-011 AC-1: the cover settings of a preset note (never of the Defaults). */
export interface CoverPresetFields {
  mode?: CoverMode;
  file?: string;
  blankPageAfter?: boolean;
  cropWarningPercent?: number;
  /** True when `cover.back` is present and not null (AC-10). */
  back?: true;
}

/** US-026 AC-9: the book settings of a preset note or the Defaults. */
export type BookPresetFields = Partial<BookSettings>;

/**
 * US-027 AC-1: the contents settings of a preset note or the Defaults;
 * `heading` and `position` only in preset notes.
 */
export type TocPresetFields = Partial<TocSettings>;

/** US-028 AC-1: the image fit settings of a preset note or the Defaults. */
export type ImagesPresetFields = Partial<ImagesSettings>;

/**
 * The settings a preset note (or the Defaults) can hold. A field is *set* when
 * it is present; `null` in the note is read as not set.
 */
export interface PresetFields {
  highlightColor?: string;
  headingNumbering?: string;
  externalLinkFootnotes?: boolean;
  /** US-018 AC-1: the page of the target after an internal link. */
  linkPageNumbers?: boolean;
  /** US-018 AC-1: links to headings up to this level get the page, 1 to 6. */
  linkPageLevel?: number;
  /** US-018 AC-1: the word before the page number, e.g. `p.` or `S.`. */
  linkPageWord?: string;
  /** Vault path of a `.typ` template. */
  template?: string;
  page?: PagePresetFields;
  /** Preset notes only: the Defaults ignore it (US-011 AC-1). */
  cover?: CoverPresetFields;
  /** US-010 AC-1: preset notes and the Defaults. */
  fonts?: FontsPresetFields;
  /** US-016 AC-7: callout styles by name; preset notes only (AC-8). */
  callouts?: CalloutsSettings;
  /** US-017 AC-1: heading texts mapped to rules; preset notes only. */
  headingRules?: HeadingRulesSettings;
  /** US-021 AC-1: the group the lists show the preset in; preset notes only. */
  group?: string;
  /** US-026 AC-9: preset notes and the Defaults. */
  book?: BookPresetFields;
  /** US-027 AC-1: preset notes and the Defaults (heading, position: notes only). */
  toc?: TocPresetFields;
  /** US-028 AC-1: preset notes and the Defaults. */
  images?: ImagesPresetFields;
}

/** The names of the preset fields. Strict mode and the warnings folder are global. */
export const PRESET_FIELDS = [
  'highlightColor',
  'headingNumbering',
  'externalLinkFootnotes',
  'linkPageNumbers',
  'linkPageLevel',
  'linkPageWord',
  'template',
  'page',
  'cover',
  'fonts',
  'callouts',
  'headingRules',
  'group',
  'book',
  'toc',
  'images',
] as const;

/** The values used when neither the preset nor the Defaults set a field. */
export interface BuiltinDefaults {
  highlightColor: string;
  headingNumbering: string;
  externalLinkFootnotes: boolean;
  linkPageNumbers: boolean;
  linkPageLevel: number;
  linkPageWord: string;
  template: string | null;
  page: {
    trimSize: string;
    margins: {top: number; bottom: number; inside: number; outside: number};
    gutter: number;
    bleed: number;
    slug: number;
    facingPages: boolean;
    folios: boolean;
    runningHeader: boolean;
    runningHeaderLevel: number;
  };
}

/** US-008 AC-1: the built-in defaults (A5 print geometry with bleed 0). */
export const BUILTIN_DEFAULTS: Readonly<BuiltinDefaults> = {
  highlightColor: '#ffeb3b',
  headingNumbering: '1.1',
  externalLinkFootnotes: true,
  linkPageNumbers: true,
  linkPageLevel: 2,
  linkPageWord: 'p.',
  template: null,
  page: {
    trimSize: 'A5',
    margins: {top: 18, bottom: 22, inside: 15, outside: 15},
    gutter: 5,
    bleed: 0,
    slug: 0,
    facingPages: true,
    folios: true,
    runningHeader: true,
    runningHeaderLevel: 2,
  },
};
