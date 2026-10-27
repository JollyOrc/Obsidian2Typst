// US-003 AC-4: copies the used assets into the export folder. The list comes
// from the pure resolver; this only reads each source and writes its copy.
import type {AssetUse} from '../core/assets';

/** The file access the copy needs; the plugin implements it with the vault. */
export interface AssetFs {
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array): Promise<void>;
}

/**
 * US-003 AC-4: copies each file of `uses` to `<exportDir>/<to>`, once. Sources
 * are only read, never changed or moved.
 */
export async function copyAssets(
  uses: readonly AssetUse[],
  fs: AssetFs,
  exportDir: string,
): Promise<{copied: number}> {
  const base = exportDir.replace(/\/+$/, '');
  const done = new Set<string>();
  for (const use of uses) {
    if (done.has(use.to)) continue;
    done.add(use.to);
    const data = await fs.read(use.from);
    await fs.write(`${base}/${use.to}`, data);
  }
  return {copied: done.size};
}
