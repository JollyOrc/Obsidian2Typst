// US-010 AC-3: the warnings about the font folder and its files, and the rule
// for which files are fonts. Pure core: the plugin reads the vault and calls
// these.
import type {Warning} from '../emit';

/** AC-3: `.ttf` and `.otf` files, any case of the extension. */
export const isFontFile = (path: string): boolean => /\.(ttf|otf)$/i.test(path);

/** AC-3: zip files are reported and not read. */
export const isFontArchive = (path: string): boolean => /\.zip$/i.test(path);

/** True when `path` is in `folder` or below it (`Fonts` is not `Fonts2`). */
export function isInFolder(path: string, folder: string): boolean {
  const base = folder.replace(/\/+$/, '');
  return base === '' || path.startsWith(`${base}/`);
}

export const fontFolderMissing = (folder: string): Warning => ({
  code: 'FONT_FOLDER_MISSING',
  message: `Font folder not found: ${folder}`,
  line: 0,
});

export const fontArchiveIgnored = (path: string): Warning => ({
  code: 'FONT_ARCHIVE_IGNORED',
  message: `Font archive ignored, unzip it first: ${path}`,
  line: 0,
});

export const fontFileInvalid = (path: string): Warning => ({
  code: 'FONT_FILE_INVALID',
  message: `Font file cannot be read: ${path}`,
  line: 0,
});
