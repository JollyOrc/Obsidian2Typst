// US-007 AC-1: writes the export folder on disk (desktop only, Node's file
// system). Writes only below its root; never deletes.
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, resolve, sep} from 'node:path';

/** Writes text and bytes at absolute paths below one folder. */
export interface DiskWriter {
  writeText(path: string, text: string): Promise<void>;
  writeBytes(path: string, data: Uint8Array): Promise<void>;
}

/** US-007 AC-1: a writer for the export folder `root`. */
export function createDiskWriter(root: string): DiskWriter {
  const base = resolve(root);
  /** The normalised path, or a refusal when it is not below `root`. */
  const checked = (path: string): string => {
    const full = isAbsolute(path) ? resolve(path) : null;
    if (full === null || (full !== base && !full.startsWith(base + sep))) {
      throw new Error(`Refusing to write outside the export folder: ${path}`);
    }
    return full;
  };
  const write = async (path: string, data: Uint8Array): Promise<void> => {
    const full = checked(path);
    await mkdir(dirname(full), {recursive: true});
    await writeFile(full, data);
  };
  return {
    writeText: (path, text) => write(path, new TextEncoder().encode(text)),
    writeBytes: write,
  };
}
