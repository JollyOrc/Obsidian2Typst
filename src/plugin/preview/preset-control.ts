// US-045 AC-5: what the preview panel's preset list shows: the used preset;
// locked, with a hint, when the shown note names its own. Pure: the panel
// draws it.
import {menuItemTitle} from '../menus';
import {STRINGS} from '../strings';

export interface PresetControl {
  value: string;
  locked: boolean;
  hint: string | null;
}

/**
 * US-045 | AC-5: The list for the note shown: its own preset (`notePreset`,
 * usable) shown and not changeable, with the hint naming the menu item that
 * changes it; else the active preset, free, as before.
 */
export function previewPresetControl(state: {
  active: string;
  notePreset: string | null;
}): PresetControl {
  return state.notePreset === null
    ? {value: state.active, locked: false, hint: null}
    : {
        value: state.notePreset,
        locked: true,
        // the item as the file menu shows it (its prefix from `menuItemTitle`)
        hint: STRINGS.panel.notePreset(
          menuItemTitle({title: STRINGS.menus.notePreset}, true),
        ),
      };
}
