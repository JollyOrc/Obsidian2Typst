// US-010 AC-1: the types of the font settings and the built-in values. Pure
// core: no Obsidian, Node, or I/O imports.

/** The roles that can have their own family and size (AC-1). */
export const FONT_ROLES = ['body', 'heading', 'caption', 'code'] as const;
export type FontRole = (typeof FONT_ROLES)[number];

/** The family that the bundled fonts give for the text (US-007 AC-13). */
export const BUNDLED_DEFAULT_FAMILY = 'Libertinus Serif';
/** The family that the bundled fonts give for code. */
export const BUNDLED_CODE_FAMILY = 'DejaVu Sans Mono';
/** The largest size of a role in pt (AC-1). */
export const MAX_FONT_SIZE = 200;

/** The settings of one role as written in a note: only what is set. */
export interface FontRoleFields {
  family?: string;
  /** In pt, greater than 0 and at most {@link MAX_FONT_SIZE}. */
  size?: number;
}

/** The `fonts` group of a preset note or of the Defaults: only what is set. */
export interface FontsPresetFields {
  /** Vault folder with `.ttf` and `.otf` files (AC-3). */
  folder?: string;
  default?: string;
  body?: FontRoleFields;
  heading?: FontRoleFields;
  caption?: FontRoleFields;
  code?: FontRoleFields;
}

/** The effective settings of one role; `null` is not set. */
export interface FontRoleSettings {
  family: string | null;
  size: number | null;
}

/** AC-1: the effective font settings: preset, else Defaults, else built-in. */
export interface FontsSettings {
  folder: string | null;
  default: string;
  body: FontRoleSettings;
  heading: FontRoleSettings;
  caption: FontRoleSettings;
  code: FontRoleSettings;
}

/** AC-1: the built-in values. */
export const DEFAULT_FONTS: Readonly<FontsSettings> = {
  folder: null,
  default: BUNDLED_DEFAULT_FAMILY,
  body: {family: null, size: 10},
  heading: {family: null, size: null},
  caption: {family: null, size: null},
  code: {family: BUNDLED_CODE_FAMILY, size: null},
};

/** One face of a font file as the compiler reports it (AC-3). */
export interface FaceInfo {
  family: string;
  /**
   * Alternating run lengths of code points that are not covered and covered,
   * starting with not covered.
   */
  coverage: number[];
}

/**
 * AC-1: the effective settings of a preset note and the Defaults over the
 * built-in values, field by field. The arguments are not changed.
 */
export function mergeFonts(
  preset: FontsPresetFields | undefined,
  defaults: FontsPresetFields | undefined,
): FontsSettings {
  const role = (name: FontRole): FontRoleSettings => {
    const base = DEFAULT_FONTS[name];
    return {
      family: preset?.[name]?.family ?? defaults?.[name]?.family ?? base.family,
      size: preset?.[name]?.size ?? defaults?.[name]?.size ?? base.size,
    };
  };
  return {
    folder: preset?.folder ?? defaults?.folder ?? DEFAULT_FONTS.folder,
    default: preset?.default ?? defaults?.default ?? DEFAULT_FONTS.default,
    body: role('body'),
    heading: role('heading'),
    caption: role('caption'),
    code: role('code'),
  };
}
