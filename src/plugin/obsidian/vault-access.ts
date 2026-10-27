// US-008 AC-15: the open note and the files of the vault, for the export
// command. Reads only; nothing here changes a file.
import {TFile, type App} from 'obsidian';
import type {ExportCommandDeps} from '../export-command';
import type {FontSetDeps} from '../fonts';

/** The open Markdown note. */
export function createNoteSource(app: App): ExportCommandDeps['notes'] {
  return {
    activePath() {
      const file = app.workspace.getActiveFile();
      return file !== null && file.extension.toLowerCase() === 'md'
        ? file.path
        : null;
    },
    read(path) {
      const file = app.vault.getFileByPath(path);
      if (file === null)
        return Promise.reject(new Error(`No such note: ${path}`));
      return app.vault.read(file);
    },
  };
}

/** The files of the vault: names, heads, bytes and text. */
export function createVaultFiles(app: App): ExportCommandDeps['vault'] {
  const file = (path: string): TFile => {
    const found = app.vault.getFileByPath(path);
    if (found === null) throw new Error(`No such file: ${path}`);
    return found;
  };
  const bytes = async (path: string): Promise<Uint8Array> =>
    new Uint8Array(await app.vault.readBinary(file(path)));
  return {
    files: () => app.vault.getFiles().map((f) => f.path),
    readHead: async (path, length = 16) =>
      (await bytes(path)).subarray(0, length),
    readBytes: bytes,
    async readText(path) {
      const found = app.vault.getFileByPath(path);
      return found === null ? null : app.vault.read(found);
    },
  };
}

/** US-010 AC-3: the vault as the font set reads it. */
export function createFontVault(app: App): FontSetDeps['vault'] {
  const files = createVaultFiles(app);
  return {
    files: files.files,
    readBytes: files.readBytes,
    folderExists: async (path) => app.vault.getFolderByPath(path) !== null,
  };
}
