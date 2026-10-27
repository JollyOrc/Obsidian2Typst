// US-021 AC-2: the one grouping of presets that every list of the plugin uses
// (the style panel's dropdown, the settings tab, the ribbon menu; SCAR-017).
// Pure core: no Obsidian, Node, or I/O imports.
import {headingRuleKey} from '../markers';

/** One group of a preset list; `heading` is null when nothing is grouped. */
export interface PresetGroup<T> {
  heading: string | null;
  entries: T[];
}

/** The heading under which ungrouped presets are listed (AC-2 rule 4). */
export const UNGROUPED_HEADING = 'Other';

/**
 * US-021 | AC-2: Groups `entries` (in settings order) for display.
 *
 * Rule 1: the key of a group is its text as `headingRuleKey` compares heading
 * texts (runs of white space as one blank, trimmed, lower case), so `Print`,
 * ` print` and `PRINT  ` are one group. Rule 2: the heading is the spelling
 * of the first entry of the group. Rule 3: groups in the alphabetical order of
 * their key (code-point order, as `localeCompare` would vary by locale),
 * entries in the given order. Rule 4: entries without a group, with an empty
 * one, or with the key `other` go last under `Other`. Rule 5: when no entry is
 * in a named group, one group with the heading null holds them all (today's
 * list). Never changes `entries`; the same input gives the same groups.
 */
export function groupPresets<T extends {group: string | null}>(
  entries: readonly T[],
): PresetGroup<T>[] {
  const named = new Map<string, PresetGroup<T>>();
  const rest: T[] = [];
  for (const entry of entries) {
    const key = entry.group === null ? '' : headingRuleKey(entry.group);
    if (key === '' || key === UNGROUPED_HEADING.toLowerCase()) {
      rest.push(entry);
      continue;
    }
    const group = named.get(key);
    if (group === undefined) {
      named.set(key, {
        heading: (entry.group as string).trim(),
        entries: [entry],
      });
    } else {
      group.entries.push(entry);
    }
  }
  if (named.size === 0) return [{heading: null, entries: [...entries]}];
  const keys = [...named.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const groups = keys.map((key) => named.get(key) as PresetGroup<T>);
  if (rest.length > 0) groups.push({heading: UNGROUPED_HEADING, entries: rest});
  return groups;
}
