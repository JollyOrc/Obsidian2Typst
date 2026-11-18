// US-042 AC-3 to AC-6: the export dialog's rules as data — the title, the folder
// check, the destination line, the presets offered, a preset's folder, the keys
// and what is saved when Export runs. No Obsidian import: the dialog draws them.
import {groupPresets} from '../../core/presets/groups';
import {STRINGS} from '../strings';

/** US-042 | AC-3: The dialog's title. */
export function dialogTitle(noteName: string): string {
  return STRINGS.exportDialogText.title(noteName);
}

/**
 * US-042 | AC-4: Checks a typed export folder before anything is written.
 *
 * Accepts an absolute path of the system (`path.isAbsolute`, so the platform's
 * rule); the folder is the text without surrounding spaces and trailing
 * separators, a root (`/`, `C:\`) kept as it is. Refuses an empty text and a
 * relative one, naming the text as typed.
 */
export function checkExportFolder(
  text: string,
  path: {isAbsolute(p: string): boolean},
): {ok: true; folder: string} | {ok: false; message: string} {
  const trimmed = text.trim();
  if (trimmed === '')
    return {ok: false, message: STRINGS.exportDialogText.chooseFolder};
  if (!path.isAbsolute(trimmed)) {
    return {
      ok: false,
      message: STRINGS.exportDialogText.notAbsolute(trimmed),
    };
  }
  const stripped = trimmed.replace(/[\\/]+$/, '');
  const isRoot = stripped === '' || /^[A-Za-z]:$/.test(stripped);
  return {ok: true, folder: isRoot ? trimmed : stripped};
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * US-042 | AC-5: The grey line: the PDF to be written, or the existing one with
 * its local modification time (`YYYY-MM-DD HH:MM`) and that it is replaced.
 */
export function destinationLine(
  pdfName: string,
  modified: Date | null,
): string {
  if (modified === null) return STRINGS.exportDialogText.willWrite(pdfName);
  const when =
    `${modified.getFullYear()}-${pad(modified.getMonth() + 1)}-${pad(modified.getDate())} ` +
    `${pad(modified.getHours())}:${pad(modified.getMinutes())}`;
  return STRINGS.exportDialogText.willReplace(pdfName, when);
}

/** One entry of the preset list. */
export interface PresetEntry {
  name: string;
  valid: boolean;
  group?: string | null;
}

/**
 * US-042 | AC-3: The presets the dialog offers: the valid ones, grouped as
 * `groupPresets` groups them; a group without a valid preset is left out.
 */
export function presetChoices(
  entries: readonly PresetEntry[],
): {heading: string | null; names: string[]}[] {
  const valid = entries
    .filter((entry) => entry.valid)
    .map((entry) => ({...entry, group: entry.group ?? null}));
  if (valid.length === 0) return [];
  return groupPresets(valid).map((group) => ({
    heading: group.heading,
    names: group.entries.map((entry) => entry.name),
  }));
}

/** US-042 | AC-3: The remembered folder of a preset, or `''`. */
export function folderOf(
  lastExportFolders: Readonly<Record<string, string>>,
  preset: string,
): string {
  return Object.prototype.hasOwnProperty.call(lastExportFolders, preset)
    ? (lastExportFolders[preset] ?? '')
    : '';
}

/**
 * US-042 | AC-6: What a key does in the dialog: Enter runs while Export is
 * enabled (never while an input method composes: `isComposing` or key code
 * 229); Escape cancels; anything else does nothing.
 */
export function exportDialogKey(
  event: {key: string; isComposing: boolean; keyCode: number},
  enabled: boolean,
): 'run' | 'cancel' | 'none' {
  if (event.isComposing || event.keyCode === 229) return 'none';
  if (event.key === 'Escape') return 'cancel';
  if (event.key === 'Enter') return enabled ? 'run' : 'none';
  return 'none';
}

/** What `saveExportChoices` needs from the settings. */
export interface ExportChoiceStore {
  readonly data: {activePreset: string};
  setLastExportFolder(preset: string, folder: string): Promise<void>;
  update(patch: {activePreset: string}): Promise<void>;
}

/**
 * US-042 | AC-6 (P1): Saves the choice when Export runs: the folder as that
 * preset's, then the preset as the active one when it is another (read now,
 * SCAR-016). Nothing else.
 */
export async function saveExportChoices(
  settings: ExportChoiceStore,
  choice: {preset: string; folder: string},
): Promise<void> {
  await settings.setLastExportFolder(choice.preset, choice.folder);
  if (settings.data.activePreset !== choice.preset) {
    await settings.update({activePreset: choice.preset});
  }
}
