// US-012 AC-15 (SCAR-017): the source text of everything that draws the
// Defaults: the Settings tab, the shared rows module, its row data (moved out of
// it by US-021, TICKET-060) and the style panel. Text checks over "the settings
// tab" read all four, so a field made in any of them is checked by the same
// rules. US-029 (AC-1, AC-6): the layout data and the preset screen joined the
// tab (rows, toggles and the preset buttons moved there), so they are read too.
import {existsSync, readFileSync} from 'node:fs';

const FILES = [
  // US-029 AC-6 (#113): the name dialog moved out of the tab; it stands first
  // so that checks of "the tab class onward" leave the dialog out, as before.
  'src/plugin/settings/name-modal.ts',
  'src/plugin/settings/settings-tab.ts',
  'src/plugin/settings/rows.ts',
  'src/plugin/settings/row-data.ts',
  'src/plugin/preview/panel.ts',
  'src/plugin/settings/layout.ts',
  'src/plugin/settings/details.ts',
];

/** The files as one text, in a fixed order (missing files are skipped). */
export function settingsSource(): string {
  return FILES.filter((file) => existsSync(file))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
}
