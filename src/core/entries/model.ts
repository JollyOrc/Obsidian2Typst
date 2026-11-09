// US-030 AC-10 to AC-14, AC-18, US-035 AC-1 to AC-4: the statblock's drawing
// model — which parts an entry's statblock has and what each holds — and its
// data checks. Pure: no Obsidian, Node, or I/O imports. The one model of the
// PDF emitter and the Obsidian preview (SCAR-017); `us-035-model-vs-pdf`
// proves the PDF draws what it says.
import {
  lowerKeys,
  readEntryValues,
  type EntriesSettings,
  type TrackCell,
} from '../markers';

/** US-030 AC-12: boxes per row (three groups of 5) and the most boxes drawn. */
export const BOXES_PER_ROW = 15;
export const BOXES_MAX = 45;

/** US-030 AC-18: an `NdM` dice pool. */
const DICE = /\b\d+d\d+\b/;

/** The parts of a statblock, top to bottom (AC-10). */
export type StatblockPart =
  | 'band'
  | 'boxes'
  | 'track'
  | 'attributes'
  | 'traits'
  | 'attacks'
  | 'skills'
  | 'tags';

/** One data check of US-030 AC-12 to AC-14, AC-18; `detail` after the heading. */
export interface StatblockCheck {
  code:
    | 'STAT_BOXES_MANY'
    | 'STAT_BOXES_NOT_NUMBER'
    | 'ENTRY_TRACK_UNKNOWN'
    | 'TAG_UNMAPPED'
    | 'STAT_SUM_MISMATCH'
    | 'STAT_ATTACK_NO_DICE';
  detail: string | null;
}

export interface StatblockAttack {
  /** The text before the first `: `, or the whole item (decision 1). */
  name: string;
  /** The text after the first `: `; '' without one. */
  dice: string;
  /** AC-18: no `NdM` dice pool in the dice (or the whole item). */
  noDice: boolean;
}

/** A labelled value of the attributes or traits line (as written in the block). */
export interface StatblockValue {
  label: string;
  /** null: not set (the preview shows —, the PDF leaves it out). */
  value: string | null;
}

/** US-035 AC-1: what one statblock draws. */
export interface StatblockModel {
  /** AC-10: the heading's plain text, else the note's file name. */
  band: string;
  /** AC-12: the boxes drawn (0 when the value is 0, over 45 or not a number). */
  boxes: number;
  /** AC-12: rows of 15. */
  rows: number;
  /** AC-12: the box row's label (upper case) and value as written. */
  boxLabel: string | null;
  boxValue: string | null;
  /** AC-13: the cells in `track` order; `icon` is the preset's vault path. */
  cells: TrackCell[];
  /** AC-13: the label line above the cells; null without one. */
  trackLabel: string | null;
  parts: StatblockPart[];
  /** AC-10: `Might 4 · Wits 2 · Speed 5` (with `missing: 'dash'` unset ones as —). */
  attributes: string;
  stats: StatblockValue[];
  traits: string;
  traitValues: StatblockValue[];
  attacks: StatblockAttack[];
  /** AC-10: `Skills: Quick Step, Keen Nose`; '' without skills. */
  skills: string;
  skillItems: string[];
  /** AC-14: the labels joined with ` · `; '' without. */
  tags: string;
  tagLabels: string[];
  /** The data checks of this entry, in the order of the warnings. */
  checks: StatblockCheck[];
  /** US-035 AC-2: the warnings as `CODE: detail` (value shapes first). */
  notices: string[];
}

/** US-035 AC-1: where the block is and how a missing value is shown. */
export interface StatblockContext {
  heading: string | null;
  fileName: string;
  missing: 'dash' | 'omit';
}

/** US-030 AC-18: a number written plainly (`20`, `"20"`, `-3`, `2.5`). */
const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))
    return Number(value);
  return null;
};

/** US-030 AC-10: an attack item split at its first `: ` (decision 1). */
export function splitAttack(item: string): StatblockAttack {
  const at = item.indexOf(': ');
  const name = at < 0 ? item : item.slice(0, at);
  const dice = at < 0 ? '' : item.slice(at + 2);
  return {name, dice, noDice: !DICE.test(at < 0 ? item : dice)};
}

/** US-035 AC-3, US-030 AC-13: every fill and stroke colour other than `none` → `colour`. */
export function recolourSvg(svg: string, colour: string): string {
  return svg.replace(
    /\b(fill|stroke)="([^"]*)"/g,
    (whole, attr: string, value: string) =>
      value.trim() === 'none' ? whole : `${attr}="${colour}"`,
  );
}

/**
 * US-030 | AC-10 to AC-14, AC-18, US-035 | AC-1, AC-2, AC-4: the statblock
 * of one block's data under the `entries` settings, or null when there is
 * none (no stat fields in the settings, G0-C1; or no stat and no attack
 * set, AC-11). Keys compare in
 * lower case; values are read as the block reader reads them (AC-5).
 */
export function statblockModel(
  data: Readonly<Record<string, unknown>>,
  entries: unknown,
  context: StatblockContext,
): StatblockModel | null {
  const settings = (entries ?? {}) as EntriesSettings;
  const sb = settings.statblock ?? {};
  const fields = lowerKeys(data);
  const {single, lists, wrong} = readEntryValues(fields, settings);
  const lower = (key: string): string => key.toLowerCase();
  const statFields = sb.stats ?? [];
  const boxesKey = sb.boxes === undefined ? null : lower(sb.boxes);
  const anyStat = statFields.some((f) => single.has(lower(f.key)));
  // G0-C1: no stat keys in the preset → no statblock, whatever the block holds.
  if (statFields.length === 0) return null;
  if (!anyStat && !lists.has('attacks')) return null;

  const checks: StatblockCheck[] = [];
  const parts: StatblockPart[] = ['band'];

  // AC-12: the box row.
  let boxes = 0;
  let boxLabel: string | null = null;
  let boxValue: string | null = null;
  if (boxesKey !== null && single.has(boxesKey)) {
    boxValue = single.get(boxesKey) ?? null;
    // US-033 AC-9 (#139, SCAR-017): the label made in one place; the box
    // row prints it in upper case.
    boxLabel = (boxColumnLabel(sb.boxes, statFields) ?? '').toUpperCase();
    const n = boxValue === null ? null : asNumber(boxValue);
    if (n === null || !Number.isInteger(n) || n < 0) {
      checks.push({code: 'STAT_BOXES_NOT_NUMBER', detail: null});
    } else if (n > BOXES_MAX) {
      checks.push({code: 'STAT_BOXES_MANY', detail: String(n)});
    } else {
      boxes = n;
    }
    parts.push('boxes');
  }
  const rows = Math.ceil(boxes / BOXES_PER_ROW);

  // AC-13: the state track.
  const track = sb.track ?? [];
  let cells: TrackCell[] = [];
  if (track.length > 0) {
    const key = sb.trackKey === undefined ? null : lower(sb.trackKey);
    const asked = key === null ? undefined : lists.get(key);
    let wanted: string[];
    if (asked === undefined) {
      wanted = [...(sb.trackDefault ?? track.map((c) => c.label))];
    } else if (asked.length === 1 && lower(asked[0] ?? '') === 'none') {
      wanted = [];
    } else {
      wanted = asked;
      for (const label of asked) {
        if (!track.some((c) => lower(c.label) === lower(label)))
          checks.push({code: 'ENTRY_TRACK_UNKNOWN', detail: label});
      }
    }
    const set = new Set(wanted.map(lower));
    cells = track.filter((c) => set.has(lower(c.label)));
    if (cells.length > 0) parts.push('track');
  }

  // AC-10: the attributes and traits lines (the box value is not repeated).
  const line = (
    list: readonly {key: string; label: string}[],
  ): {text: string; values: StatblockValue[]} => {
    const values = list
      .filter((f) => lower(f.key) !== boxesKey)
      .map((f) => ({label: f.label, value: single.get(lower(f.key)) ?? null}));
    const set = values.some((v) => v.value !== null);
    if (!set) return {text: '', values: []};
    const shown =
      context.missing === 'dash'
        ? values
        : values.filter((v) => v.value !== null);
    return {
      text: shown.map((v) => `${v.label} ${v.value ?? '—'}`).join(' · '),
      values: shown,
    };
  };
  const attributes = line(statFields);
  if (attributes.text !== '') parts.push('attributes');
  const traits = line(sb.traits ?? []);
  if (traits.text !== '') parts.push('traits');

  // AC-14: tags, by their labels (leading # ignored, any case).
  const labels = new Map(
    Object.entries(settings.tagLabels ?? {}).map(([tag, label]) => [
      lower(tag.replace(/^#/, '')),
      label,
    ]),
  );
  const tagLabels: string[] = [];
  if (labels.size > 0) {
    for (const tag of lists.get('tags') ?? []) {
      const bare = tag.replace(/^#/, '');
      const label = labels.get(lower(bare));
      if (label === undefined)
        checks.push({code: 'TAG_UNMAPPED', detail: bare});
      else tagLabels.push(label);
    }
  }

  // AC-18: the sum rule.
  if (sb.sum !== undefined) {
    const total = asNumber(fields.get(lower(sb.sum.total)));
    const raw = sb.sum.of.map((k) => fields.get(lower(k)));
    const parts = raw.map(asNumber);
    if (total !== null && parts.every((p) => p !== null)) {
      const sum = (parts as number[]).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - total) > 1e-9) {
        checks.push({
          code: 'STAT_SUM_MISMATCH',
          detail: `${String(fields.get(lower(sb.sum.total)))} ≠ ${raw.map(String).join('+')}`,
        });
      }
    }
  }

  // AC-10, AC-18: attacks.
  const attacks = (lists.get('attacks') ?? []).map(splitAttack);
  (lists.get('attacks') ?? []).forEach((item, i) => {
    if (attacks[i]?.noDice === true)
      checks.push({code: 'STAT_ATTACK_NO_DICE', detail: `"${item}"`});
  });
  if (attacks.length > 0) parts.push('attacks');
  const skillItems = lists.get('skills') ?? [];
  if (skillItems.length > 0) parts.push('skills');
  if (tagLabels.length > 0) parts.push('tags');

  return {
    band: context.heading ?? context.fileName,
    boxes,
    rows,
    boxLabel,
    boxValue,
    cells,
    trackLabel: cells.length > 0 ? (sb.trackLabel ?? null) : null,
    parts,
    attributes: attributes.text,
    stats: attributes.values,
    traits: traits.text,
    traitValues: traits.values,
    attacks,
    skills: skillItems.length === 0 ? '' : `Skills: ${skillItems.join(', ')}`,
    skillItems,
    tags: tagLabels.join(' · '),
    tagLabels,
    checks,
    notices: [
      ...wrong.map((key) => `ENTRY_VALUE_NOT_TEXT: ${key}`),
      ...checks.map((c) =>
        c.detail === null ? c.code : `${c.code}: ${c.detail}`,
      ),
    ],
  };
}

/**
 * US-033 | AC-9 (amended for #139, G0 answer 14): the quick reference's box
 * column label: the label of the `stats` field whose key is the box key
 * (compared in lowercase), else the key with its first character in upper
 * case and the rest as written (`vigour` → `Vigour`, `hit_points` →
 * `Hit_points`), never the raw key; null without a box key. The one place
 * the table's label is made (SCAR-017); the statblock's own box row keeps
 * its upper-case label (`boxLabel` above, US-030 AC-12).
 */
export function boxColumnLabel(
  boxes: string | undefined,
  stats: readonly {key: string; label: string}[] | undefined,
): string | null {
  if (boxes === undefined) return null;
  const field = stats?.find((f) => f.key.toLowerCase() === boxes.toLowerCase());
  if (field !== undefined) return field.label;
  return boxes.charAt(0).toUpperCase() + boxes.slice(1);
}
