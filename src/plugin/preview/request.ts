// US-012 AC-10, AC-12, AC-13: what the preview hands to the compiler. Nothing
// here writes a file, copies an asset, shows a notice or takes the export lock:
// assets are read into memory under the paths the export would write.
import {extensionOf, type AssetUse} from '../../core/assets';
import {exportNames, type CompileRequest} from '../../core/compile';
import {compileFonts} from '../compile-fonts';
import {noteNameOf, prepareNote, type PrepareDeps} from '../prepare-note';

/** US-012 AC-12: the image types that are made smaller in the preview (not WebP). */
const SHRINKABLE = new Set(['png', 'jpg', 'jpeg']);

/** The fixed name of the template copy (US-007 `exportNames`). */
const TEMPLATE_PATH = exportNames('x').template;

export interface PreviewRequestInput {
  noteName: string;
  typ: string;
  uses: readonly AssetUse[];
  /** The text of the template copy, if one applies. */
  template: string | null;
  /** The font files for the compiler (see `compileFonts`). */
  fonts: readonly Uint8Array[];
  readAsset: (vaultPath: string) => Promise<Uint8Array>;
  /**
   * US-012 AC-12: a smaller copy of an image, or null to keep the bytes (small,
   * undecodable). Called for PNG and JPEG only (US-012 AC-12: WebP is never changed), with the extension in
   * lower case.
   */
  downsample: (
    bytes: Uint8Array,
    extension: string,
  ) => Promise<Uint8Array | null>;
}

/**
 * US-012 AC-10, AC-12: the compile request of a preview: the Typst text of the
 * export, each asset once under its export path (`use.to`), the template under
 * its fixed name, and the given fonts. Only the bytes of shrinkable images may
 * differ from the export; the text never does.
 */
export async function buildPreviewRequest(
  input: PreviewRequestInput,
): Promise<CompileRequest> {
  const names = exportNames(input.noteName);
  const files: Record<string, Uint8Array> = {};
  for (const use of input.uses) {
    if (use.to in files) continue;
    const bytes = await input.readAsset(use.from);
    const extension = extensionOf(use.to);
    const smaller = SHRINKABLE.has(extension)
      ? await input.downsample(bytes, extension)
      : null;
    files[use.to] = smaller ?? bytes;
  }
  if (input.template !== null) {
    files[TEMPLATE_PATH] = new TextEncoder().encode(input.template);
  }
  return {
    file: names.typ,
    source: input.typ,
    files,
    fonts: [...input.fonts],
  };
}

export interface PreviewOptions {
  downsample: PreviewRequestInput['downsample'];
  /** The bundled fonts (the export adds them in `main.ts`). */
  bundledFonts?: readonly Uint8Array[];
}

/**
 * US-012 AC-10, AC-11, AC-13: prepares the note at `path` for a preview with the
 * same preparation as the export. A refusal (presets folder, no preset, invalid
 * preset) and a strict-mode stop (US-006 AC-4) are returned as `error`; the
 * warning count is that of the conversion.
 */
export async function preparePreview(
  deps: PrepareDeps,
  path: string,
  options: PreviewOptions,
): Promise<
  | {ok: true; request: CompileRequest; warnings: number}
  | {ok: false; error: string}
> {
  const prepared = await prepareNote(deps, path);
  if (!prepared.ok) return {ok: false, error: prepared.message};
  const count = prepared.warnings.length;
  if (deps.settings.data.strictMode && count > 0) {
    return {
      ok: false,
      error: `Preview stopped: ${count} ${count === 1 ? 'warning' : 'warnings'} (strict mode)`,
    };
  }
  const request = await buildPreviewRequest({
    noteName: noteNameOf(path),
    typ: prepared.typ,
    uses: prepared.uses,
    template: prepared.template,
    fonts: compileFonts(options.bundledFonts ?? [], prepared.fonts),
    readAsset: deps.vault.readBytes,
    downsample: options.downsample,
  });
  return {ok: true, request, warnings: count};
}
