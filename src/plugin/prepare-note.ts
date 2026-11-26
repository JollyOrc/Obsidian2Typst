// US-008 AC-15, US-012 AC-13: what the export and the preview share before the
// compiler: which preset applies, and the conversion of the note with the
// effective settings. Everything it needs from Obsidian is injected.
import type {AssetUse} from '../core/assets';
import {convert} from '../core/convert';
import {ENTRY_BUILTINS} from '../core/markers';
import type {ImageFact, Warning} from '../core/emit';
import {MIN_DPI_BUILTIN} from '../core/layout/page-setup';
import {
  effectiveSettings,
  formatPresetError,
  isPresetNote,
  nameKey,
  pickActive,
  readNotePreset,
  resolveFields,
} from '../core/presets';
import {frontmatterSpan} from '../core/presets/parse';
import {
  definesTemplateHook,
  missingTemplateWarning,
  templateWarnings,
} from '../core/template';
import type {ExportCommandDeps} from './export-command';
import type {UseResult} from './presets/store';
import {STRINGS} from './strings';

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
  status: 'presets-note' | 'no-preset' | 'invalid-preset' | 'note-preset';
  message: string;
};

/** US-045 AC-2: the used preset, and whether the note named it. */
export type SelectedPreset = {
  ok: true;
  active: string;
  preset: Preset;
  /** US-045 AC-3: the note has a `typst-preset` key (usable or not). */
  noteKey: boolean;
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
  /** US-028 AC-16: the note text that was converted. */
  source: string;
  /** US-032 AC-9: `entries.emptyWarn` of the preset (or the built-in). */
  emptyWarn: number;
  /** US-034 AC-1: `images.minDpi` of the preset (or the built-in 300). */
  minDpi: number;
  /** US-034 AC-5: `entries.maxWordGap` of the preset (or the built-in 200). */
  maxWordGap: number;
  /** US-036 AC-5: the A4 encounter sheet's source; null without the file. */
  sheetTyp: string | null;
  /** US-034 AC-2: the block images whose drawn width the conversion fixes. */
  fixedImages: ImageFact[];
  /** US-037 AC-4: the effective `page.facingPages`. */
  facingPages: boolean;
}

/** US-028 AC-16: how `convertNote` converts a second time. */
export interface ConvertNoteOptions {
  /** The note text to convert instead of reading the note again. */
  source?: string;
  /** Converts with `images.minScale: 100` (no image fit, AC-10). */
  imagesOff?: boolean;
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
      message: STRINGS.exportRefusals.presetNote,
    };
  }
  const names = deps.presets.entries().map((entry) => entry.name);
  const active = pickActive(names, data.activePreset);
  if (active === null) {
    return {
      ok: false,
      status: 'no-preset',
      message: STRINGS.exportRefusals.noPreset,
    };
  }
  const used = deps.presets.use(active);
  if (!used.ok) {
    return {ok: false, status: 'invalid-preset', message: used.error};
  }
  return {ok: true, active, preset: used.preset};
}

/**
 * US-045 | AC-1, AC-2, AC-4: the used preset for the note at `path`: the
 * preset its `typst-preset` key names (compared as the preset list compares
 * names), else the active preset ({@link selectPreset}). The note is read now,
 * never from Obsidian's metadata cache (SCAR-022). A key naming no preset, an
 * invalid preset or not a name is refused with the property named; nothing
 * falls back silently. One decision for the export, the dialog and the
 * preview (SCAR-017).
 */
export async function selectNotePreset(
  deps: PrepareDeps,
  path: string,
): Promise<SelectedPreset | PresetRefusal> {
  const active = selectPreset(deps, path);
  if (!active.ok && active.status === 'presets-note') return active;
  // A note that cannot be read here has no key: the conversion reads it again
  // and fails where it always failed, inside the export's progress (US-042).
  const text = await deps.notes.read(path).catch(() => '');
  const span = frontmatterSpan(text);
  const key = readNotePreset(
    span === null || 'unclosed' in span ? null : span.yaml,
  );
  if (key.kind === 'none') {
    return active.ok ? {...active, noteKey: false} : active;
  }
  if (key.kind === 'bad') {
    return {
      ok: false,
      status: 'note-preset',
      message: STRINGS.exportRefusals.noteBad(key.message),
    };
  }
  const entry = deps.presets
    .entries()
    .find((e) => nameKey(e.name) === nameKey(key.name));
  if (entry === undefined) {
    return {
      ok: false,
      status: 'note-preset',
      message: STRINGS.exportRefusals.noteMissing(key.name),
    };
  }
  const used = deps.presets.use(entry.name);
  if (!used.ok) {
    const prefix = STRINGS.presets.invalid(entry.name, '');
    const reason = used.error.startsWith(prefix)
      ? used.error.slice(prefix.length)
      : used.error;
    return {
      ok: false,
      status: 'note-preset',
      message: STRINGS.exportRefusals.noteInvalid(entry.name, reason),
    };
  }
  return {ok: true, active: entry.name, preset: used.preset, noteKey: true};
}

/**
 * US-008 AC-12, AC-15, US-010 AC-3, US-012 AC-13: converts the note at `path`
 * with the effective settings of `preset` (Defaults under it), the template
 * and the fonts of the vault. The export and the preview both call it, so the
 * Typst text is the same; the Warnings are those of the template, the fonts and
 * the conversion, in this order. US-023 AC-1, AC-9: the one place that tells
 * `convert` whether the template defines the hook (SCAR-017).
 * US-028 AC-16: `options.source` converts that text instead of reading the
 * note again, and `options.imagesOff` converts with `images.minScale: 100`
 * (the export's fallback); the text converted is returned as `source`.
 */
export async function convertNote(
  deps: PrepareDeps,
  path: string,
  active: string,
  preset: Preset,
  options: ConvertNoteOptions = {},
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
      message: STRINGS.presets.invalid(
        active,
        formatPresetError(effective.error),
      ),
    };
  }
  const fontSet =
    deps.fonts === undefined
      ? null
      : await deps.fonts(effective.settings.fonts.folder);
  const source = options.source ?? (await deps.notes.read(path));
  // US-028 AC-16: the fallback converts without image fit.
  const images =
    options.imagesOff === true
      ? {images: {...effective.settings.images, minScale: 100}}
      : {};
  const converted = await convert({
    source,
    noteName: noteNameOf(path),
    notePath: path,
    // US-023 AC-1, AC-9: the hook when the template copy defines `template`,
    // read from the text read above (each preparation, SCAR-016). A text that
    // is not null is the one `template: true` stands for (the callback above).
    settings: {
      ...effective.settings,
      ...images,
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
    emptyWarn:
      effective.settings.entries?.emptyWarn ?? ENTRY_BUILTINS.emptyWarn,
    minDpi: effective.settings.images?.minDpi ?? MIN_DPI_BUILTIN,
    maxWordGap:
      effective.settings.entries?.maxWordGap ?? ENTRY_BUILTINS.maxWordGap,
    sheetTyp: converted.sheetTyp ?? null,
    fixedImages: converted.images ?? [],
    facingPages: effective.settings.page.facingPages,
    source,
  };
}

/** US-012 AC-13: `selectPreset` and `convertNote` in one call (the preview). */
export async function prepareNote(
  deps: PrepareDeps,
  path: string,
): Promise<PreparedNote | PresetRefusal> {
  // US-045 AC-2: the preview uses the note's preset as the export does.
  const selected = await selectNotePreset(deps, path);
  if (!selected.ok) return selected;
  return convertNote(deps, path, selected.active, selected.preset);
}
