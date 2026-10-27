// US-012 AC-15 (SCAR-017): the source text of everything that draws the
// Defaults: the Settings tab, the shared rows module, its row data (moved out of
// it by US-021, TICKET-060) and the style panel. Text checks over "the settings
// tab" read all four, so a field made in any of them is checked by the same
// rules.
import {existsSync, readFileSync} from 'node:fs';

const FILES = [
  'src/plugin/settings/settings-tab.ts',
  'src/plugin/settings/rows.ts',
  'src/plugin/settings/row-data.ts',
  'src/plugin/preview/panel.ts',
];

/** The four files as one text, in a fixed order (missing files are skipped). */
export function settingsSource(): string {
  return FILES.filter((file) => existsSync(file))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
}
