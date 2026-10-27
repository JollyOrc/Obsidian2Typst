// US-014 AC-1b: builds the tree from markdown-it's flat token stream.
// Pure: no Obsidian, Node, or I/O imports.
import type {Token} from 'markdown-it';
import type {
  Align,
  BlockNode,
  CellNode,
  InlineNode,
  ItemNode,
  RowNode,
} from './types';

interface Env {
  footnotes?: {list?: {tokens?: Token[]}[]};
}

interface Cursor {
  i: number;
  line: number;
}

const INLINE_CLOSE: Record<string, string> = {
  strong_open: 'strong_close',
  em_open: 'em_close',
  s_open: 's_close',
  mark_open: 'mark_close',
  link_open: 'link_close',
};
const INLINE_KIND: Record<string, 'strong' | 'emph' | 'delete' | 'mark'> = {
  strong_open: 'strong',
  em_open: 'emph',
  s_open: 'delete',
  mark_open: 'mark',
};
/** An attribute as a string; markdown-it types it as string | number | null. */
const attr = (t: Token, name: string): string | null => {
  const v = t.attrGet(name);
  return v === null ? null : String(v);
};
/** Reading text of inline tokens (image alt text has no markup). */
const plain = (ts: Token[] | null): string =>
  (ts ?? [])
    .map((t) =>
      t.type === 'softbreak' || t.type === 'hardbreak'
        ? ' '
        : t.children
          ? plain(t.children)
          : t.type === 'text' ||
              t.type === 'text_special' ||
              t.type === 'code_inline'
            ? t.content
            : '',
    )
    .join('');
const CHECKBOX = '<input class="task-list-item-checkbox"';

/** Task items: the plugin puts an `<input>` token in front of the text. */
function normalizeTasks(tokens: Token[]): void {
  tokens.forEach((t, i) => {
    if (t.type !== 'list_item_open') return;
    if (!(attr(t, 'class') ?? '').includes('task-list-item')) return;
    const inline = tokens[i + 2];
    const first = inline?.children?.[0];
    if (first?.type !== 'html_inline' || !first.content.startsWith(CHECKBOX)) {
      return;
    }
    t.meta = {checked: /\bchecked\b/.test(first.content)};
    inline?.children?.shift();
    const next = inline?.children?.[0];
    if (next?.type === 'text')
      next.content = next.content.replace(/^[ \u00a0]/, '');
  });
}

export class TreeBuilder {
  private readonly lineOffset: number;

  constructor(
    private readonly tokens: Token[],
    private readonly env: Env,
    lineOffset: number,
  ) {
    this.lineOffset = lineOffset;
    normalizeTasks(tokens);
  }

  private lineOf(t: Token | undefined, fallback: number): number {
    return t?.map ? t.map[0] + 1 + this.lineOffset : fallback;
  }

  /** Index of the close token that matches the open token at `i`. */
  private closeOf(i: number): number {
    const level = this.tokens[i]?.level;
    let j = i + 1;
    while (
      j < this.tokens.length &&
      !(this.tokens[j]?.level === level && this.tokens[j]?.nesting === -1)
    ) {
      j++;
    }
    return j;
  }

  root(): BlockNode[] {
    return this.blocks(0, this.tokens.length, 1);
  }

  private blocks(from: number, to: number, fallback: number): BlockNode[] {
    const out: BlockNode[] = [];
    let i = from;
    while (i < to) {
      const t = this.tokens[i] as Token;
      const line = this.lineOf(t, fallback);
      switch (t.type) {
        case 'paragraph_open': {
          out.push({
            kind: 'paragraph',
            line,
            children: this.inline(this.tokens[i + 1], line),
          });
          i = this.closeOf(i) + 1;
          break;
        }
        case 'heading_open': {
          out.push({
            kind: 'heading',
            line,
            depth: Number(t.tag.slice(1)),
            children: this.inline(this.tokens[i + 1], line),
          });
          i = this.closeOf(i) + 1;
          break;
        }
        case 'bullet_list_open':
        case 'ordered_list_open': {
          const end = this.closeOf(i);
          const ordered = t.type === 'ordered_list_open';
          out.push({
            kind: 'list',
            line,
            ordered,
            start: ordered ? Number(attr(t, 'start') ?? '1') : null,
            children: this.items(i + 1, end, line),
          });
          i = end + 1;
          break;
        }
        case 'blockquote_open': {
          const end = this.closeOf(i);
          out.push({
            kind: 'blockquote',
            line,
            children: this.blocks(i + 1, end, line),
          });
          i = end + 1;
          break;
        }
        case 'fence':
        case 'code_block': {
          out.push({
            kind: 'code',
            line,
            lang:
              t.type === 'fence' ? (t.info.trim().split(/\s+/)[0] ?? '') : '',
            value: t.content.replace(/\n$/, ''),
          });
          i++;
          break;
        }
        case 'hr':
          out.push({kind: 'thematic-break', line});
          i++;
          break;
        case 'table_open': {
          const end = this.closeOf(i);
          out.push(this.table(i, end, line));
          i = end + 1;
          break;
        }
        case 'html_block': {
          const value = t.content.replace(/\s+$/, '');
          const comment = /^<!--[\s\S]*?-->$/.test(value);
          out.push(
            comment && value.indexOf('-->') === value.length - 3
              ? {kind: 'comment', line, value}
              : {kind: 'html-block', line, value},
          );
          i++;
          break;
        }
        case 'footnote_reference_open': {
          const end = this.closeOf(i);
          const firstLine = this.lineOf(this.tokens[i + 1], line);
          out.push({
            kind: 'footnote-def',
            line: firstLine,
            label: String((t.meta as {label?: string} | null)?.label ?? ''),
            children: this.blocks(i + 1, end, firstLine),
          });
          i = end + 1;
          break;
        }
        default:
          // An unknown container is skipped as a whole.
          i = t.nesting === 1 ? this.closeOf(i) + 1 : i + 1;
      }
    }
    return out;
  }

  private items(from: number, to: number, fallback: number): ItemNode[] {
    const out: ItemNode[] = [];
    let i = from;
    while (i < to) {
      const t = this.tokens[i] as Token;
      if (t.type !== 'list_item_open') {
        i++;
        continue;
      }
      const end = this.closeOf(i);
      const line = this.lineOf(t, fallback);
      const checked = (t.meta as {checked?: boolean} | null)?.checked;
      out.push({
        kind: 'item',
        line,
        checked: checked ?? null,
        children: this.blocks(i + 1, end, line),
      });
      i = end + 1;
    }
    return out;
  }

  private table(open: number, end: number, fallback: number) {
    const align: Align[] = [];
    const rows: RowNode[] = [];
    let header = false;
    let row: RowNode | undefined;
    for (let j = open + 1; j < end;) {
      const t = this.tokens[j] as Token;
      switch (t.type) {
        case 'thead_open':
          header = true;
          break;
        case 'thead_close':
          header = false;
          break;
        case 'tr_open':
          row = {
            kind: 'row',
            line: this.lineOf(t, fallback),
            header,
            children: [],
          };
          {
            const extra = (t.meta as {extraCells?: number} | null)?.extraCells;
            if (extra !== undefined) row.extraCells = extra;
          }
          break;
        case 'tr_close':
          if (row) rows.push(row);
          row = undefined;
          break;
        case 'th_open':
        case 'td_open': {
          if (row === undefined) break;
          if (header) {
            const style = /text-align:(left|center|right)/.exec(
              attr(t, 'style') ?? '',
            );
            align.push((style?.[1] as Align | undefined) ?? null);
          }
          const cell: CellNode = {
            kind: 'cell',
            line: row.line,
            children: this.inline(this.tokens[j + 1], row.line),
          };
          row.children.push(cell);
          j = this.closeOf(j);
          break;
        }
        default:
          break;
      }
      j++;
    }
    return {
      kind: 'table' as const,
      line: fallback,
      align,
      children: rows,
    };
  }

  /** The nodes of an inline token; `fallback` is the line of its block. */
  private inline(token: Token | undefined, fallback: number): InlineNode[] {
    if (token?.type !== 'inline') return [];
    const cursor: Cursor = {i: 0, line: this.lineOf(token, fallback)};
    return this.inlineNodes(token.children ?? [], cursor);
  }

  private inlineNodes(ts: Token[], cur: Cursor, stop?: string): InlineNode[] {
    const out: InlineNode[] = [];
    const pushText = (value: string) => {
      const last = out.at(-1);
      if (last?.kind === 'text') last.value += value;
      else out.push({kind: 'text', line: cur.line, value});
    };
    while (cur.i < ts.length) {
      const t = ts[cur.i] as Token;
      if (stop !== undefined && t.type === stop) return out;
      cur.i++;
      const line = cur.line;
      switch (t.type) {
        case 'text':
        case 'text_special':
          pushText(t.content);
          break;
        case 'softbreak':
          out.push({kind: 'softbreak', line});
          cur.line++;
          break;
        case 'hardbreak':
          out.push({kind: 'break', line});
          cur.line++;
          break;
        case 'strong_open':
        case 'em_open':
        case 's_open':
        case 'mark_open': {
          const children = this.inlineNodes(ts, cur, INLINE_CLOSE[t.type]);
          cur.i++; // the close token
          out.push({kind: INLINE_KIND[t.type] as 'strong', line, children});
          break;
        }
        case 'link_open': {
          const children = this.inlineNodes(ts, cur, 'link_close');
          cur.i++;
          out.push({
            kind: 'link',
            line,
            href: attr(t, 'href') ?? '',
            title: attr(t, 'title'),
            markup:
              t.markup === 'autolink' || t.markup === 'linkify'
                ? t.markup
                : 'inline',
            children,
          });
          break;
        }
        case 'code_inline':
          out.push({kind: 'code-inline', line, value: t.content});
          break;
        case 'image':
          out.push({
            kind: 'image',
            line,
            src: attr(t, 'src') ?? '',
            alt: plain(t.children),
            title: attr(t, 'title'),
          });
          break;
        case 'wikilink':
        case 'embed': {
          const m = t.meta as {
            file: string;
            anchor: string | null;
            alias: string | null;
          };
          out.push({kind: t.type, line, ...m});
          break;
        }
        case 'footnote_ref': {
          const m = t.meta as {id?: number; label?: string};
          if (m.label !== undefined) {
            out.push({kind: 'footnote-ref', line, label: m.label});
          } else {
            const body = this.env.footnotes?.list?.[m.id ?? -1]?.tokens ?? [];
            out.push({
              kind: 'inline-footnote',
              line,
              children: this.inlineNodes(body, {i: 0, line}),
            });
          }
          break;
        }
        case 'footnote_unclosed':
          out.push({kind: 'text', line, value: '^[', unclosedNote: true});
          break;
        case 'html_inline': {
          if (t.content.startsWith('<!--')) {
            out.push({kind: 'comment', line, value: t.content});
          } else {
            const tag = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)/.exec(t.content);
            out.push({
              kind: 'html-inline',
              line,
              name: (tag?.[2] ?? '').toLowerCase(),
              closing: tag?.[1] === '/',
              value: t.content,
            });
          }
          break;
        }
        default:
          break;
      }
    }
    return out;
  }
}
