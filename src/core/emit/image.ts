// US-003: the image emitter. Turns an image node into the Typst call of one
// block: a figure, an image, or the red placeholder. Pure: no Obsidian, Node,
// or I/O imports; files are only asked about through the injected resolver.
//
// Transforms used (shared-utility register): escapeMarkup (caption and
// placeholder text), typstString (paths; US-028 the name as written).
import {
  extensionOf,
  SUPPORTED_IMAGE_EXTENSIONS,
  type AssetRequest,
  type AssetResolver,
} from '../assets';
import type {ImageNode, WikilinkNode} from '../parse';
import type {EmitContext} from './context';
import {FIT_DECISION_LABEL} from './fit-label';
import {escapeMarkup} from './escape-markup';
import {typstString} from './typst-string';

/**
 * US-003 AC-2b: the helper that places an image at its natural size, never
 * wider than the available width, never taller than the available height, and
 * never enlarged. The pipeline writes it once into the preamble (US-015).
 */
export const FIT_IMAGE_HELPER = [
  '#let fit-image(path) = layout(size => {',
  '  let m = measure(image(path))',
  '  let w = calc.min(m.width, size.width)',
  '  let h = m.height * (w / m.width)',
  '  image(path, width: w * calc.min(1, size.height / h))',
  '})',
].join('\n');

/**
 * US-028 | AC-3, AC-6, AC-12: the arguments of one `#fit-flow(…)` call
 * besides the image's own. `min` is `images.minScale` / 100; `reserve` is
 * written as given (`8.75pt + 2.4em`) and left out when null (the top level
 * of the body and the colophon).
 */
export interface ImageFit {
  min: number;
  sides: boolean;
  floats: boolean;
  reserve: string | null;
}

/**
 * US-028 AC-3, AC-13 (decision 11): the zero-height block whose position the
 * helper reads. It keeps the normal space above it, as today's image does, so
 * the image does not overprint the last text line.
 */
const fitProbe = (label: string): string =>
  `#block(height: 0pt, below: 0pt, width: 100%)[] <${label}>`;

export {FIT_DECISION_LABEL};

/**
 * US-028 | AC-3, AC-4, AC-6, AC-7: the helper that keeps an image with its
 * text, as measured with the bundled Typst 0.14.2 (G1, G2 2026-10-28; the
 * G3 amendment 2026-10-29, scratch probe `g3028/probe.ts`). In `context` it
 * reads the probe's position (`at`) and the page: the text width from the
 * page at the top level, from `layout` in a container (`floats: false`);
 * the image's size (the Obsidian size scaled by one factor, never wider than
 * the text, never taller than the text height less the caption); the room
 * left below the probe less 0.5 pt and the resolved `reserve`. Full size
 * when it fits; shrunk to the room when that is at least `min` of it;
 * floated to the top of the next page when floats are allowed and the probe
 * is on an even page or `sides` is false; else moved (written as a block,
 * which goes to the next page). Each decision is recorded before the image
 * as `metadata((d, line, name))` with the label `o2t-fit-decision`, for
 * the warnings (AC-5). With `floats: false` the helper's output is one
 * full-width block with `above: 0pt` (written bare in a container, the
 * call's content got a paragraph's spacing on top); with `floats: true` it is
 * written bare, since a float inside that block stays in it and the text
 * after it no longer fills the gap (decision 12, C3 measured 2026-10-29). The
 * image or figure is a full-width block with `above: 0pt`, so the image
 * starts at the probe and a captioned figure is centred as today (AC-13,
 * decision 11). A floated figure carries the label `<probe label>-f`; when it
 * stands on the probe's page, the room gets back its height, caption and
 * clearance before the decision, so a float never confirms itself above its
 * own text (decision 13, F1 measured 2026-10-29).
 * Changed from the probe only by the call's `line` and `name` and the
 * decision's value and label (the probe's own `<img>` marker removed).
 */
export const FIT_FLOW_HELPER = [
  '#let fit-flow(path, at, line, name, min: 0.7, sides: true, floats: true, reserve: 0pt, caption: none, width: auto, height: auto) = {',
  '  let body = context {',
  '    let pos = locate(at).position()',
  '    let mg = page.margin',
  '    let side(k, alt) = mg.at(k, default: mg.at(alt, default: 0pt))',
  '    let tw = page.width - side("inside", "left").length - side("outside", "right").length',
  '    let th = page.height - mg.top.length - mg.bottom.length',
  '    let decide(cw) = {',
  '      let m = measure(image(path))',
  '      let w0 = if width == auto { m.width } else { width }',
  '      let h0 = if height == auto { m.height * (w0 / m.width) } else { height }',
  '      let w = calc.min(w0, cw)',
  '      let h = h0 * (w / w0)',
  '      let img(iw) = if height == auto { image(path, width: iw) } else { image(path, width: iw, height: h * (iw / w)) }',
  '      let fig(iw) = block(above: 0pt, width: 100%, if caption == none { block[#img(iw)] } else { figure([#img(iw)], caption: caption, numbering: none) })',
  '      let cap(iw) = if caption == none { 0pt } else { measure(fig(iw)).height - h * (iw / w) }',
  '      let s = calc.min(1, (th - cap(w)) / h)',
  '      w = w * s',
  '      h = h * s',
  '      let room = page.height - mg.bottom.length - pos.y - 0.5pt - reserve.to-absolute()',
  '      let own = query(label(str(at) + "-f")).filter(e => e.location().page() == pos.page).len() > 0',
  '      if own { room = room + h + cap(w) + 1em.to-absolute() }',
  `      let rec(d) = [#metadata((d: d, line: line, name: name)) <${FIT_DECISION_LABEL}>]`,
  '      if h + cap(w) <= room { rec("full"); fig(w) }',
  '      else if h * min + cap(w * min) <= room { let r = (room - cap(w)) / h; rec("shrink"); fig(w * r) }',
  '      else if floats and (not sides or calc.even(pos.page)) { rec("float"); place(top, float: true, clearance: 1em, [#fig(w) #label(str(at) + "-f")]) }',
  '      else { rec("move"); fig(w) }',
  '    }',
  '    if floats { decide(tw) } else { layout(size => decide(size.width)) }',
  '  }',
  '  if floats { body } else { block(above: 0pt, width: 100%, body) }',
  '}',
].join('\n');

/**
 * US-028 | AC-5 (decision 2): the warnings of the decisions read back after a
 * compile, in their order: `IMAGE_FLOATED` for `float`, `IMAGE_MOVED` for
 * `move`, at the image's source line; `full`, `shrink` and any other `d`
 * give none. A value of another shape (not an object, or without a whole
 * `line` and a text `name`) is ignored: a foreign label or an older engine
 * never makes a warning up. The name is shown as the note writes it (decision 9).
 */
export function fitDecisionWarnings(
  values: readonly unknown[],
): {code: string; message: string; line: number}[] {
  const out: {code: string; message: string; line: number}[] = [];
  for (const value of values) {
    if (typeof value !== 'object' || value === null) continue;
    const {d, line, name} = value as Record<string, unknown>;
    if (
      typeof line !== 'number' ||
      !Number.isInteger(line) ||
      typeof name !== 'string'
    ) {
      continue;
    }
    if (d === 'float') {
      out.push({
        code: 'IMAGE_FLOATED',
        message: `Image "${name}" did not fit after its text; placed at the top of the next page`,
        line,
      });
    } else if (d === 'move') {
      out.push({
        code: 'IMAGE_MOVED',
        message: `Image "${name}" did not fit after its text; moved to the next page, the space before it stays empty`,
        line,
      });
    }
  }
  return out;
}

type EmbedNode = WikilinkNode & {kind: 'embed'};

/** An image node of either kind (`![alt](path)` or `![[file|…]]`). */
export type AnyImageNode = ImageNode | EmbedNode;

interface Size {
  width: number;
  height: number | null;
}

/** US-003 AC-2c: `N` or `NxM` with whole numbers; null when not a size. */
function sizeOf(part: string): Size | null | 'ignored' {
  const match = /^(\d+)(?:x(\d+))?$/.exec(part);
  if (match === null) return null;
  const width = Number(match[1]);
  const height = match[2] === undefined ? null : Number(match[2]);
  return width > 0 && (height === null || height > 0)
    ? {width, height}
    : 'ignored';
}

/** Pixels to points (1 px = 0.75 pt), without trailing zeros. */
const points = (pixels: number): string =>
  `${Number((pixels * 0.75).toFixed(4))}pt`;

/** URL-decodes a path; a sequence that is not valid UTF-8 keeps it as written. */
function decode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** True for `scheme:` with at least two letters (a drive letter is a path). */
const isRemote = (path: string): boolean =>
  /^[A-Za-z][A-Za-z0-9+.-]+:/.test(path);

const PLACEHOLDER = (shown: string): string =>
  `rect(width: 100%, height: 4cm, stroke: 1pt + red)[Missing image: ${escapeMarkup(shown, {atBlockStart: false})}]`;

/**
 * US-003 | AC-2, AC-6 | US-022 AC-3: What the emitter asks the asset resolver
 * for `node`: the request, or why there is none — a remote address
 * (`![](https://…)`) or a type outside `SUPPORTED_IMAGE_EXTENSIONS`. An image's
 * path is URL-decoded first; an embed's file is taken as written. The one
 * place that decides which image nodes are vault files (SCAR-017).
 */
export function imageRequest(
  node: AnyImageNode,
):
  | {request: AssetRequest}
  | {refused: 'remote' | 'unsupported'; target: string} {
  const target = node.kind === 'image' ? decode(node.src) : node.file;
  if (node.kind === 'image' && isRemote(target)) {
    return {refused: 'remote', target};
  }
  if (!SUPPORTED_IMAGE_EXTENSIONS.includes(extensionOf(target))) {
    return {refused: 'unsupported', target};
  }
  return {
    request: {
      source: node.kind === 'image' ? 'image' : 'embed',
      target,
      line: node.line,
    },
  };
}

/**
 * US-003 AC-1 to AC-7: the Typst for one image, with its warnings reported
 * into `ctx`. Asks `assets` once for a file (never for a remote or an
 * unsupported type). The result is one block, written as `#...`.
 *
 * US-028 | AC-2, AC-3, AC-7: with `fit` a found image is written as two
 * lines, the probe and the `#fit-flow(…)` call (path, label, source line,
 * the link target as written, `min`, `sides`, `floats`, `reserve`, the
 * Obsidian size, the caption); a missing or refused image is written as
 * today (its placeholder). The label number is taken only for a call.
 */
export function emitImage(
  node: AnyImageNode,
  ctx: EmitContext,
  assets: AssetResolver,
  fit?: ImageFit,
): string {
  let target: string;
  let caption: string;
  let size: Size | null = null;
  let parts: string[];
  if (node.kind === 'image') {
    target = decode(node.src);
    const pieces = node.alt.split('|');
    caption = (pieces[0] ?? '').trim();
    parts = pieces.slice(1);
  } else {
    target = node.file;
    caption = '';
    parts = (node.alias ?? '').split('|');
  }
  let alt: string | null = null;
  for (const part of parts) {
    const found = sizeOf(part.trim());
    if (found === 'ignored') continue;
    if (found === null) {
      if (node.kind === 'embed' && alt === null && part.trim() !== '') {
        alt = part.trim();
      }
    } else if (size === null) {
      size = found;
    }
  }
  if (node.kind === 'embed') caption = alt ?? '';

  const place = (call: string): string => {
    if (caption === '') return `#${call}`;
    const text = escapeMarkup(caption, {atBlockStart: true});
    return `#figure(${call}, caption: [${text}], numbering: none)`;
  };
  const missing = (code: string, message: string): string => {
    ctx.warn(code, message, node.line);
    return place(PLACEHOLDER(target));
  };

  const asked = imageRequest(node);
  const extension = extensionOf(target);
  if ('refused' in asked && asked.refused === 'remote') {
    return missing('ASSET_REMOTE', `Remote image is not downloaded: ${target}`);
  }
  if ('refused' in asked) {
    return missing(
      'ASSET_TYPE_UNSUPPORTED',
      extension === ''
        ? `Image type is not supported: ${target}`
        : `Image type .${extension} is not supported: ${target}`,
    );
  }
  const result = assets.resolve(asked.request);
  if (result.status === 'missing') {
    return missing('ASSET_MISSING', `Image file not found: ${target}`);
  }
  if (result.status === 'invalid') {
    return missing(
      'ASSET_INVALID',
      `Image file is not a valid .${extension} image: ${target}`,
    );
  }
  if (result.status === 'ambiguous') {
    ctx.warn(
      'ASSET_AMBIGUOUS',
      `"${target}" matches ${result.count} files; the first is used`,
      node.line,
    );
  }
  const path = typstString(result.path);
  if (fit !== undefined) {
    const label = `o2t-fit-${ctx.nextFitLabel()}`;
    const args = [
      path,
      `<${label}>`,
      String(node.line),
      typstString(target),
      `min: ${fit.min}`,
      `sides: ${fit.sides}`,
      `floats: ${fit.floats}`,
    ];
    if (fit.reserve !== null) args.push(`reserve: ${fit.reserve}`);
    if (size !== null) {
      args.push(`width: ${points(size.width)}`);
      if (size.height !== null) args.push(`height: ${points(size.height)}`);
    }
    if (caption !== '') {
      args.push(`caption: [${escapeMarkup(caption, {atBlockStart: true})}]`);
    }
    return `${fitProbe(label)}\n#fit-flow(${args.join(', ')})`;
  }
  if (size === null) {
    ctx.markFitImagePlaced();
    return place(`fit-image(${path})`);
  }
  const dimensions = [`width: ${points(size.width)}`];
  if (size.height !== null) dimensions.push(`height: ${points(size.height)}`);
  return place(`image(${path}, ${dimensions.join(', ')})`);
}
