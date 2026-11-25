// US-043 AC-2 to AC-6: what the rows of one encounter block hold — the rows
// from the counts, their labels, and each row's values read with the entry
// reader's rules (SCAR-017: `readEntryValues`, `trackCells`, `splitAttack`).
// Pure: no Obsidian, Node, or I/O imports. The emitter draws this model.
import {
  BOXES_MAX,
  plainNumber,
  splitAttack,
  trackCells,
  type StatblockCheck,
} from '../entries/model';
import {
  lowerKeys,
  readEntryValues,
  type EncounterRead,
  type EncounterWarning,
  type EntriesSettings,
} from '../markers';

/** AC-2: the most rows one line gives. */
export const ROWS_MAX = 99;

/** AC-5, AC-6: one row the helper draws. */
export interface EncounterRowModel {
  label: string;
  /** The line's note (with a dice count first) on its first row; else null. */
  note: string | null;
  /** AC-6: no data to fill in: the blank sheet's row with the label. */
  blank: boolean;
  /** One value per stat of the preset, in its order; '' when not set. */
  stats: string[];
  /** `Label value` of each trait that is set, in the preset's order. */
  traits: string[];
  boxes: number;
  /** The track cells' labels, in track order. */
  cells: string[];
  attacks: {name: string; dice: string}[];
  /** AC-6: write-in attack slots (3 for a blank row, else 0). */
  slots: number;
}

/** AC-1 to AC-6: the model of one block. */
export interface EncounterModel {
  title: string | null;
  rows: EncounterRowModel[];
  warnings: EncounterWarning[];
}

/**
 * US-043 | AC-2: the rows a count gives, or null when it is no count: text
 * `N` (digits) → N; `NdM` or `dM` (N, M at least 1) → N × M, the highest
 * roll. Anything else (a number, `two`, `1d`, `-1`, `2.5`) → null. Not
 * capped (the model caps at `ROWS_MAX`).
 */
export function parseCount(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) return Number(text);
  const dice = /^(\d*)d(\d+)$/.exec(text);
  if (dice === null) return null;
  const n = dice[1] === '' ? 1 : Number(dice[1]);
  const m = Number(dice[2]);
  return n >= 1 && m >= 1 ? n * m : null;
}

/**
 * US-043 | AC-3: the labels of the rows, in block order. A line of one row
 * takes its name, a line of more `name 1`, `name 2`, …; a label already
 * taken (a one-row line's name anywhere in the block, or an earlier label)
 * is skipped for the next free number, counted from 1 for a numbered line
 * and from 2 for a repeated one-row name. No two labels are equal.
 */
function labelRows(lines: readonly {name: string; rows: number}[]): string[][] {
  const reserved = new Set(
    lines.filter((l) => l.rows === 1).map((l) => l.name),
  );
  const taken = new Set<string>();
  return lines.map(({name, rows}) => {
    const labels: string[] = [];
    if (rows === 1 && !taken.has(name)) {
      taken.add(name);
      return [name];
    }
    let n = rows === 1 ? 2 : 1;
    while (labels.length < rows) {
      const label = `${name} ${n}`;
      n += 1;
      if (taken.has(label) || reserved.has(label)) continue;
      taken.add(label);
      labels.push(label);
    }
    return labels;
  });
}

/**
 * US-043 | AC-2 to AC-6: the rows of one read block. Counts per AC-2 (bad →
 * no rows and `ENCOUNTER_COUNT_INVALID "name": count`; over 99 → 99 and
 * `ENCOUNTER_COUNT_CAPPED "name": count → 99`); labels per AC-3; a dice
 * count puts `NdM (up to K)` before the note on the line's first row. A row
 * with a stat, a box value or an attack is prefilled (AC-5): stats in the
 * preset's order ('' unset), traits set, exactly the box value's boxes (over
 * 45 → 45 and `ENCOUNTER_BOXES_CAPPED "name": n → 45`), the own track, every
 * attack; otherwise blank (AC-6): `blankBoxes` boxes, every track cell, three
 * slots. The entry reader's warnings name the line's name.
 */
export function encounterModel(
  read: EncounterRead,
  entries: EntriesSettings | undefined,
  options: {blankBoxes: number},
): EncounterModel {
  const warnings: EncounterWarning[] = [...read.warnings];
  const sb = entries?.statblock ?? {};
  const statFields = sb.stats ?? [];
  const lower = (key: string): string => key.toLowerCase();
  const boxesKey = sb.boxes === undefined ? null : lower(sb.boxes);
  const allCells = (sb.track ?? []).map((c) => c.label);

  const counted = read.lines.map((line) => {
    const parsed = parseCount(line.count);
    const written =
      typeof line.count === 'string' ? line.count : String(line.count);
    if (parsed === null) {
      warnings.push({
        code: 'ENCOUNTER_COUNT_INVALID',
        message: `"${line.name}": ${written}`,
        line: line.line,
      });
      return {line, rows: 0, written, dice: false};
    }
    if (parsed > ROWS_MAX) {
      warnings.push({
        code: 'ENCOUNTER_COUNT_CAPPED',
        message: `"${line.name}": ${written} → ${ROWS_MAX}`,
        line: line.line,
      });
    }
    return {
      line,
      rows: Math.min(parsed, ROWS_MAX),
      written: written.trim(),
      dice: /d/.test(written),
    };
  });
  const labels = labelRows(
    counted.map((c) => ({name: c.line.name, rows: c.rows})),
  );

  const rows: EncounterRowModel[] = [];
  counted.forEach(({line, rows: n, written, dice}, index) => {
    if (n === 0) return;
    const fields = lowerKeys(line.data ?? {});
    const {single, lists, wrong} = readEntryValues(fields, entries);
    const checks: StatblockCheck[] = [];
    for (const key of wrong) {
      warnings.push({
        code: 'ENTRY_VALUE_NOT_TEXT',
        message: `"${line.name}": ${key}`,
        line: line.line,
      });
    }
    let boxes = 0;
    const boxText = boxesKey === null ? undefined : single.get(boxesKey);
    const boxNumber = boxText === undefined ? null : plainNumber(boxText);
    if (boxNumber !== null && Number.isInteger(boxNumber) && boxNumber >= 0) {
      boxes = Math.min(boxNumber, BOXES_MAX);
      if (boxNumber > BOXES_MAX) {
        warnings.push({
          code: 'ENCOUNTER_BOXES_CAPPED',
          message: `"${line.name}": ${boxNumber} → ${BOXES_MAX}`,
          line: line.line,
        });
      }
    }
    const stats = statFields.map((f) => single.get(lower(f.key)) ?? '');
    const attacks = (lists.get('attacks') ?? []).map((item) => {
      const {name, dice: d} = splitAttack(item);
      return {name, dice: d};
    });
    const blank =
      line.data === null ||
      (!stats.some((s) => s !== '') &&
        boxNumber === null &&
        attacks.length === 0);
    const cells = blank
      ? allCells
      : trackCells(sb, lists, checks).map((c) => c.label);
    for (const check of checks) {
      warnings.push({
        code: check.code as EncounterWarning['code'],
        message: `"${line.name}": ${check.detail ?? ''}`,
        line: line.line,
      });
    }
    const traits = (sb.traits ?? [])
      .filter((f) => single.has(lower(f.key)))
      .map((f) => `${f.label} ${single.get(lower(f.key)) ?? ''}`);
    const lineLabels = labels[index] ?? [];
    for (let i = 0; i < n; i++) {
      const first = i === 0;
      const prefix = dice && first ? `${written} (up to ${n})` : null;
      const note = first
        ? [prefix, line.note].filter((x) => x !== null).join(' — ')
        : '';
      rows.push({
        label: lineLabels[i] ?? line.name,
        note: note === '' ? null : note,
        blank,
        stats: blank ? statFields.map(() => '') : stats,
        traits: blank ? [] : traits,
        boxes: blank ? options.blankBoxes : boxes,
        cells,
        attacks: blank ? [] : attacks,
        slots: blank ? 3 : 0,
      });
    }
  });
  return {title: read.title, rows, warnings};
}
