// US-014: the configured markdown-it instance (decision: docs/technical/markdown-parser.md).
// Pure: no Obsidian, Node, or I/O imports.
import MarkdownIt, {type MarkdownIt as Md} from 'markdown-it';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import tasks from 'markdown-it-task-lists';

/** Longest footnote label scanned, so that `[^` repeated cannot go quadratic. */
const MAX_LABEL = 200;

/**
 * `[[file#anchor|alias]]` and `![[file|size]]` as an inline rule. It runs
 * before `link`, so it also works around emphasis and code (`[[A|*b*]]`,
 * `` `[[A]]` `` stays code). An unclosed or empty `[[` is literal text.
 */
function wikilink(md: Md): void {
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const src = state.src;
    let pos = state.pos;
    const embed = src.charCodeAt(pos) === 0x21; // !
    if (embed) pos++;
    if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) {
      return false;
    }
    const end = src.indexOf(']]', pos + 2);
    if (end < 0) return false;
    const inner = src.slice(pos + 2, end);
    if (inner === '' || inner.includes('\n') || inner.includes('[')) {
      return false;
    }
    if (!silent) {
      // `\|` is the escaped pipe inside a table cell.
      const split = /^([^|]*?)\\?\|([\s\S]*)$/.exec(inner);
      const target = split ? (split[1] as string) : inner;
      const alias = split ? (split[2] as string) : null;
      const hash = target.indexOf('#');
      const token = state.push(embed ? 'embed' : 'wikilink', '', 0);
      token.meta = {
        file: hash < 0 ? target : target.slice(0, hash),
        anchor: hash < 0 ? null : target.slice(hash + 1),
        alias,
      };
    }
    state.pos = end + 2;
    return true;
  });
}

/**
 * `[^label]` is always a reference, also when no definition exists, so that
 * US-005 can report FOOTNOTE_UNDEFINED. Replaces the plugin's own rule.
 */
function footnoteReference(md: Md): void {
  md.inline.ruler.at('footnote_ref', (state, silent) => {
    const src = state.src;
    const pos = state.pos;
    if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5e) {
      return false;
    }
    let end = pos + 2;
    const limit = Math.min(src.length, pos + 2 + MAX_LABEL);
    while (end < limit && src.charCodeAt(end) !== 0x5d) {
      const c = src.charCodeAt(end);
      if (c === 0x20 || c === 0x0a || c === 0x09 || c === 0x5b) return false;
      end++;
    }
    if (end >= limit || end === pos + 2) return false;
    if (!silent) {
      const token = state.push('footnote_ref', '', 0);
      token.meta = {label: src.slice(pos + 2, end)};
    }
    state.pos = end + 1;
    return true;
  });
}

/**
 * The cells of one table line, like markdown-it counts them: split at every
 * pipe that is not escaped (also inside code), outer empty cells dropped.
 */
function cellCount(line: string): number {
  const cells: string[] = [];
  let last = 0;
  for (let i = 0; i < line.length; i++) {
    if (line.charCodeAt(i) === 0x7c && line.charCodeAt(i - 1) !== 0x5c) {
      cells.push(line.slice(last, i));
      last = i + 1;
    }
  }
  cells.push(line.slice(last));
  if (cells[0] === '') cells.shift();
  if (cells.at(-1) === '') cells.pop();
  return cells.length;
}

interface RuleEntry {
  name: string;
  fn: unknown;
  alt: string[];
}

/**
 * US-005 AC-3: markdown-it cuts the cells of a row that are beyond the
 * header; this wrapper keeps their number in the `tr_open` token
 * (`meta.extraCells`) so that the emitter can report them.
 */
function tableExtraCells(md: Md): void {
  type TableRule = (
    state: Md['block']['State']['prototype'],
    start: number,
    end: number,
    silent: boolean,
  ) => boolean;
  const entry = (
    md.block.ruler as unknown as {__rules__: RuleEntry[]}
  ).__rules__.find((rule) => rule.name === 'table');
  if (entry === undefined) return;
  const original = entry.fn as TableRule;
  md.block.ruler.at(
    'table',
    ((state, start, end, silent) => {
      const first = state.tokens.length;
      if (!original(state, start, end, silent)) return false;
      if (silent) return true;
      const rows = state.tokens.slice(first);
      const columns = rows.filter((t) => t.type === 'th_open').length;
      for (const tr of rows) {
        const line = tr.map?.[0];
        if (tr.type !== 'tr_open' || line === undefined || line === start) {
          continue;
        }
        const text = state.src
          .slice(state.bMarks[line], state.eMarks[line])
          .trim();
        const extra = cellCount(text) - columns;
        if (extra > 0) tr.meta = {extraCells: extra};
      }
      return true;
    }) as TableRule as never,
    {alt: entry.alt},
  );
}

/**
 * US-005 AC-4c: where the footnote plugin finds no closing `]` the `^[` stays
 * literal text; this token lets the tree mark it, so that the emitter can warn.
 */
function unclosedNote(md: Md): void {
  md.inline.ruler.after(
    'footnote_inline',
    'footnote_unclosed',
    (state, silent) => {
      const src = state.src;
      const pos = state.pos;
      if (src.charCodeAt(pos) !== 0x5e || src.charCodeAt(pos + 1) !== 0x5b) {
        return false;
      }
      if (!silent) state.push('footnote_unclosed', '', 0);
      state.pos = pos + 2;
      return true;
    },
  );
}

let instance: Md | undefined;

export function markdown(): Md {
  if (instance === undefined) {
    const md = new MarkdownIt({html: true, linkify: true})
      .use(footnote)
      .use(mark)
      .use(tasks)
      .use(wikilink);
    footnoteReference(md);
    unclosedNote(md);
    tableExtraCells(md);
    // Definitions stay at their place in the stream (also unreferenced ones).
    md.core.ruler.disable('footnote_tail');
    // Bare addresses only with a scheme: `compiledtext.md` is not a link.
    md.linkify.set({fuzzyLink: false, fuzzyEmail: false, fuzzyIP: false});
    // Keep addresses and paths exactly as written (the asset resolver decodes).
    md.normalizeLink = (url) => url;
    md.normalizeLinkText = (text) => text;
    instance = md;
  }
  return instance;
}
