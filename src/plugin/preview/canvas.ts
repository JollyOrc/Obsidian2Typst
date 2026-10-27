// US-012 AC-7, AC-12: the one helper that makes a canvas, for the pages of the
// preview and for the scratch canvas of the image downsampler (SCAR-008: no
// other file creates a canvas). Every step logs to the console so that a blank
// or missing page leaves a trace on the tester's machine.
import {isBlankPage, nonWhiteShare} from '../../core/preview/canvas';

/** The longest side of a page canvas in pixels; larger pages are drawn smaller. */
export const MAX_CANVAS_SIDE = 8192;

const log = (text: string): void => console.log(`[o2t preview] ${text}`);

/** A canvas with its 2D context. */
export interface DrawingCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  /** The pixel size of the canvas. */
  readonly width: number;
  readonly height: number;
  /** Frees the pixels (size 0) and takes the canvas out of its parent. */
  release(): void;
}

function makeCanvas(width: number, height: number): DrawingCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (context === null) throw new Error('The preview needs a 2D canvas');
  return {
    canvas,
    context,
    width,
    height,
    release() {
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    },
  };
}

/**
 * US-012 AC-7: a canvas for a page of `widthPt` × `heightPt` points at
 * `pixelPerPt`, reduced so that the longest side is at most
 * `MAX_CANVAS_SIDE`. `pixelPerPt` of the result is what to draw with. The CSS
 * size is the page size in points and is set apart from the pixel size, so the
 * page keeps its shape.
 */
export function makePageCanvas(
  widthPt: number,
  heightPt: number,
  pixelPerPt: number,
): DrawingCanvas & {readonly pixelPerPt: number} {
  const longest = Math.max(widthPt, heightPt) * pixelPerPt;
  const effective =
    longest > MAX_CANVAS_SIDE
      ? (pixelPerPt * MAX_CANVAS_SIDE) / longest
      : pixelPerPt;
  const width = Math.max(1, Math.round(widthPt * effective));
  const height = Math.max(1, Math.round(heightPt * effective));
  const made = makeCanvas(width, height);
  made.canvas.style.width = '100%';
  made.canvas.style.aspectRatio = `${widthPt} / ${heightPt}`;
  log(`canvas ${width}×${height} px (${effective.toFixed(2)} px/pt)`);
  return Object.assign(made, {pixelPerPt: effective});
}

/** US-012 AC-12: the scratch canvas of the downsampler (not shown). */
export function makeScratchCanvas(
  width: number,
  height: number,
): DrawingCanvas {
  log(`scratch canvas ${width}×${height} px`);
  return makeCanvas(width, height);
}

/**
 * US-012 AC-7: the share of non-white pixels of a drawn page, logged for the
 * page; `blank` is true below the share of `isBlankPage`.
 */
export function inspectPage(
  page: number,
  drawn: DrawingCanvas,
): {share: number; blank: boolean} {
  const pixels = drawn.context.getImageData(0, 0, drawn.width, drawn.height);
  const share = nonWhiteShare(pixels.data);
  const blank = isBlankPage(pixels.data);
  log(
    `page ${page} drawn, ${(share * 100).toFixed(1)} % non-white${blank ? ' (blank)' : ''}`,
  );
  return {share, blank};
}
