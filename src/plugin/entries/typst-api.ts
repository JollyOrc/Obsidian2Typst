// US-039: the statblock as Typst for another plugin (the Game Card Creator's
// creature card). The answer is made from the same pieces the PDF export uses
// (`statblockModel`, `statblockData`, `statblockLook`, `emitInline`), so the
// card shows the statblock the book shows (SCAR-017). Nothing here imports
// Obsidian: the readers are injected by `main.ts`.
import {
  statblockIconMissing,
  statblockModel,
  type StatblockModel,
} from '../../core/entries/model';
import {
  ENTRY_MARKS_DEF,
  STATBLOCK_HELPER_DEF,
  statblockData,
  statblockLook,
  type StatblockWriter,
} from '../../core/emit/entry';
import {EmitContext} from '../../core/emit/context';
import {emitInline} from '../../core/emit/inline';
import {flattenLinks, type ColorMode} from '../../core/markers';
import type {EntriesSettings} from '../../core/markers/entries';
import {parseInline} from '../../core/parse';
import {NO_SETTINGS, NO_STATS, iconCache} from './processor';

/** What the answer reads, each time it is asked (US-039 AC-10). */
export interface TypstApiDeps {
  /** The active preset's effective settings; null without a valid preset. */
  settings(): Promise<{entries?: unknown; colorMode?: string} | null>;
  /** An icon file's bytes from the vault; null when missing. */
  readIconBytes(path: string): Promise<Uint8Array | null>;
  /** The fonts of a compile: the bundled ones first, then the preset's. */
  fonts(): Promise<Uint8Array[]>;
}

/** US-039 AC-1: a file the Typst text needs, at the path the text names. */
export interface TypstFile {
  path: string;
  bytes: Uint8Array;
}

/** US-039 AC-1, AC-6: a problem with the data, as the book reports it. */
export interface TypstWarning {
  code: string;
  message: string;
}

export type StatblockTypstAnswer =
  | {
      ok: true;
      prelude: string;
      data: string;
      files: TypstFile[];
      credit: string | null;
      warnings: TypstWarning[];
    }
  | {ok: false; reason: 'no-settings' | 'no-statblock'; message: string};

/** US-039: the part of the plugin's API that hands Typst to another plugin. */
export interface StatblockTypstApi {
  statblockTypst(
    data: Record<string, unknown>,
    options?: {heading?: string},
  ): Promise<StatblockTypstAnswer>;
  compileFonts(): Promise<Uint8Array[]>;
  /** Forgets the icons read (a preset change). */
  clearIconCache(): void;
}

/** The folder the icon files are published under, next to the Typst text. */
const ICON_FOLDER = 'o2t-icons';

/**
 * US-039 | AC-3, US-040 | AC-1 to AC-4: the icons of the model's cells, read
 * from the vault (each vault path once), as the files the data names.
 *
 * `n` in `o2t-icons/<n>.svg` is the 1-based position in the preset's `track`
 * of the first entry that names the vault path, never the order of use: one
 * path is then one file in every answer of one preset, and no vault name can
 * decide a number. A track entry whose icon is missing still counts as a
 * position, so the other numbers do not move. Two entries with one vault icon
 * share the path of the first. A missing file gives no entry and
 * `STATBLOCK_ICON_MISSING`. Assumes every cell's icon is an entry of `track`
 * (the model takes its cells from it).
 */
async function iconFiles(
  model: StatblockModel,
  read: (path: string) => Promise<Uint8Array | null>,
  track: readonly {icon: string}[],
): Promise<{
  files: TypstFile[];
  pathOf: Map<string, string | null>;
  warnings: TypstWarning[];
}> {
  const files: TypstFile[] = [];
  const pathOf = new Map<string, string | null>();
  const warnings: TypstWarning[] = [];
  for (const cell of model.cells) {
    if (pathOf.has(cell.icon)) continue;
    const bytes = await read(cell.icon);
    if (bytes === null) {
      pathOf.set(cell.icon, null);
      warnings.push(statblockIconMissing(model.band, cell.icon));
    } else {
      const path = `${ICON_FOLDER}/${track.findIndex((t) => t.icon === cell.icon) + 1}.svg`;
      files.push({path, bytes});
      pathOf.set(cell.icon, path);
    }
  }
  return {files, pathOf, warnings};
}

/**
 * US-039 | AC-1 to AC-6, AC-9, AC-10: the answer of `statblockTypst`. The
 * band is `options.heading`, else `data.name`, else a dash (as
 * `renderStatblock`); the preset is read at each call.
 */
export function createStatblockTypstApi(deps: TypstApiDeps): StatblockTypstApi {
  // AC-8: each vault path is read once until `clearIconCache` (a preset change).
  const icons = iconCache<Uint8Array>((path) => deps.readIconBytes(path));
  const answer = async (
    data: Record<string, unknown>,
    options: {heading?: string} | undefined,
  ): Promise<StatblockTypstAnswer> => {
    {
      const settings = await deps.settings();
      const entries = settings?.entries as EntriesSettings | undefined;
      if (
        entries?.statblock?.stats === undefined ||
        entries.statblock.stats.length === 0
      )
        return {ok: false, reason: 'no-settings', message: NO_SETTINGS};
      const name = Object.entries(data).find(
        ([key]) => key.toLowerCase() === 'name',
      )?.[1];
      const band =
        options?.heading ??
        (typeof name === 'string' && name.trim() !== '' ? name : '—');
      // `omit`, as the book writes an entry: an unset stat is left out.
      const model = statblockModel(data, entries, {
        heading: band,
        fileName: band,
        missing: 'omit',
      });
      if (model === null)
        return {ok: false, reason: 'no-statblock', message: NO_STATS};
      const colorMode = settings?.colorMode as ColorMode | undefined;
      const ctx = new EmitContext();
      const used = await iconFiles(
        model,
        (p) => icons.get(p),
        entries.statblock?.track ?? [],
      );
      const writer: StatblockWriter = {
        content: (value) =>
          emitInline(flattenLinks(parseInline(value, 1)), ctx, {
            atBlockStart: true,
            breaks: 'space',
          }),
        icon: (path) => used.pathOf.get(path) ?? null,
      };
      const text = statblockData(
        model,
        statblockLook(entries, colorMode),
        writer,
      );
      const warnings: TypstWarning[] = [
        ...model.checks.map((c) => ({
          code: c.code,
          message: c.detail === null ? `"${band}"` : `"${band}": ${c.detail}`,
        })),
        ...used.warnings,
        ...ctx.finish().map(({code, message}) => ({code, message})),
      ];
      const credit = entries.encounterSheetText?.credit;
      return {
        ok: true,
        prelude: `${ENTRY_MARKS_DEF}\n${STATBLOCK_HELPER_DEF}`,
        data: text,
        files: used.files,
        credit: credit === undefined || credit === '' ? null : credit,
        warnings,
      };
    }
  };
  return {
    // AC-8: a failing reader is a refusal, never a throw or a half answer.
    async statblockTypst(data, options) {
      try {
        return await answer(data, options);
      } catch (error) {
        const why = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          reason: 'no-settings',
          message: `The preset could not be read: ${why}`,
        };
      }
    },
    compileFonts: () => deps.fonts(),
    clearIconCache: () => icons.clear(),
  };
}
