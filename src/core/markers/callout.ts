// US-016: Obsidian callouts. Recognises the header of a blockquote, holds the
// built-in styles and aliases, and resolves the style of a callout type field
// by field. Pure: no Obsidian, Node, or I/O imports; nothing is emitted here
// (the Typst is written by core/emit/callout.ts). The only place in `src` that
// matches the header (SCAR-017; a text check in the US-016 tests).
import type {
  BlockNode,
  BlockquoteNode,
  InlineNode,
  ParagraphNode,
} from '../parse';

/** The header of a callout line (US-016 AC-1). */
export interface CalloutHeader {
  /** The type in lower case, used to find the style. */
  type: string;
  /** The type as the author wrote it, used for titles and messages. */
  typed: string;
  /** The fold sign after `]`; ignored when printing (AC-4). */
  fold: '' | '+' | '-';
  /** The title after the header, trimmed; '' when there is none. */
  title: string;
}

/**
 * `[!TYPE]` plus an optional fold sign at the start of a line. What follows
 * must be the end of the line or a blank (AC-1: `[!note]Title` is no header).
 */
const HEADER = /^\[!([^\]\s]+)\]([+-]?)(?=\s|$)/u;

/**
 * US-016 | AC-1: The header of a callout is `[!TYPE]`, an optional fold sign
 * and an optional title after at least one blank.
 *
 * Returns null for any other line. `TYPE` is one or more characters that are
 * neither `]` nor white space; it is returned in lower case and as typed. The
 * title is the rest of the line with blanks at both ends removed.
 * Examples: `[!tip]- Hidden` → type `tip`, fold `-`, title `Hidden`;
 * `[!note]Title`, `**[!note]** T`, `[!] T`, `[!my type] T` → null.
 */
export function parseCalloutHeader(line: string): CalloutHeader | null {
  const match = HEADER.exec(line);
  if (match === null) return null;
  const typed = match[1] as string;
  return {
    type: typed.toLowerCase(),
    typed,
    fold: match[2] as CalloutHeader['fold'],
    title: line.slice(match[0].length).trim(),
  };
}

/** A blockquote read as a callout (US-016 AC-1, AC-3, AC-5). */
export interface Callout {
  header: CalloutHeader;
  /** The source line of the header. */
  line: number;
  /** The inline nodes of the title from the header line; empty for none. */
  title: InlineNode[];
  /** The blocks of the body: the rest of the first paragraph, then the others. */
  body: BlockNode[];
}

const isBreak = (node: InlineNode): boolean =>
  node.kind === 'softbreak' || node.kind === 'break';

/**
 * US-016 | AC-1, AC-3, AC-5: Reads a blockquote as a callout, or returns null.
 *
 * The header must be at the start of the first text node of the quote's first
 * block, which must be a paragraph; so `**[!note]** T` (markup first) is not a
 * callout. Transforms (SCAR-001): the header text is removed; the inline nodes
 * after it up to the first soft or hard break are the title (leading blanks of
 * the first and trailing blanks of the last text node removed, so markup,
 * links and footnote calls stay nodes for the inline emitter); the nodes after
 * that break become the first body paragraph, at the line of its first node;
 * the other blocks of the quote follow unchanged. The type is lower-cased
 * (see {@link parseCalloutHeader}). A nested quote is read by calling this on
 * the nested node. Does not modify the quote.
 */
export function findCallout(quote: BlockquoteNode): Callout | null {
  const first = quote.children[0];
  if (first?.kind !== 'paragraph') return null;
  const nodes = first.children;
  const head = nodes[0];
  if (head?.kind !== 'text') return null;
  const match = HEADER.exec(head.value);
  if (match === null) return null;
  const breakAt = nodes.findIndex(isBreak);
  const end = breakAt < 0 ? nodes.length : breakAt;
  const rest = head.value.slice(match[0].length);
  // `[!note]*x*`: the header text ends without a blank, but markup follows on
  // the same line; that is no blank before the title (AC-1).
  if (rest === '' && end > 1) return null;

  const title: InlineNode[] = [];
  const restTrimmed = rest.replace(/^\s+/u, '');
  if (restTrimmed !== '') title.push({...head, value: restTrimmed});
  title.push(...nodes.slice(1, end));
  const last = title[title.length - 1];
  if (last?.kind === 'text') {
    const trimmed = last.value.replace(/\s+$/u, '');
    if (trimmed === '') title.pop();
    else title[title.length - 1] = {...last, value: trimmed};
  }

  const body: BlockNode[] = [];
  const after = breakAt < 0 ? [] : nodes.slice(breakAt + 1);
  if (after.length > 0) {
    const paragraph: ParagraphNode = {
      kind: 'paragraph',
      line: (after[0] as InlineNode).line,
      children: after,
    };
    body.push(paragraph);
  }
  body.push(...quote.children.slice(1));

  const typed = match[1] as string;
  return {
    header: {
      type: typed.toLowerCase(),
      typed,
      fold: match[2] as CalloutHeader['fold'],
      title: rest.trim(),
    },
    line: head.line,
    title,
    body,
  };
}

/** A resolved style: every field has a value (US-016 AC-8, AC-9). */
export interface CalloutStyle {
  /** `#rrggbb`, or null for `none`. */
  fill: string | null;
  /** Colour `#rrggbb` and width in pt; width 0 is no border. */
  border: {color: string; width: number};
  /** Inner spacing in pt. */
  inset: number;
  /** `text` null = the type as title; '' = no title line (AC-3). */
  title: {text: string | null; color: string};
  /** Null = the body font, its size. */
  font: {family: string | null; size: number | null};
  /** Vault path of the icon, or null for none. */
  icon: string | null;
}

/** One style as a preset note writes it (US-016 AC-7); every field optional. */
export interface CalloutPresetStyle {
  fill?: string | null;
  border?: {color?: string | null; width?: number | null} | null;
  inset?: number | null;
  title?: {text?: string | null; color?: string | null} | null;
  font?: {family?: string | null; size?: number | null} | null;
  icon?: string | null;
}

/** The preset field `callouts`: styles by name (US-016 AC-7). */
export type CalloutsSettings = Readonly<Record<string, CalloutPresetStyle>>;

/**
 * US-016 | AC-9: A built-in style in Obsidian's colour: fill at 10 % on white,
 * border 0.75 pt in the colour, inset 8 pt, title in the colour, no font or
 * icon of its own.
 */
function builtin(colour: string, fill: string): CalloutStyle {
  return Object.freeze({
    fill,
    border: Object.freeze({color: colour, width: 0.75}),
    inset: 8,
    title: Object.freeze({text: null, color: colour}),
    font: Object.freeze({family: null, size: null}),
    icon: null,
  });
}

/** US-016 AC-9: the built-in styles (decided by the user 2026-10-18). */
export const BUILTIN_CALLOUT_STYLES: Readonly<Record<string, CalloutStyle>> =
  Object.freeze({
    default: builtin('#9e9e9e', '#f5f5f5'),
    note: builtin('#086ddd', '#e6f0fc'),
    abstract: builtin('#00bfbc', '#e6f9f8'),
    info: builtin('#086ddd', '#e6f0fc'),
    todo: builtin('#086ddd', '#e6f0fc'),
    tip: builtin('#00bfbc', '#e6f9f8'),
    success: builtin('#08b94e', '#e6f8ed'),
    question: builtin('#ec7500', '#fdf1e6'),
    warning: builtin('#ec7500', '#fdf1e6'),
    failure: builtin('#e93147', '#fdeaed'),
    danger: builtin('#e93147', '#fdeaed'),
    bug: builtin('#e93147', '#fdeaed'),
    example: builtin('#7852ee', '#f2eefd'),
    quote: builtin('#9e9e9e', '#f5f5f5'),
  });

/** US-016 AC-9: Obsidian's aliases, alias → built-in style name. */
export const CALLOUT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  summary: 'abstract',
  tldr: 'abstract',
  hint: 'tip',
  important: 'tip',
  check: 'success',
  done: 'success',
  help: 'question',
  faq: 'question',
  caution: 'warning',
  attention: 'warning',
  fail: 'failure',
  missing: 'failure',
  error: 'danger',
  cite: 'quote',
});

const own = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

/** The first value that is set (not undefined and not null). */
function first<T>(...values: (T | null | undefined)[]): T | undefined {
  return values.find((v): v is T => v !== undefined && v !== null);
}

/** The result of {@link resolveCalloutStyle}. */
export interface ResolvedCallout {
  /** The style name written to the Typst (`default` for an unknown type). */
  name: string;
  style: CalloutStyle;
  /** False when the type has no style and no alias (warning of AC-10). */
  known: boolean;
}

/**
 * US-016 | AC-8, AC-10: Finds the style of callout type `type` (lower case)
 * and fills each field from the first place that sets it.
 *
 * Name: `type` when the preset or the built-ins have that style; else the
 * alias target; else `default` with `known` false. A preset style named like
 * an alias wins over the alias. Fields: preset `<name>`, built-in `<name>`,
 * preset `default`, built-in `default`; a `null` is unset. `"none"` for fill
 * or icon gives null. Styles come from the preset only (decided by the user
 * 2026-10-18). Does not check values; the preset parser does (AC-7).
 */
export function resolveCalloutStyle(
  type: string,
  settings: CalloutsSettings = {},
): ResolvedCallout {
  let name = 'default';
  let known = true;
  if (own(settings, type) || own(BUILTIN_CALLOUT_STYLES, type)) {
    name = type;
  } else if (own(CALLOUT_ALIASES, type)) {
    name = CALLOUT_ALIASES[type] as string;
  } else {
    known = false;
  }
  const chain: CalloutPresetStyle[] = [
    own(settings, name) ? (settings[name] ?? {}) : {},
    own(BUILTIN_CALLOUT_STYLES, name)
      ? (BUILTIN_CALLOUT_STYLES[name] as CalloutStyle)
      : {},
    own(settings, 'default') ? (settings['default'] ?? {}) : {},
    BUILTIN_CALLOUT_STYLES['default'] as CalloutStyle,
  ];
  const pick = <T>(get: (s: CalloutPresetStyle) => T | null | undefined): T =>
    first(...chain.map(get)) as T;
  const fill = pick((s) => s.fill);
  const icon = first(...chain.map((s) => s.icon));
  return {
    name,
    known,
    style: {
      fill: fill === 'none' ? null : fill,
      border: {
        color: pick((s) => s.border?.color),
        width: pick((s) => s.border?.width),
      },
      inset: pick((s) => s.inset),
      title: {
        text: first(...chain.map((s) => s.title?.text)) ?? null,
        color: pick((s) => s.title?.color),
      },
      font: {
        family: first(...chain.map((s) => s.font?.family)) ?? null,
        size: first(...chain.map((s) => s.font?.size)) ?? null,
      },
      icon: icon === undefined || icon === 'none' ? null : icon,
    },
  };
}

/**
 * US-016 | AC-3: The title of a callout without a header title: the style's
 * `title.text` when set (also '', meaning no title line), else the type as
 * typed with its first character in upper case and the rest in lower case
 * (`EXAMPLE` → `Example`, `my-box` → `My-box`, `über` → `Über`).
 *
 * Returns plain text; the emitter escapes it (escapeMarkup, AC-3).
 */
export function defaultCalloutTitle(
  typed: string,
  style: CalloutStyle,
): string {
  if (style.title.text !== null) return style.title.text;
  const [head = '', ...tail] = [...typed];
  return head.toUpperCase() + tail.join('').toLowerCase();
}
