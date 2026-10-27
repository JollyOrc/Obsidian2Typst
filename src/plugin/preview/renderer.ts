// US-012 AC-7, AC-13: the page renderer over the renderer WASM of typst.ts.
//
// Read first (SCAR-008), `@myriaddreamin/typst-ts-renderer` 0.7.0
// (`pkg/typst_ts_renderer.d.ts`) and `typst.ts/dist/esm/renderer.mjs`:
// - `init({module_or_path})` takes the WASM bytes; `new TypstRendererBuilder()
//   .build()` gives a `TypstRenderer`.
// - `TypstRenderer.session_from_artifact(bytes, 'vector')` makes a
//   `RenderSession`; its `pages_info` has `page_count` and `page(i)` (from 0)
//   with `page_off`, `width_pt`, `height_pt`. `session.free()` releases it.
// - `render_page_to_canvas(session, canvas, options)` draws one page; `canvas`
//   may be the 2D context (spike S8); `RenderPageImageOptions` has `page_off`
//   (required), `pixel_per_pt` (default 3) and `background_color`.
// - The wrapper of typst.ts passes `page_off` of the page info, as done here.
import init, {
  RenderPageImageOptions,
  TypstRendererBuilder,
  type TypstRenderer,
} from '@myriaddreamin/typst-ts-renderer';

/** One compiled document in the renderer. */
export interface RenderedDocument {
  readonly pageCount: number;
  /** The size of page `page` (from 1) in points. */
  pageSize(page: number): {width: number; height: number};
  /** Draws page `page` (from 1) into `context` at `pixelPerPt`. */
  draw(
    page: number,
    context: CanvasRenderingContext2D,
    pixelPerPt: number,
  ): Promise<void>;
  /** Frees the document (US-012 AC-8); drawing afterwards is an error. */
  dispose(): void;
}

export interface PageRenderer {
  /** Reads a vector document (the result of `compileVector`). */
  open(vector: Uint8Array): Promise<RenderedDocument>;
}

export interface PageRendererOptions {
  /** The renderer WASM; read on the first use (the caller caches it). */
  rendererWasm: () => Promise<Uint8Array>;
}

/** US-012 AC-7: the renderer; the WASM is loaded on the first `open`. */
export function createPageRenderer(options: PageRendererOptions): PageRenderer {
  let pending: Promise<TypstRenderer> | null = null;
  const renderer = (): Promise<TypstRenderer> => {
    if (pending === null) {
      pending = (async () => {
        await init({module_or_path: await options.rendererWasm()});
        return new TypstRendererBuilder().build();
      })();
      pending.catch(() => {
        pending = null;
      });
    }
    return pending;
  };

  return {
    async open(vector) {
      const typst = await renderer();
      const session = typst.session_from_artifact(vector, 'vector');
      const info = session.pages_info;
      const pageCount = info.page_count;
      let freed = false;
      const page = (number: number) => {
        if (freed) throw new Error('The preview document was released');
        if (!Number.isInteger(number) || number < 1 || number > pageCount) {
          throw new Error(`The document has no page ${number}`);
        }
        return info.page(number - 1);
      };
      return {
        pageCount,
        pageSize(number) {
          const found = page(number);
          return {width: found.width_pt, height: found.height_pt};
        },
        async draw(number, context, pixelPerPt) {
          const found = page(number);
          const draw = new RenderPageImageOptions();
          draw.page_off = found.page_off;
          draw.pixel_per_pt = pixelPerPt;
          draw.background_color = '#ffffff';
          await typst.render_page_to_canvas(session, context, draw);
        },
        dispose() {
          if (freed) return;
          freed = true;
          session.free();
        },
      };
    },
  };
}
