// US-008 AC-2, AC-4, AC-13: reads a preset note (YAML frontmatter) and checks
// every field. The `yaml` package gives the lines of errors (decided by the
// user on 2026-10-17). Pure core: the parser does no I/O.
import {LineCounter, isMap, isScalar, parseDocument} from 'yaml';
import {
  FONT_ROLES,
  MAX_FONT_SIZE,
  type FontRoleFields,
  type FontsPresetFields,
} from '../fonts/types';
import {
  HEADING_RULE_NAMES,
  headingRuleKey,
  type CalloutPresetStyle,
  type CalloutsSettings,
  type HeadingRule,
  type HeadingRulesSettings,
} from '../markers';
import {isValidNumbering} from './numbering';
import {
  SCHEMA_VERSION,
  type CoverPresetFields,
  type PagePresetFields,
  type PresetFields,
} from './schema';

/** An error of a preset note; `line` counts in the note, the first fence is 1. */
export interface PresetError {
  message: string;
  /** `null` when the value does not come from a note (the Defaults). */
  line: number | null;
}

export type ParseResult =
  | {
      ok: true;
      fields: PresetFields;
      /** The line in the note of every field, by path (`page.margins.top`). */
      lines: Record<string, number>;
      /** Messages for values that were replaced (AC-13), not errors. */
      notices: string[];
    }
  | {ok: false; error: PresetError};

export type ValidateResult =
  | {ok: true; fields: PresetFields; notices: string[]}
  | {ok: false; error: PresetError};

export const NUMBERING_NOTICE = 'Invalid heading numbering; "1.1" is used';
const NOT_A_MAPPING =
  'Frontmatter must contain settings written as name: value';
const FENCE = /^---[ \t]*$/;
const COLOUR = /^#[0-9a-fA-F]{6}$/;
/** US-016 AC-7: a callout style name. */
const STYLE_NAME = /^[a-z0-9][a-z0-9_-]*$/;

/** US-008 AC-4: `<message> (line <n>)`, or the message alone without a line. */
export function formatPresetError(error: PresetError): string {
  return error.line === null
    ? error.message
    : `${error.message} (line ${error.line})`;
}

interface Problem {
  path: string;
  message: string;
}

type Group = Record<string, unknown>;

function isGroup(value: unknown): value is Group {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function read(group: Group, key: string): unknown {
  const value = Object.hasOwn(group, key) ? group[key] : undefined;
  return value === null ? undefined : value;
}

/**
 * US-019 AC-1 | US-018 AC-1: a heading level is a whole number from 1 to 6.
 *
 * The one check of `page.runningHeaderLevel` and `linkPageLevel` (SCAR-017).
 */
function isHeadingLevel(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  );
}

function isLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Checks one group of numbers or flags; wrong values become problems. */
function readPage(value: unknown, problems: Problem[]): PagePresetFields {
  const out: PagePresetFields = {};
  if (!isGroup(value)) {
    problems.push({path: 'page', message: 'page must be a group of settings'});
    return out;
  }
  const size = read(value, 'trimSize');
  if (size !== undefined) {
    if (typeof size === 'string') out.trimSize = size;
    else
      problems.push({
        path: 'page.trimSize',
        message: 'page.trimSize must be text',
      });
  }
  for (const key of [
    'trimWidth',
    'trimHeight',
    'gutter',
    'bleed',
    'slug',
  ] as const) {
    const n = read(value, key);
    if (n === undefined) continue;
    if (isLength(n)) out[key] = n;
    else
      problems.push({
        path: `page.${key}`,
        message: `page.${key} must be a number of at least 0`,
      });
  }
  const facing = read(value, 'facingPages');
  if (facing !== undefined) {
    if (typeof facing === 'boolean') out.facingPages = facing;
    else
      problems.push({
        path: 'page.facingPages',
        message: 'page.facingPages must be true or false',
      });
  }
  // US-019 AC-1: the page furniture.
  for (const key of ['folios', 'runningHeader'] as const) {
    const flag = read(value, key);
    if (flag === undefined) continue;
    if (typeof flag === 'boolean') out[key] = flag;
    else
      problems.push({
        path: `page.${key}`,
        message: `page.${key} must be true or false`,
      });
  }
  const level = read(value, 'runningHeaderLevel');
  if (level !== undefined) {
    if (isHeadingLevel(level)) {
      out.runningHeaderLevel = level;
    } else
      problems.push({
        path: 'page.runningHeaderLevel',
        message: 'page.runningHeaderLevel must be a whole number from 1 to 6',
      });
  }
  const margins = read(value, 'margins');
  if (margins !== undefined) {
    if (!isGroup(margins)) {
      problems.push({
        path: 'page.margins',
        message: 'page.margins must be a group of settings',
      });
    } else {
      const m: NonNullable<PagePresetFields['margins']> = {};
      for (const side of ['top', 'bottom', 'inside', 'outside'] as const) {
        const n = read(margins, side);
        if (n === undefined) continue;
        if (isLength(n)) m[side] = n;
        else
          problems.push({
            path: `page.margins.${side}`,
            message: `page.margins.${side} must be a number of at least 0`,
          });
      }
      out.margins = m;
    }
  }
  return out;
}

/** US-011 AC-1: checks the `cover` group of a preset note. */
function readCover(value: unknown, problems: Problem[]): CoverPresetFields {
  const out: CoverPresetFields = {};
  if (!isGroup(value)) {
    problems.push({
      path: 'cover',
      message: 'cover must be a group of settings',
    });
    return out;
  }
  const mode = read(value, 'mode');
  if (mode !== undefined) {
    if (mode === 'auto' || mode === 'file' || mode === 'none') out.mode = mode;
    else
      problems.push({
        path: 'cover.mode',
        message: 'cover.mode must be auto, file or none',
      });
  }
  const file = read(value, 'file');
  if (file !== undefined) {
    if (typeof file === 'string') out.file = file;
    else
      problems.push({
        path: 'cover.file',
        message: 'cover.file must be a vault path written as text',
      });
  }
  if (out.mode === 'file' && (out.file === undefined || out.file === '')) {
    if (file === undefined || typeof file === 'string') {
      problems.push({
        path: 'cover.mode',
        message: 'cover.file is needed when cover.mode is file',
      });
    }
  }
  const blank = read(value, 'blankPageAfter');
  if (blank !== undefined) {
    if (typeof blank === 'boolean') out.blankPageAfter = blank;
    else
      problems.push({
        path: 'cover.blankPageAfter',
        message: 'cover.blankPageAfter must be true or false',
      });
  }
  const crop = read(value, 'cropWarningPercent');
  if (crop !== undefined) {
    if (
      typeof crop === 'number' &&
      Number.isFinite(crop) &&
      crop >= 0 &&
      crop <= 100
    ) {
      out.cropWarningPercent = crop;
    } else
      problems.push({
        path: 'cover.cropWarningPercent',
        message: 'cover.cropWarningPercent must be a number from 0 to 100',
      });
  }
  if (read(value, 'back') !== undefined) out.back = true;
  return out;
}

/** US-010 AC-1: a family name or folder: text with something in it. */
function readText(
  group: Group,
  key: string,
  path: string,
  message: string,
  problems: Problem[],
): string | undefined {
  const value = read(group, key);
  if (value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  problems.push({path, message});
  return undefined;
}

/** US-010 AC-1: checks the `fonts` group; unknown roles are ignored. */
function readFonts(value: unknown, problems: Problem[]): FontsPresetFields {
  const out: FontsPresetFields = {};
  if (!isGroup(value)) {
    problems.push({
      path: 'fonts',
      message: 'fonts must be a group of settings',
    });
    return out;
  }
  const folder = readText(
    value,
    'folder',
    'fonts.folder',
    'fonts.folder must be a vault folder path written as text',
    problems,
  );
  if (folder !== undefined) out.folder = folder;
  const family = readText(
    value,
    'default',
    'fonts.default',
    'fonts.default must be a font family name written as text',
    problems,
  );
  if (family !== undefined) out.default = family;
  for (const role of FONT_ROLES) {
    const group = read(value, role);
    if (group === undefined) continue;
    if (!isGroup(group)) {
      problems.push({
        path: `fonts.${role}`,
        message: `fonts.${role} must be a group of settings`,
      });
      continue;
    }
    const fields: FontRoleFields = {};
    const name = readText(
      group,
      'family',
      `fonts.${role}.family`,
      `fonts.${role}.family must be a font family name written as text`,
      problems,
    );
    if (name !== undefined) fields.family = name;
    const size = read(group, 'size');
    if (size !== undefined) {
      if (
        typeof size === 'number' &&
        Number.isFinite(size) &&
        size > 0 &&
        size <= MAX_FONT_SIZE
      ) {
        fields.size = size;
      } else {
        problems.push({
          path: `fonts.${role}.size`,
          message: `fonts.${role}.size must be a number of pt greater than 0 and at most ${MAX_FONT_SIZE}`,
        });
      }
    }
    out[role] = fields;
  }
  return out;
}

/**
 * US-016 | AC-7: A number in pt inside `[min, max]`; `minOpen` makes the lower
 * bound exclusive. Anything else (text, a flag, NaN) is a problem with
 * `message` at `path`. Returns undefined when unset or refused.
 */
function readPt(
  group: Group,
  key: string,
  bounds: {min: number; max: number; minOpen?: boolean},
  path: string,
  message: string,
  problems: Problem[],
): number | undefined {
  const value = read(group, key);
  if (value === undefined) return undefined;
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (bounds.minOpen === true ? value > bounds.min : value >= bounds.min) &&
    value <= bounds.max
  ) {
    return value;
  }
  problems.push({path, message});
  return undefined;
}

/**
 * US-016 | AC-7: A colour `#rrggbb` (either case, the `highlightColor` check),
 * or also `none` when `orNone` is set. Returns undefined when unset or refused.
 */
function readColour(
  group: Group,
  key: string,
  orNone: boolean,
  path: string,
  problems: Problem[],
): string | undefined {
  const value = read(group, key);
  if (value === undefined) return undefined;
  if (
    typeof value === 'string' &&
    (COLOUR.test(value) || (orNone && value === 'none'))
  ) {
    return value;
  }
  problems.push({
    path,
    message: `${path} must be a colour "#rrggbb"${orNone ? ' or "none"' : ''}`,
  });
  return undefined;
}

/**
 * US-016 | AC-7: A nested group of a style (`border`, `title`, `font`), or
 * undefined with the problem `<path> must be a group of settings`.
 */
function readSubgroup(
  group: Group,
  key: string,
  path: string,
  problems: Problem[],
): Group | undefined {
  const value = read(group, key);
  if (value === undefined) return undefined;
  if (isGroup(value)) return value;
  problems.push({path, message: `${path} must be a group of settings`});
  return undefined;
}

/** US-016 | AC-7: Checks one callout style; unknown fields are ignored. */
function readCalloutStyle(
  style: Group,
  at: string,
  problems: Problem[],
): CalloutPresetStyle {
  const out: CalloutPresetStyle = {};
  const fill = readColour(style, 'fill', true, `${at}.fill`, problems);
  if (fill !== undefined) out.fill = fill;
  const border = readSubgroup(style, 'border', `${at}.border`, problems);
  if (border !== undefined) {
    const fields: NonNullable<CalloutPresetStyle['border']> = {};
    const color = readColour(
      border,
      'color',
      false,
      `${at}.border.color`,
      problems,
    );
    if (color !== undefined) fields.color = color;
    const width = readPt(
      border,
      'width',
      {min: 0, max: 10},
      `${at}.border.width`,
      `${at}.border.width must be a number of pt from 0 to 10`,
      problems,
    );
    if (width !== undefined) fields.width = width;
    out.border = fields;
  }
  const inset = readPt(
    style,
    'inset',
    {min: 0, max: 50},
    `${at}.inset`,
    `${at}.inset must be a number of pt from 0 to 50`,
    problems,
  );
  if (inset !== undefined) out.inset = inset;
  const title = readSubgroup(style, 'title', `${at}.title`, problems);
  if (title !== undefined) {
    const fields: NonNullable<CalloutPresetStyle['title']> = {};
    const text = read(title, 'text');
    if (text !== undefined) {
      if (typeof text === 'string') fields.text = text;
      else
        problems.push({
          path: `${at}.title.text`,
          message: `${at}.title.text must be text`,
        });
    }
    const color = readColour(
      title,
      'color',
      false,
      `${at}.title.color`,
      problems,
    );
    if (color !== undefined) fields.color = color;
    out.title = fields;
  }
  const font = readSubgroup(style, 'font', `${at}.font`, problems);
  if (font !== undefined) {
    const fields: NonNullable<CalloutPresetStyle['font']> = {};
    const family = readText(
      font,
      'family',
      `${at}.font.family`,
      `${at}.font.family must be a font family name written as text`,
      problems,
    );
    if (family !== undefined) fields.family = family;
    const size = readPt(
      font,
      'size',
      {min: 0, max: MAX_FONT_SIZE, minOpen: true},
      `${at}.font.size`,
      `${at}.font.size must be a number of pt greater than 0 and at most ${MAX_FONT_SIZE}`,
      problems,
    );
    if (size !== undefined) fields.size = size;
    out.font = fields;
  }
  const icon = readText(
    style,
    'icon',
    `${at}.icon`,
    `${at}.icon must be a vault path written as text, or "none"`,
    problems,
  );
  if (icon !== undefined) out.icon = icon;
  return out;
}

/**
 * US-016 | AC-7: Checks the `callouts` group of a preset note: a group of
 * styles keyed by a name matching `^[a-z0-9][a-z0-9_-]*$`. Problems carry the
 * path `callouts.<name>[.<field>]`, so the error shows the line of the field.
 */
function readCallouts(value: unknown, problems: Problem[]): CalloutsSettings {
  const out: Record<string, CalloutPresetStyle> = {};
  if (!isGroup(value)) {
    problems.push({
      path: 'callouts',
      message: 'callouts must be a group of styles',
    });
    return out;
  }
  for (const name of Object.keys(value)) {
    const at = `callouts.${name}`;
    if (!STYLE_NAME.test(name)) {
      problems.push({
        path: at,
        message: `${at} is not a valid style name (use a-z, 0-9, - and _)`,
      });
      continue;
    }
    const style = read(value, name);
    if (style === undefined) continue;
    if (!isGroup(style)) {
      problems.push({path: at, message: `${at} must be a group of settings`});
      continue;
    }
    out[name] = readCalloutStyle(style, at, problems);
  }
  return out;
}

/**
 * US-017 | AC-1: Checks the `headingRules` group of a preset note: heading
 * texts mapped to a rule name (`glossary` or `none`, compared exactly). Two
 * keys with the same comparison form ({@link headingRuleKey}) are refused at
 * the second one, found through the set of forms already seen (SCAR-011). A
 * `null` entry is unset. Problems carry the path `headingRules.<text>`.
 */
function readHeadingRules(
  value: unknown,
  problems: Problem[],
): HeadingRulesSettings {
  const out: Record<string, HeadingRule> = {};
  if (!isGroup(value)) {
    problems.push({
      path: 'headingRules',
      message: 'headingRules must be a group of heading texts',
    });
    return out;
  }
  const seen = new Set<string>();
  for (const text of Object.keys(value)) {
    const at = `headingRules.${text}`;
    const key = headingRuleKey(text);
    if (seen.has(key)) {
      problems.push({
        path: at,
        message: `headingRules has the heading text "${text}" twice (compared without case and trailing blanks)`,
      });
      continue;
    }
    seen.add(key);
    const rule = read(value, text);
    if (rule === undefined) continue;
    const name = HEADING_RULE_NAMES.find((n) => n === rule);
    if (name === undefined) {
      problems.push({
        path: at,
        message: `${at} must be a rule name: glossary or none`,
      });
      continue;
    }
    out[text] = name;
  }
  return out;
}

/** Checks the preset fields of `input`; unknown fields are ignored. */
function readFields(
  input: Group,
  problems: Problem[],
  notices: Problem[],
  fromNote: boolean,
): PresetFields {
  const out: PresetFields = {};
  const colour = read(input, 'highlightColor');
  if (colour !== undefined) {
    if (typeof colour === 'string' && COLOUR.test(colour)) {
      out.highlightColor = colour;
    } else {
      problems.push({
        path: 'highlightColor',
        message: 'highlightColor must be a colour written #rrggbb',
      });
    }
  }
  const numbering = read(input, 'headingNumbering');
  if (numbering !== undefined) {
    if (typeof numbering !== 'string') {
      problems.push({
        path: 'headingNumbering',
        message: 'headingNumbering must be text',
      });
    } else if (isValidNumbering(numbering)) {
      out.headingNumbering = numbering;
    } else {
      out.headingNumbering = '1.1';
      notices.push({path: 'headingNumbering', message: NUMBERING_NOTICE});
    }
  }
  const footnotes = read(input, 'externalLinkFootnotes');
  if (footnotes !== undefined) {
    if (typeof footnotes === 'boolean') out.externalLinkFootnotes = footnotes;
    else
      problems.push({
        path: 'externalLinkFootnotes',
        message: 'externalLinkFootnotes must be true or false',
      });
  }
  // US-018 AC-1: page numbers after internal links.
  const linkPages = read(input, 'linkPageNumbers');
  if (linkPages !== undefined) {
    if (typeof linkPages === 'boolean') out.linkPageNumbers = linkPages;
    else
      problems.push({
        path: 'linkPageNumbers',
        message: 'linkPageNumbers must be true or false',
      });
  }
  const linkLevel = read(input, 'linkPageLevel');
  if (linkLevel !== undefined) {
    if (isHeadingLevel(linkLevel)) out.linkPageLevel = linkLevel;
    else
      problems.push({
        path: 'linkPageLevel',
        message: 'linkPageLevel must be a whole number from 1 to 6',
      });
  }
  const linkWord = read(input, 'linkPageWord');
  if (linkWord !== undefined) {
    if (typeof linkWord === 'string' && linkWord !== '') {
      out.linkPageWord = linkWord;
    } else
      problems.push({
        path: 'linkPageWord',
        message: 'linkPageWord must be text',
      });
  }
  const template = read(input, 'template');
  if (template !== undefined) {
    if (typeof template === 'string') out.template = template;
    else
      problems.push({
        path: 'template',
        message: 'template must be a path in the vault, written as text',
      });
  }
  const page = read(input, 'page');
  if (page !== undefined) out.page = readPage(page, problems);
  const fontsValue = read(input, 'fonts');
  if (fontsValue !== undefined) out.fonts = readFonts(fontsValue, problems);
  const coverValue = read(input, 'cover');
  if (fromNote && coverValue !== undefined) {
    out.cover = readCover(coverValue, problems);
  }
  // US-016 AC-8: callout styles exist in preset notes only, as the cover.
  const calloutsValue = read(input, 'callouts');
  if (fromNote && calloutsValue !== undefined) {
    out.callouts = readCallouts(calloutsValue, problems);
  }
  // US-017 AC-1: heading rules exist in preset notes only, as callouts.
  const rulesValue = read(input, 'headingRules');
  if (fromNote && rulesValue !== undefined) {
    out.headingRules = readHeadingRules(rulesValue, problems);
  }
  // US-021 AC-1: the group exists in preset notes only, as the cover.
  if (fromNote) {
    const group = readGroupValue(input, problems);
    if (group !== null) out.group = group;
  }
  return out;
}

/**
 * US-021 | AC-1: The group of `input`: the text with blanks at the ends
 * removed, or null when the field is missing, null, empty or blanks. A value
 * that is not text is a problem (`group must be text`) and gives null.
 */
function readGroupValue(input: Group, problems: Problem[]): string | null {
  const value = read(input, 'group');
  if (value === undefined) return null;
  if (typeof value !== 'string') {
    problems.push({path: 'group', message: 'group must be text'});
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * US-021 | AC-2 (decision 5): The group of a preset note read on its own, for
 * a note whose other fields are invalid: the frontmatter must be closed YAML
 * holding a mapping, and `group` text (trimmed, not empty); anything else
 * gives null. Never throws; reports nothing.
 */
export function readGroup(text: string): string | null {
  try {
    const found = frontmatter(text);
    if (found === null || 'unclosed' in found) return null;
    const doc = parseDocument(found.yaml, {prettyErrors: false});
    if (doc.errors.length > 0 || !isMap(doc.contents)) return null;
    const value: unknown = doc.toJS({maxAliasCount: 100});
    return isGroup(value) ? readGroupValue(value, []) : null;
  } catch {
    return null;
  }
}

/**
 * US-008 AC-1, AC-4: checks settings that do not come from a note (the
 * Defaults). The first problem, in the order of the fields, is the error.
 */
export function validateFields(value: unknown): ValidateResult {
  if (!isGroup(value)) {
    return {ok: false, error: {message: NOT_A_MAPPING, line: null}};
  }
  const problems: Problem[] = [];
  const notices: Problem[] = [];
  const fields = readFields(value, problems, notices, false);
  const first = problems[0];
  if (first !== undefined) {
    return {ok: false, error: {message: first.message, line: null}};
  }
  return {ok: true, fields, notices: notices.map((n) => n.message)};
}

/** Where the frontmatter of a note is: its YAML and its place in the text. */
export interface FrontmatterSpan {
  /** The lines between the fences, joined by `\n` (line ends as written dropped). */
  yaml: string;
  /** Offset in `text` of the first YAML line (after the opening fence). */
  start: number;
  /** Offset in `text` of the closing fence line. */
  end: number;
  /** The line end of the opening fence (`\n` or `\r\n`). */
  eol: string;
}

/**
 * US-008 AC-2 | US-022 AC-7: The frontmatter of `text`: the lines between the
 * first two `---` lines (a byte-order mark at the start is skipped), with
 * their offsets, so that a caller can replace the YAML and keep every other
 * byte; `{unclosed: true}` when the second fence is missing; null when the
 * first line is not a fence. The one place that finds a preset's
 * frontmatter (SCAR-017).
 */
export function frontmatterSpan(
  text: string,
): FrontmatterSpan | {unclosed: true} | null {
  const offset = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const lines: {text: string; start: number; eol: string}[] = [];
  const pattern = /([^\r\n]*)(\r\n|\n|$)/g;
  pattern.lastIndex = offset;
  for (;;) {
    const match = pattern.exec(text);
    if (match === null) break;
    lines.push({text: match[1] ?? '', start: match.index, eol: match[2] ?? ''});
    if ((match[2] ?? '') === '') break;
  }
  const first = lines[0];
  if (first === undefined || !FENCE.test(first.text)) return null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] as (typeof lines)[number];
    if (FENCE.test(line.text)) {
      const start = first.start + first.text.length + first.eol.length;
      return {
        yaml: lines
          .slice(1, i)
          .map((l) => l.text)
          .join('\n'),
        start,
        end: line.start,
        eol: first.eol === '' ? '\n' : first.eol,
      };
    }
  }
  return {unclosed: true};
}

/** The text between the first two `---` lines, or null without frontmatter. */
function frontmatter(text: string): {yaml: string} | {unclosed: true} | null {
  const found = frontmatterSpan(text);
  return found === null || 'unclosed' in found ? found : {yaml: found.yaml};
}

function collectLines(
  node: unknown,
  prefix: string,
  lineOf: (offset: number) => number,
  out: Map<string, number>,
): void {
  if (!isMap(node)) return;
  for (const pair of node.items) {
    if (!isScalar(pair.key) || pair.key.range == null) continue;
    const path =
      prefix === ''
        ? String(pair.key.value)
        : `${prefix}.${String(pair.key.value)}`;
    out.set(path, lineOf(pair.key.range[0]));
    collectLines(pair.value, path, lineOf, out);
  }
}

/**
 * US-008 AC-2, AC-4, AC-13: reads the preset in `text`. A note without
 * frontmatter is a valid preset that sets nothing; a byte-order mark at the
 * start is ignored. Never throws.
 */
export function parsePreset(text: string): ParseResult {
  try {
    return parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {message: `Frontmatter cannot be read: ${message}`, line: 1},
    };
  }
}

function parse(text: string): ParseResult {
  const found = frontmatter(text);
  if (found === null) return {ok: true, fields: {}, lines: {}, notices: []};
  if ('unclosed' in found) {
    return {ok: false, error: {message: 'Frontmatter is not closed', line: 1}};
  }
  const counter = new LineCounter();
  const doc = parseDocument(found.yaml, {
    lineCounter: counter,
    prettyErrors: false,
    uniqueKeys: true,
  });
  // The fence is line 1 of the note, so the YAML text starts at line 2.
  const lineOf = (offset: number): number => counter.linePos(offset).line + 1;

  const syntax = doc.errors[0];
  if (syntax !== undefined) {
    return {
      ok: false,
      error: {message: syntax.message, line: lineOf(syntax.pos[0])},
    };
  }
  if (doc.contents === null) {
    return {ok: true, fields: {}, lines: {}, notices: []};
  }
  if (!isMap(doc.contents)) {
    const start = doc.contents.range?.[0] ?? 0;
    return {ok: false, error: {message: NOT_A_MAPPING, line: lineOf(start)}};
  }
  const lineMap = new Map<string, number>();
  collectLines(doc.contents, '', lineOf, lineMap);
  const lines = Object.fromEntries(lineMap);

  const value: unknown = doc.toJS({maxAliasCount: 100});
  if (!isGroup(value)) {
    return {ok: false, error: {message: NOT_A_MAPPING, line: 2}};
  }
  const problems: Problem[] = [];
  const notices: Problem[] = [];

  const version = read(value, 'schemaVersion');
  if (version !== undefined) {
    if (
      typeof version !== 'number' ||
      !Number.isInteger(version) ||
      version < 1
    ) {
      problems.push({
        path: 'schemaVersion',
        message: 'schemaVersion must be a whole number of at least 1',
      });
    } else if (version > SCHEMA_VERSION) {
      problems.push({
        path: 'schemaVersion',
        message: `Preset needs a newer version of Obsidian2Typst (schemaVersion ${version})`,
      });
    }
  }
  const fields = readFields(value, problems, notices, true);
  if (problems.length > 0) {
    const line = (p: Problem): number =>
      lines[p.path] ?? Number.MAX_SAFE_INTEGER;
    const first = problems.reduce((a, b) => (line(b) < line(a) ? b : a));
    return {
      ok: false,
      error: {message: first.message, line: lines[first.path] ?? null},
    };
  }
  return {ok: true, fields, lines, notices: notices.map((n) => n.message)};
}
