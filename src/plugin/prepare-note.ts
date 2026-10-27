// US-008 AC-15, US-012 AC-13: what the export and the preview share before the
// compiler: which preset applies, and the conversion of the note with the
// effective settings. Everything it needs from Obsidian is injected.
import type {AssetUse} from '../core/assets';
import {convert} from '../core/convert';
import type {Warning} from '../core/emit';
import {
  effectiveSettings,
  formatPresetError,
  isPresetNote,
  pickActive,
  resolveFields,
} from '../core/presets';
import {
  definesTemplateHook,
  missingTemplateWarning,
  templateWarnings,
} from '../core/template';
import type {ExportCommandDeps} from './export-command';
import type {UseResult} from './presets/store';

/** A preset that is valid (the result of `PresetStore.use`). */
type Preset = Extract<UseResult, {ok: true}>['preset'];

/** The part of the export command's dependencies the preparation uses. */
export type PrepareDeps = Pick<
  ExportCommandDeps,
  'notes' | 'vault' | 'presets' | 'fonts' | 'settings'
>;

/** Why no preset could be used (the notice text is `message`). */
export type PresetRefusal = {
  ok: false;
  status: 'presets-note' | 'no-preset' | 'invalid-preset';
  message: string;
};

/** US-008 AC-15: the note name without folder and `.md`. */
export const noteNameOf = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');

/** The converted note and everything the export or the preview hands on. */
export interface PreparedNote {
  ok: true;
  active: string;
  typ: string;
  warnings: Warning[];
  uses: AssetUse[];
  /** The text of the template to copy; null when none applies. */
  template: string | null;
  /** US-010 AC-3: the vault fonts for the compiler (not the bundled ones). */
  fonts: Uint8Array[];
}

/**
 * US-008 AC-4, AC-15: the active preset for the note at `path`. Refuses a
 * note in the presets folder, a vault without presets and an invalid active
 * preset; each refusal carries the notice text. Reads the settings when it
 * runs (SCAR-016).
 */
export function selectPreset(
  deps: PrepareDeps,
  path: string,
): {ok: true; active: string; preset: Preset} | PresetRefusal {
  const data = deps.settings.data;
  if (isPresetNote(path, data.presetsFolder)) {
    return {
      ok: false,
      status: 'presets-note',
      message: 'Presets are not exported',
    };
  }
  const names = deps.presets.entries().map((entry) => entry.name);
  const active = pickActive(names, data.activePreset);
  if (active === null) {
    return {
      ok: false,
      status: 'no-preset',
      message:
        'There is no preset; create one in the settings of Obsidian2Typst',
    };
  }
  const used = deps.presets.use(active);
  if (!used.ok) {
    return {ok: false, status: 'invalid-preset', message: used.error};
  }
  return {ok: true, active, preset: used.preset};
}

/**
 * US-008 AC-12, AC-15, US-010 AC-3, US-012 AC-13: converts the note at `path`
 * with the effective settings of `preset` (Defaults under it), the template
 * and the fonts of the vault. The export and the preview both call it, so the
 * Typst text is the same; the Warnings are those of the template, the fonts and
 * the conversion, in this order. US-023 AC-1, AC-9: the one place that tells
 * `convert` whether the template defines the hook (SCAR-017).
 */
export async function convertNote(
  deps: PrepareDeps,
  path: string,
  active: string,
  preset: Preset,
): Promise<PreparedNote | PresetRefusal> {
  const data = deps.settings.data;
  const templatePath = resolveFields(preset.fields, data.defaults).template;
  const templateText =
    templatePath === null ? null : await deps.vault.readText(templatePath);
  const effective = effectiveSettings(
    preset,
    data.defaults,
    (candidate) => candidate === templatePath && templateText !== null,
  );
  if (!effective.ok) {
    return {
      ok: false,
      status: 'invalid-preset',
      message: `Preset "${active}" is invalid: ${formatPresetError(effective.error)}`,
    };
  }
  const fontSet =
    deps.fonts === undefined
      ? null
      : await deps.fonts(effective.settings.fonts.folder);
  const converted = await convert({
    source: await deps.notes.read(path),
    noteName: noteNameOf(path),
    notePath: path,
    // US-023 AC-1, AC-9: the hook when the template copy defines `template`,
    // read from the text read above (each preparation, SCAR-016). A text that
    // is not null is the one `template: true` stands for (the callback above).
    settings: {
      ...effective.settings,
      templateHook: templateText !== null && definesTemplateHook(templateText),
    },
    assets: {files: deps.vault.files(), readHead: deps.vault.readHead},
    fonts: fontSet?.catalog,
  });
  const warnings: Warning[] = [];
  if (templatePath !== null) {
    warnings.push(
      ...(templateText === null
        ? [missingTemplateWarning(templatePath)]
        : templateWarnings(templateText)),
    );
  }
  warnings.push(...(fontSet?.warnings ?? []), ...converted.warnings);
  return {
    ok: true,
    active,
    typ: converted.typ,
    warnings,
    uses: converted.assets,
    template: templateText,
    fonts: fontSet?.files ?? [],
  };
}

/** US-012 AC-13: `selectPreset` and `convertNote` in one call (the preview). */
export async function prepareNote(
  deps: PrepareDeps,
  path: string,
): Promise<PreparedNote | PresetRefusal> {
  const selected = selectPreset(deps, path);
  if (!selected.ok) return selected;
  return convertNote(deps, path, selected.active, selected.preset);
}
