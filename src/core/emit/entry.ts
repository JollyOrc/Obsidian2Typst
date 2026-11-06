// US-030 AC-1, AC-5, AC-6, AC-10, AC-11, AC-22: the call of the statblock
// helper for one entry. Pure: no Obsidian, Node, or I/O imports. The helper
// itself (what is drawn) is written into the prelude by the statblock ticket;
// this module only hands it the data.
import {entryKeys, type EntriesSettings, type EntryData} from '../markers';
import {typstString} from './typst-string';

/** US-030 AC-15: the Typst name of the statblock helper (a plugin name). */
export const STATBLOCK_HELPER = 'o2t-statblock';

/** Typst array text; one item keeps its trailing comma. */
const array = (items: readonly string[]): string =>
  items.length === 1 ? `(${items[0]},)` : `(${items.join(', ')})`;

/**
 * US-030 | AC-10: an attack item split at its first `: ` into name and dice;
 * without `: ` the whole text is the name and the dice are `none`
 * (decision 1).
 */
export function splitAttack(item: string): {name: string; dice: string | null} {
  const at = item.indexOf(': ');
  return at < 0
    ? {name: item, dice: null}
    : {name: item.slice(0, at), dice: item.slice(at + 2)};
}

/**
 * US-030 | AC-10, AC-11: true when the entry gets a statblock: the preset has
 * `entries` settings and the block sets at least one stat or one attack.
 */
export function hasStatblock(
  data: EntryData,
  settings: EntriesSettings | undefined,
): boolean {
  if (settings === undefined) return false;
  const stats = (settings.statblock?.stats ?? []).map((f) =>
    f.key.toLowerCase(),
  );
  return stats.some((key) => data.single.has(key)) || data.lists.has('attacks');
}

/**
 * US-030 | AC-1, AC-5, AC-6, AC-22: `#o2t-statblock((…))` for an entry, or
 * null when it gets no statblock. The dictionary holds the values the preset
 * uses, in the preset's order (single keys, then `attacks`, `skills`, `tags`
 * and the track key), never in the block's: the same data gives the same
 * text byte for byte. Each value is Typst content made by `content` (the
 * inline emitter: bold and italic typeset, links flattened, escaped); an
 * attack is `(name, dice)` with `none` for no dice, so the block's text is
 * never written as it stands.
 */
export function statblockCall(
  data: EntryData,
  settings: EntriesSettings | undefined,
  content: (text: string) => string,
): string | null {
  if (!hasStatblock(data, settings)) return null;
  const keys = entryKeys(settings);
  const fields: string[] = [];
  for (const key of keys.single) {
    const value = data.single.get(key);
    if (value !== undefined)
      fields.push(`${typstString(key)}: [${content(value)}]`);
  }
  for (const key of keys.lists) {
    const items = data.lists.get(key);
    if (items === undefined) continue;
    const written =
      key === 'attacks'
        ? items.map((item) => {
            const {name, dice} = splitAttack(item);
            return `([${content(name)}], ${dice === null ? 'none' : `[${content(dice)}]`})`;
          })
        : items.map((item) => `[${content(item)}]`);
    fields.push(`${typstString(key)}: ${array(written)}`);
  }
  return `#${STATBLOCK_HELPER}((${fields.join(', ')}))`;
}
