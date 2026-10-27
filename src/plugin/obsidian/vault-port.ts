// US-008 AC-3, AC-5, AC-7: the preset store's port over the Obsidian vault.
// Notes are renamed and deleted through the file manager, so that links are
// updated and the user's "Deleted files" setting is respected. Nothing here
// modifies or permanently deletes an existing file.
import {
  TFile,
  TFolder,
  type App,
  type EventRef,
  type TAbstractFile,
} from 'obsidian';
import type {VaultEvent, VaultPort} from '../presets/store';

export function createVaultPort(app: App): VaultPort {
  const {vault} = app;
  const file = (path: string): TFile => {
    const found = vault.getFileByPath(path);
    if (found === null) throw new Error(`No such note: ${path}`);
    return found;
  };
  return {
    async folderExists(path) {
      return vault.getFolderByPath(path) !== null;
    },
    async createFolder(path) {
      let built = '';
      for (const part of path.split('/')) {
        built = built === '' ? part : `${built}/${part}`;
        if (vault.getFolderByPath(built) === null)
          await vault.createFolder(built);
      }
    },
    async listNotes(folder) {
      const found = vault.getFolderByPath(folder);
      if (found === null) return [];
      return found.children
        .filter((child): child is TFile => child instanceof TFile)
        .filter((child) => child.extension.toLowerCase() === 'md')
        .map((child) => child.path);
    },
    read: (path) => vault.read(file(path)),
    process: (path, change) => vault.process(file(path), change),
    async create(path, text) {
      await vault.create(path, text);
    },
    rename: (from, to) => app.fileManager.renameFile(file(from), to),
    trash: (path) => app.fileManager.trashFile(file(path)),
    watch(handler) {
      const refs: EventRef[] = [];
      const seen =
        (kind: 'create' | 'modify' | 'delete') => (changed: TAbstractFile) => {
          if (!(changed instanceof TFolder))
            handler({kind, path: changed.path});
        };
      refs.push(
        vault.on('create', seen('create')),
        vault.on('modify', seen('modify')),
        vault.on('delete', seen('delete')),
      );
      refs.push(
        vault.on('rename', (changed, oldPath) => {
          if (changed instanceof TFolder) return;
          const event: VaultEvent = {
            kind: 'rename',
            path: changed.path,
            oldPath,
          };
          handler(event);
        }),
      );
      return () => refs.forEach((ref) => vault.offref(ref));
    },
  };
}
