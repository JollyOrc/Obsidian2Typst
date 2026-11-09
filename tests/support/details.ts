// Test support for US-038 (detail rows, epic #152): the invented preset E of
// the story's examples, the icons it names, a note with an `o2t-details`
// block, and a short way to convert it. Every word is invented (SCAR-035).
// Source of truth: docs/user-stories/US-038-detail-rows.md.
import {convert, type ConvertSettings} from '../../src/core/convert';
import {type Warning} from '../../src/core/emit/context';
import {FakeIndex, NOTE_PATH, SETTINGS} from './convert';

/** Preset E of US-038: the `details` group of the examples. */
export const DETAILS_E = {
  items: [
    {
      key: 'pace',
      icons: {
        slow: 'Icons/slow.svg',
        brisk: 'Icons/brisk.svg',
        swift: 'Icons/swift.svg',
      },
      labels: {slow: 'Slow', brisk: 'Brisk', swift: 'Swift'},
    },
    {
      key: 'kind',
      icon: 'Icons/kind.svg',
      labels: {craft: 'Craft', lore: 'Lore', feat: 'Feat'},
    },
    {key: 'needs', icon: 'Icons/lock.svg'},
    {
      key: 'starter',
      icon: 'Icons/sprout.svg',
      label: 'Known from the start',
    },
  ],
} as const;

const shape = (d: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="${d}" fill="#000"/></svg>`;

/** The icons of preset E at their vault paths: simple shapes in #000. */
export const DETAIL_ICONS: Record<string, string> = {
  'Icons/slow.svg': shape('M1 1h8v8H1z'),
  'Icons/brisk.svg': shape('M5 1l4 8H1z'),
  'Icons/swift.svg': shape('M1 5l8-4v8z'),
  'Icons/kind.svg': shape('M2 2h6v6H2z'),
  'Icons/lock.svg': shape('M3 3h4v6H3z'),
  'Icons/sprout.svg': shape('M4 1h2v8H4z'),
};
export const DETAIL_ICON_BYTES: Record<string, Uint8Array> = Object.fromEntries(
  Object.entries(DETAIL_ICONS).map(([p, s]) => [
    p,
    new TextEncoder().encode(s),
  ]),
);

/** The requirement of the story's table, 57 characters. */
export const LONG_NEEDS =
  'has woven for a full season and keeps a loom of their own';

/** A heading, an `o2t-details` block (`fence`), then the body lines. */
export function details(
  heading: string,
  yaml: readonly string[],
  body: readonly string[] = ['You weave reeds into mats, baskets and rope.'],
  fence = '```',
): string {
  return [heading, `${fence}o2t-details`, ...yaml, fence, ...body].join('\n');
}

/** Converts `source` with preset E (plus `over`) and the icons in the vault. */
export function runDetails(
  source: string,
  over: Record<string, unknown> = {},
  files: readonly string[] = [NOTE_PATH, ...Object.keys(DETAIL_ICONS)],
) {
  const settings = {
    ...SETTINGS,
    details: DETAILS_E,
    ...over,
  } as unknown as ConvertSettings;
  const assets = new FakeIndex(files);
  for (const [p, b] of Object.entries(DETAIL_ICON_BYTES))
    assets.images.set(p, b);
  return convert({
    source,
    noteName: 'Rules',
    notePath: NOTE_PATH,
    settings,
    assets,
  });
}

/** Every code of US-038 (AC-3, AC-4, AC-12). */
export const DETAIL_CODES = [
  'DETAIL_YAML_INVALID',
  'DETAIL_ORPHAN_BLOCK',
  'DETAIL_BLOCK_TWICE',
  'DETAIL_BLOCK_IN_CONTAINER',
  'DETAIL_IN_GLOSSARY',
  'DETAIL_BLOCK_WITH_ENTRY',
  'DETAIL_VALUE_NOT_TEXT',
  'DETAIL_VALUE_UNMAPPED',
] as const;

/** The `DETAIL_*` warnings only, as `CODE message (line N)`, in order. */
export const detailWarnings = (warnings: readonly Warning[]): string[] =>
  warnings
    .filter((w) => w.code.startsWith('DETAIL_'))
    .map((w) => `${w.code} ${w.message} (line ${w.line})`);

/** The Typst helper that draws the row (a plugin name, AC-17). */
export const DETAILS_HELPER = 'o2t-details';

/** The calls of the row helper in a `.typ`. */
export const detailsCalls = (typ: string): string[] =>
  typ.split('\n').filter((l) => l.startsWith(`#${DETAILS_HELPER}(`));
