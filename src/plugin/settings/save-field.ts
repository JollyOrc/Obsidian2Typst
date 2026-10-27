// US-012 AC-3 (SCAR-016, SCAR-017): the one place that saves a field of the
// Defaults for the Settings tab and the style panel. No Obsidian import, so
// tests run it as it is.
import {withField, type FieldPath} from '../../core/presets';
import type {PresetStore} from '../presets/store';
import type {SettingsStore} from './data';

/** What `saveDefaultsField` needs of the stores. */
export interface SaveDeps {
  settings: Pick<SettingsStore, 'data' | 'setDefaults'>;
  presets: Pick<PresetStore, 'refresh'>;
}

/**
 * US-012 AC-3: saves one field of the Defaults. The Defaults are read now, not
 * when the control was made (SCAR-016); `undefined` removes the field. A saved
 * value makes the presets be checked again; a refused one changes nothing. The
 * caller shows the message or the notices.
 */
export async function saveDefaultsField(
  deps: SaveDeps,
  path: FieldPath,
  value: unknown,
): Promise<{ok: true; notices: string[]} | {ok: false; error: string}> {
  const next = withField(deps.settings.data.defaults, path, value);
  const result = await deps.settings.setDefaults(next);
  if (!result.ok) return result;
  deps.presets.refresh();
  return result;
}
