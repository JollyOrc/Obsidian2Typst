// US-009: page geometry, validation, and the `#set page(...)` line.
// Pure core: no Obsidian or I/O imports. All lengths are millimetres.

export interface Margins {
  top: number;
  bottom: number;
  inside: number;
  outside: number;
}

/** Page settings as read from a preset (already merged with Defaults). */
export interface PageSettingsInput {
  trimSize?: string;
  trimWidth?: number;
  trimHeight?: number;
  margins: Margins;
  /** Added to the inside margin on facing pages only. Default 0. */
  gutter?: number;
  /** Added on all four sides. Default 0. */
  bleed?: number;
  /** Extra area outside the bleed for crop marks. Default 0. */
  slug?: number;
  facingPages: boolean;
}

/**
 * US-019 AC-1, AC-3: what is printed around the text of a body page: the
 * page numbers (folios) and the running header with the chapter title of
 * level `runningHeaderLevel` (1 to 6). Not part of the geometry.
 */
/**
 * US-025 | AC-1: where a top-level heading of a level starts: as it falls
 * (`none`), on a new page, on the next right-hand (odd) page, or on the next
 * left-hand (even) page, which starts a new spread.
 */
export type BreakRule = 'none' | 'page' | 'right' | 'left';

/** US-025 AC-1: the keys of `page.breakBefore`, one per heading level. */
export const BREAK_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
export type BreakLevel = (typeof BREAK_LEVELS)[number];

/** US-025 AC-1: the values a rule may take, in the order the rows offer them. */
export const BREAK_RULES: readonly BreakRule[] = [
  'none',
  'page',
  'right',
  'left',
];

/** US-025 AC-1: a rule for every level (the effective settings). */
export type BreakRules = Readonly<Record<BreakLevel, BreakRule>>;

/** US-025 AC-1: no level breaks (the built-in value). */
export const NO_BREAKS: BreakRules = Object.freeze({
  h1: 'none',
  h2: 'none',
  h3: 'none',
  h4: 'none',
  h5: 'none',
  h6: 'none',
});

/**
 * US-026 | AC-2, AC-3 to AC-7, AC-9: the book settings. `signature` is the
 * pages per signature (0 = no padding); the headings of the colophon and the
 * back notes are `hidden` (not written, the label kept) or `printed`.
 */
export interface BookSettings {
  signature: 0 | 4 | 8 | 16 | 32;
  romanFrontMatter: boolean;
  firstChapter: 'left' | 'right';
  colophonHeading: 'hidden' | 'printed';
  backNotesHeading: 'hidden' | 'printed';
}

/** US-026 AC-9: the built-in book settings (nothing changes today's output). */
export const DEFAULT_BOOK: BookSettings = Object.freeze({
  signature: 0,
  romanFrontMatter: false,
  firstChapter: 'left',
  colophonHeading: 'hidden',
  backNotesHeading: 'hidden',
});

/**
 * US-027 | AC-1: the table of contents settings. `depth` 0 writes no contents;
 * an empty `title` writes no title line. `heading` and `position` (the place
 * picked with the menu items, AC-7) exist only when a preset note sets them.
 */
export interface TocSettings {
  depth: number;
  title: string;
  pageNumbers: boolean;
  dotLeaders: boolean;
  heading?: string;
  position?: 'before' | 'after';
}

/** US-027 AC-1: the built-in contents settings (no contents: today's output). */
export const DEFAULT_TOC: Readonly<
  Pick<TocSettings, 'depth' | 'title' | 'pageNumbers' | 'dotLeaders'>
> = Object.freeze({
  depth: 0,
  title: 'Contents',
  pageNumbers: true,
  dotLeaders: true,
});

/**
 * US-028 | AC-1: the image fit settings. `minScale` is the smallest size an
 * image may shrink to, in percent of the size it would otherwise get (10 to
 * 100); 100 turns the rule off (decision 1).
 */
export interface ImagesSettings {
  minScale: number;
}

/** US-028 AC-1: the built-in image fit settings (100: today's output). */
export const DEFAULT_IMAGES: Readonly<ImagesSettings> = Object.freeze({
  minScale: 100,
});

export interface PageFurniture {
  folios: boolean;
  runningHeader: boolean;
  runningHeaderLevel: number;
}

/** Final page size and margins including bleed and slug. */
export interface PageGeometry {
  pageWidth: number;
  pageHeight: number;
  facingPages: boolean;
  /** The slug in mm (US-009 AC-9); the cover keeps it empty (AC-11). 0 without. */
  slug: number;
  /** For single pages `inside` is the left and `outside` the right margin. */
  margins: Margins;
}

export interface PageSetupError {
  field: string;
  message: string;
}

export type PageSetupResult =
  {ok: true; value: PageGeometry} | {ok: false; errors: PageSetupError[]};

export const NAMED_SIZES: Readonly<
  Record<string, {width: number; height: number}>
> = {
  A4: {width: 210, height: 297},
  A5: {width: 148, height: 210},
  A6: {width: 105, height: 148},
  'US Letter': {width: 215.9, height: 279.4},
};

export const BUILTIN_PAGE_PRESETS: Readonly<
  Record<'A5 print' | 'A4 digital', PageSettingsInput>
> = {
  'A5 print': {
    trimSize: 'A5',
    margins: {top: 18, bottom: 22, inside: 15, outside: 15},
    gutter: 5,
    bleed: 3,
    slug: 0,
    facingPages: true,
  },
  'A4 digital': {
    trimSize: 'A4',
    margins: {top: 20, bottom: 20, inside: 20, outside: 20},
    gutter: 0,
    bleed: 0,
    slug: 0,
    facingPages: false,
  },
};

const MIN_TRIM_MM = 50;
const MIN_TEXT_BLOCK_MM = 30;

/** Rounds half up to 2 decimals. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** `18.5` -> `18.5mm`, `18` -> `18mm`, `18.456` -> `18.46mm` (US-009 AC-7). */
export function formatMm(n: number): string {
  return `${round2(n)}mm`;
}

function isLength(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

const TRIM_MISSING: PageSetupError = {
  field: 'trimSize',
  message: 'Trim size missing (set trimSize, or both trimWidth and trimHeight)',
};

export function resolvePageSetup(input: PageSettingsInput): PageSetupResult {
  const hasWidth = input.trimWidth !== undefined;
  const hasHeight = input.trimHeight !== undefined;

  // AC-10: trim size must be resolvable.
  let width: number;
  let height: number;
  if (hasWidth && hasHeight) {
    width = input.trimWidth as number;
    height = input.trimHeight as number;
  } else if (hasWidth || hasHeight || input.trimSize === undefined) {
    return {ok: false, errors: [TRIM_MISSING]};
  } else {
    const named = Object.hasOwn(NAMED_SIZES, input.trimSize)
      ? NAMED_SIZES[input.trimSize]
      : undefined;
    if (!named) {
      return {
        ok: false,
        errors: [
          {
            field: 'trimSize',
            message: `Unknown trim size "${input.trimSize}" (use A4, A5, A6, US Letter, or trimWidth and trimHeight)`,
          },
        ],
      };
    }
    width = named.width;
    height = named.height;
  }

  const gutter = input.gutter ?? 0;
  const bleed = input.bleed ?? 0;
  const slug = input.slug ?? 0;
  const m = input.margins;

  // AC-2: numbers and minimum trim.
  const errors: PageSetupError[] = [];
  const checks: [string, number][] = [
    ['margins.top', m.top],
    ['margins.bottom', m.bottom],
    ['margins.inside', m.inside],
    ['margins.outside', m.outside],
    ['gutter', gutter],
    ['bleed', bleed],
    ['slug', slug],
  ];
  for (const [field, value] of checks) {
    if (!isLength(value))
      errors.push({field, message: `${field} must be a number of at least 0`});
  }
  if (!(width >= MIN_TRIM_MM))
    errors.push({
      field: 'trimWidth',
      message: `trimWidth must be at least ${MIN_TRIM_MM} mm`,
    });
  if (!(height >= MIN_TRIM_MM))
    errors.push({
      field: 'trimHeight',
      message: `trimHeight must be at least ${MIN_TRIM_MM} mm`,
    });
  if (errors.length > 0) return {ok: false, errors};

  const textWidth =
    width - m.inside - m.outside - (input.facingPages ? gutter : 0);
  const textHeight = height - m.top - m.bottom;
  if (textWidth < MIN_TEXT_BLOCK_MM) {
    errors.push({
      field: 'margins',
      message: `Text block would be only ${round2(textWidth)} mm wide (minimum ${MIN_TEXT_BLOCK_MM} mm)`,
    });
  }
  if (textHeight < MIN_TEXT_BLOCK_MM) {
    errors.push({
      field: 'margins',
      message: `Text block would be only ${round2(textHeight)} mm high (minimum ${MIN_TEXT_BLOCK_MM} mm)`,
    });
  }
  if (errors.length > 0) return {ok: false, errors};

  // AC-3, AC-4, AC-9: bleed and slug on all four sides; gutter on facing pages only.
  const edge = bleed + slug;
  return {
    ok: true,
    value: {
      pageWidth: width + 2 * edge,
      pageHeight: height + 2 * edge,
      facingPages: input.facingPages,
      slug,
      margins: {
        top: m.top + edge,
        bottom: m.bottom + edge,
        inside: m.inside + (input.facingPages ? gutter : 0) + edge,
        outside: m.outside + edge,
      },
    },
  };
}

export function emitPageSetup(g: PageGeometry): string {
  const m = g.margins;
  const sides = g.facingPages
    ? `top: ${formatMm(m.top)}, bottom: ${formatMm(m.bottom)}, inside: ${formatMm(m.inside)}, outside: ${formatMm(m.outside)}`
    : `top: ${formatMm(m.top)}, bottom: ${formatMm(m.bottom)}, left: ${formatMm(m.inside)}, right: ${formatMm(m.outside)}`;
  return `#set page(width: ${formatMm(g.pageWidth)}, height: ${formatMm(g.pageHeight)}, margin: (${sides}))`;
}
