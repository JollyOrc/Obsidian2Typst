// US-008 AC-2, AC-6: the text of the notes that the plugin creates.
// Pure core: no Obsidian, Node, or I/O imports.
import {BUILTIN_PAGE_PRESETS} from '../layout/page-setup';
import {SCHEMA_VERSION} from './schema';

/** US-008 AC-2: an empty preset is a note with only the schema version. */
export function emptyPresetText(): string {
  return `---\nschemaVersion: ${SCHEMA_VERSION}\n---\n`;
}

/**
 * US-008 AC-6 | US-018 AC-1: the text of a built-in preset note.
 *
 * Writes the page values of US-009 AC-6 for `name`, then `extra` (top-level
 * field lines, as written) before the closing `---`. Transforms: the page
 * block; the extra lines unchanged (A4 digital: `linkPageNumbers: false`).
 */
function pageText(
  name: 'A5 print' | 'A4 digital',
  extra: readonly string[] = [],
): string {
  const p = BUILTIN_PAGE_PRESETS[name];
  return [
    '---',
    `schemaVersion: ${SCHEMA_VERSION}`,
    'page:',
    `  trimSize: ${p.trimSize}`,
    '  margins:',
    `    top: ${p.margins.top}`,
    `    bottom: ${p.margins.bottom}`,
    `    inside: ${p.margins.inside}`,
    `    outside: ${p.margins.outside}`,
    `  gutter: ${p.gutter}`,
    `  bleed: ${p.bleed}`,
    `  slug: ${p.slug}`,
    `  facingPages: ${p.facingPages}`,
    ...extra,
    '---',
    '',
  ].join('\n');
}

/** US-008 AC-6: the two preset notes that ship; their values are US-009 AC-6. */
export const BUILTIN_PRESET_TEXTS: Readonly<
  Record<'A5 print' | 'A4 digital', string>
> = {
  'A5 print': pageText('A5 print'),
  // US-018 AC-1: a screen PDF needs no page numbers after its links.
  'A4 digital': pageText('A4 digital', ['linkPageNumbers: false']),
};
