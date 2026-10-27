// US-007 AC-1, US-006 AC-2b: what an export run writes. The export folder is on
// disk (Node's file system, below the folder only); the warnings note is a
// note of the vault, created or replaced as a whole. Preset notes are never
// written here.
import {Notice, type App} from 'obsidian';
import type {DiskWriter} from '../disk-writer';
import type {RunExportHost} from '../run-export';

export function createExportHost(app: App, disk: DiskWriter): RunExportHost {
  return {
    notice: (text) => void new Notice(text),
    writeExportFile: (path, text) => disk.writeText(path, text),
    writeExportBytes: (path, data) => disk.writeBytes(path, data),
    async writeVaultFile(path, text) {
      const slash = path.lastIndexOf('/');
      let built = '';
      for (const part of slash < 0 ? [] : path.slice(0, slash).split('/')) {
        built = built === '' ? part : `${built}/${part}`;
        if (app.vault.getFolderByPath(built) === null) {
          await app.vault.createFolder(built);
        }
      }
      const existing = app.vault.getFileByPath(path);
      if (existing === null) await app.vault.create(path, text);
      else await app.vault.modify(existing, text);
    },
  };
}
