// US-010 AC-3, AC-4, AC-7: the fonts that an export can use: the bundled fonts
// and the font files of the vault folder of the preset. The compiler tells
// which families and characters the files hold (`get_font_info`); the core
// decides what to do with that.
import type {Warning} from '../../core/emit';
import {
  createFontCatalog,
  fontArchiveIgnored,
  fontFileInvalid,
  fontFolderMissing,
  isFontArchive,
  isFontFile,
  isInFolder,
  type FaceInfo,
  type FontCatalog,
} from '../../core/fonts';

/** What an export needs of the fonts (AC-7). */
export interface FontSetResult {
  /** The families and characters that are available. */
  catalog: FontCatalog;
  /** The bytes of the vault fonts that can be read, sorted by path. */
  files: Uint8Array[];
  /** Folder, archive and file problems (line 0). */
  warnings: Warning[];
}

/** The fonts for the vault folder of a preset (null: no folder). */
export type FontSet = (folder: string | null) => Promise<FontSetResult>;

export interface FontSetDeps {
  /** The bundled font files (US-007 AC-13). */
  bundled: () => Promise<readonly Uint8Array[]>;
  vault: {
    /** Every file of the vault by path. */
    files(): string[];
    folderExists(path: string): Promise<boolean>;
    readBytes(path: string): Promise<Uint8Array>;
  };
  compiler: {
    fontInfo(fonts: readonly Uint8Array[]): Promise<(FaceInfo[] | null)[]>;
  };
}

const byPath = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * AC-3: reads `.ttf` and `.otf` files of the folder and below (zip files are
 * reported, not read); the bundled fonts are inspected once, the vault folder
 * on every call so that a font that was added is found.
 */
export function createFontSet(deps: FontSetDeps): FontSet {
  let bundledFaces: Promise<FaceInfo[]> | null = null;
  const bundled = (): Promise<FaceInfo[]> => {
    bundledFaces ??= (async () => {
      const files = await deps.bundled();
      const info = await deps.compiler.fontInfo(files);
      return info.flatMap((faces) => faces ?? []);
    })();
    bundledFaces.catch(() => {
      bundledFaces = null;
    });
    return bundledFaces;
  };

  return async (folder) => {
    const faces = [...(await bundled())];
    const warnings: Warning[] = [];
    const files: Uint8Array[] = [];
    if (folder !== null) {
      if (!(await deps.vault.folderExists(folder))) {
        warnings.push(fontFolderMissing(folder));
      } else {
        const inside = deps.vault.files().filter((p) => isInFolder(p, folder));
        for (const path of inside.filter(isFontArchive).sort(byPath)) {
          warnings.push(fontArchiveIgnored(path));
        }
        const paths = inside.filter(isFontFile).sort(byPath);
        const bytes: Uint8Array[] = [];
        for (const path of paths) bytes.push(await deps.vault.readBytes(path));
        const info = await deps.compiler.fontInfo(bytes);
        const invalid: string[] = [];
        paths.forEach((path, index) => {
          const found = info[index] ?? null;
          if (found === null) {
            invalid.push(path);
            return;
          }
          faces.push(...found);
          files.push(bytes[index] as Uint8Array);
        });
        for (const path of invalid) warnings.push(fontFileInvalid(path));
      }
    }
    return {catalog: createFontCatalog(faces), files, warnings};
  };
}
