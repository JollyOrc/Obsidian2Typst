// US-003: the image emitter. Turns an image node into the Typst call of one
// block: a figure, an image, or the red placeholder. Pure: no Obsidian, Node,
// or I/O imports; files are only asked about through the injected resolver.
//
// Transforms used (shared-utility register): escapeMarkup (caption and
// placeholder text), typstString (paths).
import {
  extensionOf,
  SUPPORTED_IMAGE_EXTENSIONS,
  type AssetRequest,
  type AssetResolver,
} from '../assets';
import type {ImageNode, WikilinkNode} from '../parse';
import type {EmitContext} from './context';
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
 */
export function emitImage(
  node: AnyImageNode,
  ctx: EmitContext,
  assets: AssetResolver,
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
  if (size === null) {
    ctx.markFitImagePlaced();
    return place(`fit-image(${path})`);
  }
  const dimensions = [`width: ${points(size.width)}`];
  if (size.height !== null) dimensions.push(`height: ${points(size.height)}`);
  return place(`image(${path}, ${dimensions.join(', ')})`);
}
