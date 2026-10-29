// US-001: the inline emitter. Turns the inline nodes of a paragraph, heading
// or table cell into Typst. Pure: no Obsidian, Node, or I/O imports.
//
// Two steps (docs/tickets/TICKET-012-inline-emitter.md):
//  1. prepare: everything that reports or restructures. Pairs <u>/<span> by
//     nesting, drops comments and unsupported tags, turns nodes without an
//     emitter into text, removes empty marks, merges adjacent text (a marker
//     split by a dropped comment is then still one text) and trims breaks.
//  2. render: pure. Decides per mark whether the delimiter or the function form
//     is safe next to its real neighbours, tracks "at the start of a line" across
//     nesting so line markers are escaped, and puts the call separator between
//     a call and the text that follows it.
//
// Transforms used (all documented in the shared-utility register):
// escapeMarkup (call sites: paragraph/cell text atBlockStart true, heading text
// false, inside delimiter marks false, content of function forms true, after a
// break true), wrapEmphasis, rawInline, callSeparator, pageRefCall (US-018:
// after a selected internal link, moved behind every mark that ends with it).
import type {AssetResolver} from '../assets';
import {
  classifyHref,
  isNoteEmbed,
  resolveHeading,
  unescapeAddress,
  visibleText,
  wikilinkTarget,
  type HeadingIndex,
} from '../parse';
import type {InlineNode, LinkNode, WikilinkNode} from '../parse';
import {callSeparator} from './call';
import type {EmitContext} from './context';
import {wrapEmphasis} from './emphasis';
import {escapeMarkup} from './escape-markup';
import {footnoteCall, type NoteEnv} from './footnote';
import {emitImage, type AnyImageNode, type ImageFit} from './image';
import {pageRefCall, type PageRefEnv} from './page-refs';
import {rawInline} from './raw';
import {typstString} from './typst-string';

/** What the link emitter needs to know about the document (US-004). */
export interface LinkEnv {
  /** Labels of all headings (US-002), so a link can point forward. */
  headings: HeadingIndex;
  /** US-004 AC-1c: write the address of an external link in a footnote. */
  externalLinkFootnotes: boolean;
  /**
   * US-026 AC-8: labels of headings that are not written (an empty book part
   * left out); a link to one of them is unresolved. Default: none.
   */
  gone?: ReadonlySet<string>;
}

/** Where the inline content ends up (US-004 AC-6, AC-9). */
export type Where = 'body' | 'heading' | 'footnote';

/** Options of {@link emitInline}. */
export interface InlineOptions {
  /**
   * Converts links, wikilinks and note embeds (US-004). Without it they keep
   * their text and report `NODE_UNSUPPORTED`, as before US-004.
   */
  links?: LinkEnv;
  /**
   * Converts footnote references and inline notes (US-005). Without it they
   * keep their text and report `NODE_UNSUPPORTED`, as before US-005.
   */
  notes?: NoteEnv;
  /**
   * Converts images and image embeds (US-003). Without it they keep their alt
   * text and report `NODE_UNSUPPORTED`, as before US-003.
   */
  assets?: AssetResolver;
  /** `'heading'` and `'footnote'` change how an address is spelled out. */
  where?: Where;
  /** True (default) when the first text starts a block; false for headings. */
  atBlockStart?: boolean;
  /**
   * `'space'` writes every soft or hard break as one blank (none is doubled);
   * for headings, which cannot span lines in Typst (US-002 AC-4b).
   * `'call'` writes a hard break as `#linebreak()` and a soft break as one
   * blank; for table cells, which are one line (US-005 AC-2b).
   */
  breaks?: 'keep' | 'space' | 'call';
  /**
   * US-018 AC-2: writes `#page-ref(<label>)` after the internal links the rule
   * selects. Without it no call is written (today's output).
   */
  pageRefs?: PageRefEnv;
  /**
   * US-028 AC-2, AC-3: write the images that are pieces of this paragraph
   * itself (not inside a mark or a link) with the `fit-flow` call. Set only
   * for the paragraphs the rule applies to. Default: none (today's output).
   */
  fit?: InlineFit;
}

/**
 * US-028 | AC-3, AC-4 (decision 5): the fit of a paragraph's images.
 * `breakAfter` is true when the next top-level block starts with a written
 * page break: an image that is the paragraph's last piece then never floats.
 */
export interface InlineFit extends ImageFit {
  breakAfter: boolean;
}

type MarkKind = 'strong' | 'emph' | 'strike' | 'highlight' | 'underline';

interface Flag {
  /** The item ends in a link or address (forces the function form of marks). */
  address?: boolean;
}
type Item = Flag &
  (
    | {t: 'text'; value: string}
    | {t: 'code'; value: string}
    | {t: 'mark'; kind: MarkKind; items: Item[]}
    | {t: 'soft'}
    | {t: 'hard'}
    /** `#link(dest)` with an optional body (US-004). */
    | {t: 'link'; dest: string; body: Item[] | null}
    /**
     * Typst written as is, e.g. a footnote that follows a link. `ref` marks
     * the page-number call of US-018, which `clean` moves behind every mark
     * that ends with it.
     */
    | {t: 'raw'; value: string; call: boolean; ref?: true}
    /** An image, figure or placeholder: a block of its own (US-003 AC-1c). */
    | {t: 'block'; value: string}
  );
interface Env {
  links: LinkEnv | undefined;
  notes: NoteEnv | undefined;
  assets: AssetResolver | undefined;
  pageRefs: PageRefEnv | undefined;
  where: Where;
  /** US-028: set only for the pieces of the paragraph itself. */
  fit: InlineFit | undefined;
}
type Token = Item | {t: 'open' | 'close'; name: 'u' | 'span'; line: number};

const MARK_OF = {
  strong: 'strong',
  emph: 'emph',
  delete: 'strike',
  mark: 'highlight',
} as const;

// ---- step 1: prepare --------------------------------------------------------

/** The text a node without an emitter leaves in the output. */
function fallbackText(node: InlineNode): string {
  switch (node.kind) {
    case 'image':
      return node.alt;
    case 'wikilink':
      return (
        node.alias ??
        [node.file, node.anchor ?? ''].filter((p) => p !== '').join('#')
      );
    case 'embed':
      return [node.file, node.anchor ?? ''].filter((p) => p !== '').join('#');
    case 'footnote-ref':
      return `[${node.label}]`;
    default:
      return '';
  }
}

/** US-003: an image or an embed of a file (not a note embed). */
export function isImageNode(node: InlineNode): node is AnyImageNode {
  return (
    node.kind === 'image' || (node.kind === 'embed' && !isNoteEmbed(node.file))
  );
}

/** True when an image is somewhere in `nodes` (marks and links included). */
function containsImage(nodes: readonly InlineNode[]): boolean {
  return nodes.some(
    (node) =>
      isImageNode(node) ||
      ('children' in node &&
        Array.isArray(node.children) &&
        containsImage(node.children as InlineNode[])),
  );
}

/** Reports an unpaired or unsupported tag. */
function tagWarning(
  ctx: EmitContext,
  what: 'Unpaired' | 'Unsupported',
  closing: boolean,
  name: string,
  line: number,
): void {
  ctx.warn(
    'HTML_UNSUPPORTED',
    `${what} HTML tag <${closing ? '/' : ''}${name}> dropped`,
    line,
  );
}

/** The call that writes a footnote, or nothing when there is none. */
function noteTokens(call: string | null): Token[] {
  return call === null ? [] : [{t: 'raw', value: call, call: true}];
}

/** US-005 AC-4d: a footnote inside footnote text is omitted. */
function nestedNote(ctx: EmitContext, line: number): Token[] {
  ctx.warn('FOOTNOTE_NESTED', 'Footnote inside a footnote omitted', line);
  return [];
}

/**
 * US-028 | AC-3, AC-4: true when nothing after `from` in `nodes` writes text
 * (breaks, comments and blanks only), so the node before is the last piece.
 */
function restIsBlank(nodes: readonly InlineNode[], from: number): boolean {
  return nodes
    .slice(from)
    .every(
      (node) =>
        node.kind === 'softbreak' ||
        node.kind === 'break' ||
        node.kind === 'comment' ||
        (node.kind === 'text' && node.value.trim() === ''),
    );
}

/**
 * Turns one node into tokens; reports what it drops. US-028 AC-2: the fit
 * reaches an image that is this node itself, never the nodes inside it
 * (marks, links, notes get the environment without it). `last` is true when
 * the node is the paragraph's last piece (AC-4, decision 5).
 */
function tokensOf(
  node: InlineNode,
  ctx: EmitContext,
  outer: Env,
  last = false,
): Token[] {
  if (outer.assets !== undefined && isImageNode(node)) {
    const fit =
      outer.fit === undefined
        ? undefined
        : {
            min: outer.fit.min,
            sides: outer.fit.sides,
            floats: outer.fit.floats && !(last && outer.fit.breakAfter),
            reserve: outer.fit.reserve,
          };
    return [{t: 'block', value: emitImage(node, ctx, outer.assets, fit)}];
  }
  const env = outer.fit === undefined ? outer : {...outer, fit: undefined};
  if (env.notes !== undefined) {
    if (node.kind === 'footnote-ref') {
      const nested = env.where === 'footnote';
      const call = env.notes.reference(
        node.label,
        node.line,
        nested,
        env.pageRefs?.inExplanation === true,
      );
      return nested ? nestedNote(ctx, node.line) : noteTokens(call);
    }
    if (node.kind === 'inline-footnote') {
      if (env.where === 'footnote') return nestedNote(ctx, node.line);
      const body = emitInline(node.children, ctx, {
        links: env.links,
        notes: env.notes,
        assets: env.assets,
        where: 'footnote',
        pageRefs: env.pageRefs,
      });
      return noteTokens(footnoteCall(body));
    }
  }
  switch (node.kind) {
    case 'text':
      if (node.unclosedNote === true) {
        ctx.warn('FOOTNOTE_UNCLOSED', 'Unclosed ^[ kept as text', node.line);
      }
      return [{t: 'text', value: node.value}];
    case 'code-inline':
      return [{t: 'code', value: node.value}];
    case 'strong':
    case 'emph':
    case 'delete':
    case 'mark':
      return [
        {
          t: 'mark',
          kind: MARK_OF[node.kind],
          items: prepare(node.children, ctx, env),
        },
      ];
    case 'softbreak':
      return [{t: 'soft'}];
    case 'break':
      return [{t: 'hard'}];
    case 'comment':
      ctx.commentDropped(node.line);
      return [];
    case 'html-inline': {
      if (node.name === '') return [{t: 'text', value: node.value}];
      if (node.name === 'u' || node.name === 'span') {
        return [
          {
            t: node.closing ? 'close' : 'open',
            name: node.name,
            line: node.line,
          },
        ];
      }
      if (node.name === 'br') {
        if (!node.closing) return [{t: 'hard'}];
        tagWarning(ctx, 'Unpaired', true, 'br', node.line);
        return [];
      }
      tagWarning(ctx, 'Unsupported', node.closing, node.name, node.line);
      return [];
    }
    case 'link':
      if (env.links !== undefined) return linkTokens(node, ctx, env, env.links);
    // Without a link environment a link keeps its text, like before US-004.
    // falls through
    case 'inline-footnote': {
      ctx.warn(
        'NODE_UNSUPPORTED',
        `No emitter for ${node.kind}; its text is kept`,
        node.line,
      );
      const items = prepare(node.children, ctx, env);
      const last = items.at(-1);
      if (node.kind === 'link' && last !== undefined) last.address = true;
      return items;
    }
    case 'wikilink':
      if (env.links !== undefined) {
        return wikilinkTokens(node, ctx, env.links, env);
      }
    // falls through
    default: {
      if (
        node.kind === 'embed' &&
        env.links !== undefined &&
        isNoteEmbed(node.file)
      ) {
        ctx.warn(
          'EMBED_NOTE_UNEXPANDED',
          `Note embed "!${wikilinkSource(node)}" is not expanded`,
          node.line,
        );
        const text = fallbackText(node);
        return text === '' ? [] : [{t: 'text', value: text}];
      }
      ctx.warn(
        'NODE_UNSUPPORTED',
        `No emitter for ${node.kind}; its text is kept`,
        node.line,
      );
      const value = fallbackText(node);
      return value === '' ? [] : [{t: 'text', value}];
    }
  }
}

/** `[[file#anchor|alias]]` as the author wrote it. */
function wikilinkSource(node: WikilinkNode): string {
  const anchor = node.anchor === null ? '' : `#${node.anchor}`;
  const alias = node.alias === null ? '' : `|${node.alias}`;
  return `[[${node.file}${anchor}${alias}]]`;
}

/**
 * US-004 AC-2, AC-3, AC-4, AC-8, AC-8b, AC-10: an internal link. The first
 * heading the resolver finds is the target; `body` is converted only once.
 */
function internalLink(
  original: string,
  target: string | null,
  body: () => Item[],
  line: number,
  ctx: EmitContext,
  links: LinkEnv,
  env: Env,
): Token[] {
  const found = target === null ? null : resolveHeading(target, links.headings);
  const items = body();
  // US-026 AC-8: a heading that is not written is no target.
  const matches = (found?.matches ?? []).filter(
    (match) => links.gone?.has(match.label) !== true,
  );
  const first = matches[0];
  if (first === undefined) {
    ctx.warn('LINK_UNRESOLVED', `No heading matches "${original}"`, line);
    return items;
  }
  if (matches.length > 1) {
    ctx.warn(
      'LINK_AMBIGUOUS',
      `"${original}" matches ${matches.length} headings; the first is used`,
      line,
    );
  }
  const shown: Item[] =
    items.length > 0 ? items : [{t: 'text', value: first.text}];
  const link: Token = {t: 'link', dest: `<${first.label}>`, body: shown};
  return withPageRef(link, first.label, first.depth, env);
}

/**
 * US-018 | AC-2: `link` followed by its page-number call when the rule
 * selects it: page references are on (`env.pageRefs`), the link is not in a
 * heading (a term heading included: it is emitted with `where: 'heading'`),
 * and its target's level is at most the level or the link is in a glossary
 * explanation. Records every call written.
 */
function withPageRef(
  link: Token,
  label: string,
  depth: number,
  env: Env,
): Token[] {
  const refs = env.pageRefs;
  if (
    refs === undefined ||
    env.where === 'heading' ||
    (depth > refs.level && !refs.inExplanation)
  ) {
    return [link];
  }
  refs.record();
  return [link, {t: 'raw', value: pageRefCall(label), call: true, ref: true}];
}

/** US-004 AC-2: a wikilink. The text is the alias, else the target. */
function wikilinkTokens(
  node: WikilinkNode,
  ctx: EmitContext,
  links: LinkEnv,
  env: Env,
): Token[] {
  const shown =
    node.alias ??
    (node.anchor !== null && node.anchor !== ''
      ? (node.anchor.split('#').pop() ?? '')
      : node.file);
  return internalLink(
    wikilinkSource(node),
    wikilinkTarget(node),
    () => (shown === '' ? [] : [{t: 'text', value: shown}]),
    node.line,
    ctx,
    links,
    env,
  );
}

/** What follows the text of a link that spells out `what` (AC-1, AC-6, AC-9). */
function spelled(where: Where, inNote: string, inText: string): Item[] {
  if (where === 'heading') return [];
  return where === 'body'
    ? [{t: 'raw', value: `#footnote[${inNote}]`, call: true}]
    : [{t: 'raw', value: ` (${inText})`, call: false}];
}

/**
 * US-004 AC-1 to AC-1f, AC-6: an external link. The address is spelled out
 * unless the text is the address, the link is an autolink or a bare address,
 * the switch is off, or the link is in a heading (which reports it).
 */
function externalLink(
  node: LinkNode,
  ctx: EmitContext,
  env: Env,
  links: LinkEnv,
): Token[] {
  const bare = node.markup === 'linkify';
  const href = bare ? unescapeAddress(node.href) : node.href;
  const children = bare
    ? node.children.map((c) =>
        c.kind === 'text' ? {...c, value: unescapeAddress(c.value)} : c,
      )
    : node.children;
  const text = visibleText(children);
  const same = text === href.replace(/^(mailto|tel):/i, '');
  const plain = children.every((c) => c.kind === 'text');
  // US-003 AC-1d: the text of a link around an image is the image.
  const image = env.assets !== undefined && containsImage(children);
  const body =
    !image && (text === '' || (same && plain))
      ? null
      : prepare(children, ctx, env);
  const out: Token[] = [{t: 'link', dest: typstString(href), body}];
  const spell =
    node.markup === 'inline' &&
    !image &&
    text !== '' &&
    !same &&
    links.externalLinkFootnotes;
  if (spell && env.where === 'heading') {
    ctx.warn(
      'LINK_URL_NOT_SPELLED',
      `Address of "${href}" is not spelled out in a heading`,
      node.line,
    );
  } else if (spell) {
    const address = `#link(${typstString(href)})`;
    out.push(...spelled(env.where, address, address));
  }
  return out;
}

/** US-004 AC-1 to AC-9: a Markdown link, by the kind of its address. */
function linkTokens(
  node: LinkNode,
  ctx: EmitContext,
  env: Env,
  links: LinkEnv,
): Token[] {
  const target = classifyHref(node.href);
  const body = () => prepare(node.children, ctx, env);
  switch (target.kind) {
    case 'empty':
      ctx.warn('LINK_UNRESOLVED', 'Link without target', node.line);
      return body();
    case 'anchor':
    case 'note':
      return internalLink(
        node.href,
        target.target,
        body,
        node.line,
        ctx,
        links,
        env,
      );
    case 'external':
      return externalLink(node, ctx, env, links);
    case 'file': {
      const path = escapeMarkup(target.path, {atBlockStart: false});
      const note = links.externalLinkFootnotes
        ? spelled(env.where, path, path)
        : [];
      return [...body(), ...note];
    }
  }
}

/** Pairs <u>/<span> tokens by nesting; reports the tags that do not pair. */
function pair(tokens: readonly Token[], ctx: EmitContext): Item[] {
  interface Frame {
    name: 'u' | 'span' | null;
    line: number;
    items: Item[];
  }
  const stack: Frame[] = [{name: null, line: 0, items: []}];
  const top = (): Frame => stack[stack.length - 1] as Frame;
  /** Dissolves the top frame into its parent, reporting its open tag. */
  const dissolve = (): void => {
    const frame = stack.pop() as Frame;
    tagWarning(ctx, 'Unpaired', false, frame.name as string, frame.line);
    top().items.push(...frame.items);
  };
  for (const token of tokens) {
    if (token.t === 'open') {
      stack.push({name: token.name, line: token.line, items: []});
    } else if (token.t === 'close') {
      let k = stack.length - 1;
      while (k > 0 && (stack[k] as Frame).name !== token.name) k--;
      if (k === 0) {
        tagWarning(ctx, 'Unpaired', true, token.name, token.line);
        continue;
      }
      while (stack.length - 1 > k) dissolve();
      const frame = stack.pop() as Frame;
      if (frame.name === 'u') {
        top().items.push({t: 'mark', kind: 'underline', items: frame.items});
      } else {
        top().items.push(...frame.items);
      }
    } else {
      // Only open and close are tags; the checks above leave an Item.
      top().items.push(token as Item);
    }
  }
  while (stack.length > 1) dissolve();
  return (stack[0] as Frame).items;
}

/**
 * Merges adjacent text, drops empty marks, collapses and trims breaks.
 * US-018 AC-5: a page-number call that ends a mark is moved behind the mark,
 * so it ends behind every mark that ends with its link.
 */
function clean(items: readonly Item[]): Item[] {
  const out: Item[] = [];
  for (const item of items) {
    const last = out.at(-1);
    if (item.t === 'mark') {
      const inner = clean(item.items);
      const tail = inner.at(-1);
      const ref = tail?.t === 'raw' && tail.ref === true ? tail : undefined;
      if (ref !== undefined) inner.pop();
      if (inner.length > 0) out.push({...item, items: inner});
      if (ref !== undefined) out.push(ref);
    } else if (item.t === 'text') {
      if (item.value === '') continue;
      if (last?.t === 'text') {
        out[out.length - 1] = {
          t: 'text',
          value: last.value + item.value,
          address: item.address,
        };
      } else {
        out.push(item);
      }
    } else if (item.t === 'soft') {
      if (last?.t !== 'soft' && last?.t !== 'hard') out.push(item);
    } else {
      out.push(item);
    }
  }
  while (out[0]?.t === 'soft' || out[0]?.t === 'hard') out.shift();
  while (out.at(-1)?.t === 'soft' || out.at(-1)?.t === 'hard') out.pop();
  return isolateBlocks(out);
}

/**
 * US-003 AC-1c: a block (image) stands on its own, so the breaks and blanks
 * next to it are dropped; the text before and after it becomes its own
 * paragraph.
 */
function isolateBlocks(items: readonly Item[]): Item[] {
  const out: Item[] = [];
  let after = false;
  for (const item of items) {
    if (item.t === 'block') {
      for (;;) {
        const last = out.at(-1);
        if (last?.t === 'soft' || last?.t === 'hard') {
          out.pop();
        } else if (last?.t === 'text' && last.value.trimEnd() !== last.value) {
          const value = last.value.trimEnd();
          out.pop();
          if (value !== '') out.push({...last, value});
          if (value !== '') break;
        } else {
          break;
        }
      }
      out.push(item);
      after = true;
      continue;
    }
    if (after && (item.t === 'soft' || item.t === 'hard')) continue;
    if (after && item.t === 'text') {
      const value = item.value.trimStart();
      if (value === '') continue;
      out.push({...item, value});
    } else {
      out.push(item);
    }
    after = false;
  }
  return out;
}

/** True when an image is somewhere in the prepared items. */
function hasBlock(items: readonly Item[]): boolean {
  return items.some(
    (item) =>
      item.t === 'block' ||
      (item.t === 'mark' && hasBlock(item.items)) ||
      (item.t === 'link' && item.body !== null && hasBlock(item.body)),
  );
}

/**
 * US-001 AC-9, AC-9b, AC-9c, AC-15 | US-015 AC-12: step 1 for one list of
 * sibling nodes. Reports into `ctx`; the result is only text, code, marks and
 * breaks. Never changes `nodes`.
 */
function prepare(
  nodes: readonly InlineNode[],
  ctx: EmitContext,
  env: Env,
): Item[] {
  return clean(
    pair(
      nodes.flatMap((n, i) =>
        tokensOf(
          n,
          ctx,
          env,
          env.fit !== undefined && restIsBlank(nodes, i + 1),
        ),
      ),
      ctx,
    ),
  );
}

/** US-002 AC-4b: every break becomes one blank, unless a blank is already there. */
function breaksToSpaces(items: readonly Item[]): Item[] {
  const out: Item[] = [];
  let trimNext = false;
  items.forEach((item, i) => {
    if (item.t === 'soft' || item.t === 'hard') {
      const last = out.at(-1);
      const next = items[i + 1];
      const blankBefore = last?.t === 'text' && /\s$/.test(last.value);
      const blankAfter = next?.t === 'text' && /^\s/.test(next.value);
      if (!blankBefore && !blankAfter) out.push({t: 'text', value: ' '});
      // A blank on both sides stays one blank.
      trimNext = blankBefore && blankAfter;
    } else if (item.t === 'text' && trimNext) {
      trimNext = false;
      out.push({...item, value: item.value.replace(/^\s+/, '')});
    } else if (item.t === 'mark') {
      trimNext = false;
      out.push({...item, items: breaksToSpaces(item.items)});
    } else if (item.t === 'link') {
      trimNext = false;
      out.push({
        ...item,
        body: item.body === null ? null : breaksToSpaces(item.body),
      });
    } else {
      trimNext = false;
      out.push(item);
    }
  });
  return clean(out);
}

/** US-005 AC-2b: a hard break is `#linebreak()`, a soft break one blank. */
function breaksToCalls(items: readonly Item[]): Item[] {
  return items.map((item): Item => {
    switch (item.t) {
      case 'hard':
        return {t: 'raw', value: '#linebreak()', call: true};
      case 'soft':
        return {t: 'text', value: ' '};
      case 'mark':
        return {...item, items: breaksToCalls(item.items)};
      case 'link':
        return {
          ...item,
          body: item.body === null ? null : breaksToCalls(item.body),
        };
      default:
        return item;
    }
  });
}

// ---- step 2: render ---------------------------------------------------------

interface State {
  /** True when the next output character starts a line (or a content block). */
  lineStart: boolean;
}
interface Rendered {
  out: string;
  /** True when `out` ends with an embedded call. */
  call: boolean;
}

const WRAP_CALL: Record<Exclude<MarkKind, 'strong' | 'emph'>, string> = {
  strike: '#strike[',
  highlight: '#highlight[',
  underline: '#underline[',
};

/** True when the last non-empty descendant is a link or address. */
function endsInAddress(items: readonly Item[]): boolean {
  const last = items.at(-1);
  if (last === undefined) return false;
  if (last.address === true) return true;
  return last.t === 'mark' && endsInAddress(last.items);
}

/** First character of the output that `item` will produce, '' at the end. */
function firstOutChar(item: Item | undefined): string {
  if (item === undefined) return '';
  switch (item.t) {
    case 'text':
      return (
        Array.from(escapeMarkup(item.value, {atBlockStart: false}))[0] ?? ''
      );
    case 'code':
      return '`';
    case 'mark':
      return '#';
    case 'soft':
      return '\n';
    case 'hard':
      return '\\';
    case 'link':
      return '#';
    case 'raw':
      return item.value[0] ?? '';
    case 'block':
      return '#';
  }
}

/** The last code point of `text`, '' for an empty text; does not copy it. */
function lastChar(text: string): string {
  let start = text.length - 1;
  if (start > 0) {
    const low = text.charCodeAt(start);
    const high = text.charCodeAt(start - 1);
    if (low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff) {
      start -= 1;
    }
  }
  return start < 0 ? '' : text.slice(start);
}

/** Renders the content of a function-form call (a block start). */
function renderBlock(items: readonly Item[]): string {
  return renderItems(items, {lineStart: true}).out;
}

/**
 * US-001 AC-1, AC-2, AC-2b, AC-9: renders one mark. Strong and emphasis use
 * the delimiter form only when `wrapEmphasis` finds the real neighbours safe
 * and the content does not start or end with a blank; the content is then
 * rendered as not at a line start (right after the delimiter). Every other
 * form is a call whose content starts as a block.
 */
function renderMark(
  item: Item & {t: 'mark'},
  prev: string,
  next: string,
  state: State,
): Rendered {
  if (
    (item.kind === 'strong' || item.kind === 'emph') &&
    hasBlock(item.items)
  ) {
    // US-003 AC-1c: a mark around an image uses the function form.
    state.lineStart = false;
    return {out: `#${item.kind}[${renderBlock(item.items)}]`, call: true};
  }
  if (item.kind !== 'strong' && item.kind !== 'emph') {
    state.lineStart = false;
    return {
      out: `${WRAP_CALL[item.kind]}${renderBlock(item.items)}]`,
      call: true,
    };
  }
  const delimited = renderItems(item.items, {lineStart: false}).out;
  const wrapped = wrapEmphasis(item.kind, delimited, {
    prev,
    next,
    endsWithAddress: endsInAddress(item.items),
  });
  state.lineStart = false;
  if (wrapped.startsWith('#') || /^\s|\s$/.test(delimited)) {
    return {out: `#${item.kind}[${renderBlock(item.items)}]`, call: true};
  }
  return {out: wrapped, call: false};
}

/**
 * US-001 AC-1 to AC-4b, AC-8, AC-8c | US-013 AC-13: step 2 for one list of
 * prepared items. `state.lineStart` flows through the list and its nested
 * content; a call is followed by `callSeparator` of the next output.
 */
function renderItems(items: readonly Item[], state: State): Rendered {
  let out = '';
  let call = false;
  let afterBlock = false;
  items.forEach((item, index) => {
    let piece: Rendered;
    switch (item.t) {
      case 'block':
        state.lineStart = true;
        piece = {out: item.value, call: false};
        break;
      case 'text': {
        const text = escapeMarkup(item.value, {atBlockStart: state.lineStart});
        if (text.trim() !== '') state.lineStart = false;
        piece = {out: text, call: false};
        break;
      }
      case 'code': {
        const code = rawInline(item.value);
        state.lineStart = false;
        piece = {out: code, call: code.startsWith('#raw(')};
        break;
      }
      case 'soft':
        state.lineStart = true;
        piece = {out: '\n', call: false};
        break;
      case 'hard':
        state.lineStart = true;
        piece = {out: '\\\n', call: false};
        break;
      case 'link': {
        const body = item.body === null ? '' : `[${renderBlock(item.body)}]`;
        state.lineStart = false;
        piece = {out: `#link(${item.dest})${body}`, call: true};
        break;
      }
      case 'raw':
        state.lineStart = false;
        piece = {out: item.value, call: item.call};
        break;
      case 'mark':
        piece = renderMark(
          item,
          lastChar(out),
          firstOutChar(items[index + 1]),
          state,
        );
        break;
    }
    if (piece.out !== '' && out !== '' && (afterBlock || item.t === 'block')) {
      // A block is its own paragraph: a blank line before and after it.
      out += '\n\n';
    } else if (call) {
      out += callSeparator(piece.out);
    }
    out += piece.out;
    call = piece.call;
    afterBlock = item.t === 'block';
  });
  return {out, call};
}

/**
 * US-001 (inline part of AC-1 to AC-15) | US-015 AC-12: Typst for the inline
 * nodes of one paragraph, heading or table cell.
 *
 * Reports dropped or unsupported markup into `ctx` and keeps the text of every
 * node. Assumes `nodes` come from `parse` (US-014). Never changes `nodes`;
 * the same input gives the same output.
 */
export function emitInline(
  nodes: readonly InlineNode[],
  ctx: EmitContext,
  options: InlineOptions = {},
): string {
  const env: Env = {
    links: options.links,
    notes: options.notes,
    assets: options.assets,
    pageRefs: options.pageRefs,
    where: options.where ?? 'body',
    fit: options.fit,
  };
  const prepared = prepare(nodes, ctx, env);
  const items =
    options.breaks === 'space'
      ? breaksToSpaces(prepared)
      : options.breaks === 'call'
        ? breaksToCalls(prepared)
        : prepared;
  return renderItems(items, {lineStart: options.atBlockStart ?? true}).out;
}
