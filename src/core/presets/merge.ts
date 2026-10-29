// US-008 AC-1, AC-12, AC-14: preset, Defaults and built-ins become the input of
// `convert`. Pure core: no Obsidian, Node, or I/O imports.
import {DEFAULT_COVER, type CoverSettings} from '../cover/types';
import {mergeFonts, type FontsSettings} from '../fonts/types';
import type {CalloutsSettings, HeadingRulesSettings} from '../markers';
import {
  BREAK_LEVELS,
  DEFAULT_BOOK,
  DEFAULT_IMAGES,
  DEFAULT_TOC,
  NO_BREAKS,
  resolvePageSetup,
  type BookSettings,
  type BreakRules,
  type ImagesSettings,
  type PageFurniture,
  type PageGeometry,
  type PageSettingsInput,
  type TocSettings,
} from '../layout/page-setup';
import type {PresetError} from './parse';
import {
  BUILTIN_DEFAULTS,
  type PagePresetFields,
  type PresetFields,
} from './schema';

/** Every field with a value: the preset's, else the Defaults', else built-in. */
export interface ResolvedFields {
  highlightColor: string;
  headingNumbering: string;
  externalLinkFootnotes: boolean;
  /** US-018 AC-1: page numbers after internal links, field by field. */
  linkPageNumbers: boolean;
  linkPageLevel: number;
  linkPageWord: string;
  template: string | null;
  page: PageSettingsInput;
  /** US-019 AC-1: the page furniture, field by field. */
  pageFurniture: PageFurniture;
  /** US-025 AC-1: the break rules, level by level. */
  breakBefore: BreakRules;
  /** US-026 AC-9: the book settings, field by field. */
  book: BookSettings;
  /** US-027 AC-1: the contents settings, field by field; the place from the preset. */
  toc: TocSettings;
  /** US-028 AC-1: the image fit settings, field by field. */
  images: ImagesSettings;
}

/** US-019 AC-1: the furniture keys of `page`; never part of the geometry. */
const FURNITURE_KEYS = [
  'folios',
  'runningHeader',
  'runningHeaderLevel',
  // US-025 AC-1: the break rules are no geometry either.
  'breakBefore',
] as const;

/** Copies the set values of `layer` over `target` (undefined is not set; null never gets here, the parser drops it). */
function overlayPage(
  target: PageSettingsInput,
  layer: PagePresetFields | undefined,
): void {
  if (layer === undefined) return;
  // US-009 AC-14: the trim size is one group; a layer that sets any part of it
  // replaces all of it (a preset keeps its own size, whatever the Defaults hold).
  if (
    layer.trimSize !== undefined ||
    layer.trimWidth !== undefined ||
    layer.trimHeight !== undefined
  ) {
    delete target.trimSize;
    delete target.trimWidth;
    delete target.trimHeight;
  }
  const {margins, ...rest} = layer;
  for (const [key, value] of Object.entries(rest)) {
    // US-019: the furniture is resolved on its own (resolveFields).
    if ((FURNITURE_KEYS as readonly string[]).includes(key)) continue;
    if (value !== undefined) {
      (target as unknown as Record<string, unknown>)[key] = value;
    }
  }
  if (margins !== undefined) {
    for (const [side, value] of Object.entries(margins)) {
      if (value !== undefined) {
        (target.margins as unknown as Record<string, number>)[side] = value;
      }
    }
  }
}

/**
 * US-008 AC-1: effective value = preset value if set, else Defaults value if
 * set, else built-in. Nested page settings merge field by field. The
 * arguments are not changed.
 */
export function resolveFields(
  preset: PresetFields,
  defaults: PresetFields,
): ResolvedFields {
  const pick = <
    K extends
      | 'highlightColor'
      | 'headingNumbering'
      | 'externalLinkFootnotes'
      | 'linkPageNumbers'
      | 'linkPageLevel'
      | 'linkPageWord'
      | 'template',
  >(
    key: K,
  ): NonNullable<PresetFields[K]> | (typeof BUILTIN_DEFAULTS)[K] =>
    (preset[key] ?? defaults[key] ?? BUILTIN_DEFAULTS[key]) as NonNullable<
      PresetFields[K]
    >;
  const {folios, runningHeader, runningHeaderLevel, ...geometry} =
    BUILTIN_DEFAULTS.page;
  const page: PageSettingsInput = {
    ...geometry,
    margins: {...BUILTIN_DEFAULTS.page.margins},
  };
  // US-019 AC-1: preset, else Defaults, else built-in, field by field.
  const pageFurniture: PageFurniture = {
    folios: preset.page?.folios ?? defaults.page?.folios ?? folios,
    runningHeader:
      preset.page?.runningHeader ??
      defaults.page?.runningHeader ??
      runningHeader,
    runningHeaderLevel:
      preset.page?.runningHeaderLevel ??
      defaults.page?.runningHeaderLevel ??
      runningHeaderLevel,
  };
  // US-025 AC-1: preset, else Defaults, else none, level by level.
  const breakBefore = Object.fromEntries(
    BREAK_LEVELS.map((level) => [
      level,
      preset.page?.breakBefore?.[level] ??
        defaults.page?.breakBefore?.[level] ??
        NO_BREAKS[level],
    ]),
  ) as unknown as BreakRules;
  // US-026 AC-9: preset, else Defaults, else built-in, field by field.
  const book = Object.fromEntries(
    (Object.keys(DEFAULT_BOOK) as (keyof BookSettings)[]).map((key) => [
      key,
      preset.book?.[key] ?? defaults.book?.[key] ?? DEFAULT_BOOK[key],
    ]),
  ) as unknown as BookSettings;
  // US-027 AC-1: preset, else Defaults, else built-in, field by field; the
  // place (heading, position) from the preset note only.
  const toc: TocSettings = {
    ...(Object.fromEntries(
      (Object.keys(DEFAULT_TOC) as (keyof typeof DEFAULT_TOC)[]).map((key) => [
        key,
        preset.toc?.[key] ?? defaults.toc?.[key] ?? DEFAULT_TOC[key],
      ]),
    ) as unknown as typeof DEFAULT_TOC),
    ...(preset.toc?.heading === undefined ? {} : {heading: preset.toc.heading}),
    ...(preset.toc?.position === undefined
      ? {}
      : {position: preset.toc.position}),
  };
  // US-028 AC-1: preset, else Defaults, else built-in, field by field.
  const images = Object.fromEntries(
    (Object.keys(DEFAULT_IMAGES) as (keyof ImagesSettings)[]).map((key) => [
      key,
      preset.images?.[key] ?? defaults.images?.[key] ?? DEFAULT_IMAGES[key],
    ]),
  ) as unknown as ImagesSettings;
  overlayPage(page, defaults.page);
  overlayPage(page, preset.page);
  return {
    highlightColor: pick('highlightColor') as string,
    headingNumbering: pick('headingNumbering') as string,
    externalLinkFootnotes: pick('externalLinkFootnotes') as boolean,
    linkPageNumbers: pick('linkPageNumbers') as boolean,
    linkPageLevel: pick('linkPageLevel') as number,
    linkPageWord: pick('linkPageWord') as string,
    template: pick('template') as string | null,
    page,
    pageFurniture,
    breakBefore,
    book,
    toc,
    images,
  };
}

/** US-011 AC-1: the preset's cover settings over the built-in ones. */
function resolveCover(fields: PresetFields['cover']): CoverSettings {
  const cover = {...DEFAULT_COVER};
  if (fields === undefined) return cover;
  if (fields.mode !== undefined) cover.mode = fields.mode;
  if (fields.file !== undefined && fields.file !== '') cover.file = fields.file;
  if (fields.blankPageAfter !== undefined) {
    cover.blankPageAfter = fields.blankPageAfter;
  }
  if (fields.cropWarningPercent !== undefined) {
    cover.cropWarningPercent = fields.cropWarningPercent;
  }
  if (fields.back === true) cover.back = true;
  return cover;
}

/** US-008 AC-14: the settings that `convert` takes (US-015 AC-3). */
export interface EffectiveSettings {
  page: PageGeometry;
  /** US-019 AC-1: preset, else Defaults, else built-in, field by field. */
  pageFurniture: PageFurniture;
  /** US-025 AC-1: preset, else Defaults, else `none`, level by level. */
  breakBefore: BreakRules;
  /** US-026 AC-9: preset, else Defaults, else built-in, field by field. */
  book: BookSettings;
  /** US-027 AC-1: preset, else Defaults, else built-in; the place from the preset. */
  toc: TocSettings;
  /** US-028 AC-1: preset, else Defaults, else built-in (100: the rule off). */
  images: ImagesSettings;
  highlightColor: string;
  headingNumbering: string;
  externalLinkFootnotes: boolean;
  /** US-018 AC-1: preset, else Defaults, else built-in, field by field. */
  linkPageNumbers: boolean;
  linkPageLevel: number;
  linkPageWord: string;
  /** True only when the template file exists (AC-11). */
  template: boolean;
  /** US-011 AC-1: from the preset note only; the Defaults have no cover. */
  cover: CoverSettings;
  /** US-010 AC-1: preset, else Defaults, else built-in, per field. */
  fonts: FontsSettings;
  /** US-016 AC-8: from the preset note only; the Defaults have no callouts. */
  callouts: CalloutsSettings;
  /** US-017 AC-1: from the preset note only; the Defaults have none. */
  headingRules: HeadingRulesSettings;
}

export type EffectiveResult =
  | {
      ok: true;
      settings: EffectiveSettings;
      /** The selected template and whether it exists; null when none is set. */
      template: {path: string; exists: boolean} | null;
    }
  | {ok: false; error: PresetError};

/**
 * US-008 AC-14: turns a preset, the Defaults and the built-ins into the input
 * of `convert`. The page goes through `resolvePageSetup`; its first error
 * makes the preset invalid, with the line of the field when the note sets it.
 */
export function effectiveSettings(
  preset: {fields: PresetFields; lines: Readonly<Record<string, number>>},
  defaults: PresetFields,
  templateExists: (path: string) => boolean,
): EffectiveResult {
  const resolved = resolveFields(preset.fields, defaults);
  const page = resolvePageSetup(resolved.page);
  if (!page.ok) {
    const first = page.errors[0];
    if (first === undefined) {
      return {
        ok: false,
        error: {message: 'The page settings are invalid', line: null},
      };
    }
    return {
      ok: false,
      error: {
        message: first.message,
        line: preset.lines[`page.${first.field}`] ?? null,
      },
    };
  }
  const path = resolved.template;
  const exists = path !== null && templateExists(path);
  return {
    ok: true,
    settings: {
      page: page.value,
      pageFurniture: resolved.pageFurniture,
      breakBefore: resolved.breakBefore,
      book: resolved.book,
      toc: resolved.toc,
      images: resolved.images,
      highlightColor: resolved.highlightColor,
      headingNumbering: resolved.headingNumbering,
      externalLinkFootnotes: resolved.externalLinkFootnotes,
      linkPageNumbers: resolved.linkPageNumbers,
      linkPageLevel: resolved.linkPageLevel,
      linkPageWord: resolved.linkPageWord,
      template: exists,
      cover: resolveCover(preset.fields.cover),
      fonts: mergeFonts(preset.fields.fonts, defaults.fonts),
      callouts: preset.fields.callouts ?? {},
      headingRules: preset.fields.headingRules ?? {},
    },
    template: path === null ? null : {path, exists},
  };
}
