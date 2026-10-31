// US-029 AC-6: what the preset screen's Duplicate, Rename and Delete do, as
// plain functions over the stores, so that the tests run them; main.ts passes
// the dialogs (the name dialog, the confirmation) and the notices.
import type {PresetStore} from '../presets/store';
import type {SettingsStore} from './data';
import {deletePreset, type DeleteConfirmation} from './dialog';

/** What the actions read and call. */
export interface PresetActionDeps {
  presets: Pick<PresetStore, 'duplicate' | 'rename' | 'canRemove' | 'remove'>;
  settings: Pick<SettingsStore, 'data' | 'update'>;
  /**
   * Shows the name dialog; `submit` returns an error text or null (OK closes
   * the dialog). Resolves when the dialog has closed, after OK or without.
   */
  askName(
    title: string,
    initial: string,
    submit: (name: string) => Promise<string | null>,
  ): Promise<void>;
  /** The question before a delete; true only for the confirm button. */
  confirm(text: DeleteConfirmation): Promise<boolean>;
  notify(text: string): void;
}

/** US-029 AC-6: the three actions of the preset screen. */
export interface PresetActions {
  duplicate(name: string): Promise<void>;
  rename(name: string): Promise<string | null>;
  remove(name: string): Promise<boolean>;
}

/**
 * US-029 | AC-6: The preset screen's actions, as the tab's row buttons did
 * them (US-008 AC-5, AC-17): a refused duplicate is a notice; Rename asks
 * for the name, a refused one stays in the dialog, and a renamed active
 * preset stays active (read when the rename runs, SCAR-016); Delete goes
 * through `deletePreset` (refusal, question, `Cancel` the default). Rename
 * gives the new name or null; Delete gives true when the preset was deleted.
 */
export function presetScreenActions(deps: PresetActionDeps): PresetActions {
  const {presets, settings} = deps;
  return {
    async duplicate(name) {
      const result = await presets.duplicate(name);
      if (!result.ok) deps.notify(result.error);
    },
    async rename(name) {
      let renamed: string | null = null;
      await deps.askName('Rename preset', name, async (to) => {
        const result = await presets.rename(name, to);
        if (!result.ok) return result.error;
        if (settings.data.activePreset === name) {
          await settings.update({activePreset: result.name});
        }
        renamed = result.name;
        return null;
      });
      return renamed;
    },
    remove(name) {
      return deletePreset(
        {
          store: presets,
          confirm: (text) => deps.confirm(text),
          setActive: (active) => settings.update({activePreset: active}),
          notify: (text) => deps.notify(text),
        },
        name,
        settings.data.activePreset,
      );
    },
  };
}
