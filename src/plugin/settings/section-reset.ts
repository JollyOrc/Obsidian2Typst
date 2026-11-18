// US-042 AC-13: the reset of a whole section of the settings tab: which Defaults
// paths it removes, the question, and the reset itself. No Obsidian import.
import {STRINGS} from '../strings';
import type {DeleteConfirmation} from './dialog';
import {DEFAULT_ROWS, FONT_ROWS} from './row-data';
import {TAB_LAYOUT} from './layout';

/** US-042 AC-13 (P3): the sections with a reset. */
export const RESETTABLE_SECTIONS = ['Page', 'Text', 'Book'] as const;
export type ResettableSection = (typeof RESETTABLE_SECTIONS)[number];

const pathOf = (label: string): readonly string[] | undefined =>
  DEFAULT_ROWS.find((row) => row.label === label)?.path ??
  FONT_ROWS.find((row) => row.label === label)?.path;

/**
 * US-042 | AC-13: The Defaults paths of a section: each plain row's and each
 * feature's gear rows' (as `pathOf` finds them), and each feature's toggle
 * (a dotted Defaults path; `strictMode` is plugin data, not a Default).
 */
export function sectionResetPaths(name: ResettableSection): string[][] {
  const section = TAB_LAYOUT.find((s) => s.name === name);
  const paths: string[][] = [];
  for (const item of section?.items ?? []) {
    if (item.kind === 'plain') {
      const path = pathOf(item.label);
      if (path !== undefined) paths.push([...path]);
    }
    if (item.kind !== 'feature') continue;
    if (item.toggle !== undefined && item.toggle !== 'strictMode') {
      paths.push(item.toggle.split('.'));
    }
    for (const label of item.rows) {
      const path = pathOf(label);
      if (path !== undefined) paths.push([...path]);
    }
  }
  const seen = new Set<string>();
  return paths.filter((path) => {
    const key = path.join('.');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type Fields = Record<string, unknown>;
const isObject = (v: unknown): v is Fields =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * US-042 | AC-13: A copy of `fields` without the keys at `paths`; an object
 * left empty by a removal is removed too. `fields` is not changed.
 */
export function withoutPaths(
  fields: unknown,
  paths: readonly (readonly string[])[],
): unknown {
  const copy = structuredClone(fields) as unknown;
  if (!isObject(copy)) return copy;
  for (const path of paths) remove(copy, path);
  return copy;
}

function remove(obj: Fields, path: readonly string[]): void {
  const [head, ...rest] = path;
  if (head === undefined || !Object.prototype.hasOwnProperty.call(obj, head)) {
    return;
  }
  if (rest.length === 0) {
    delete obj[head];
    return;
  }
  const child = obj[head];
  if (!isObject(child)) return;
  remove(child, rest);
  if (Object.keys(child).length === 0) delete obj[head];
}

/** US-042 | AC-13: The question before a section reset (Cancel first: #174). */
export function resetSectionQuestion(name: string): DeleteConfirmation {
  return {
    title: STRINGS.sectionReset.title(name),
    lines: [STRINGS.sectionReset.line],
    confirmLabel: STRINGS.sectionReset.confirm,
    cancelLabel: STRINGS.sectionReset.cancel,
  };
}

/**
 * US-042 | AC-13: Resets a section: reads the Defaults now (SCAR-016); with
 * nothing to remove asks nothing; else asks, and on Reset reads the Defaults
 * again (a value changed while the question was open is kept unless it is
 * the section's) and saves once through `setDefaults`, the removal each
 * row's reset icon uses (SCAR-017). True when something was removed.
 */
export async function resetSection(
  deps: {
    settings: {
      readonly data: {defaults: unknown};
      setDefaults(fields: unknown): Promise<unknown>;
    };
    confirm(question: DeleteConfirmation): Promise<boolean>;
  },
  name: ResettableSection,
): Promise<boolean> {
  const before = deps.settings.data.defaults;
  const after = withoutPaths(before, sectionResetPaths(name));
  if (JSON.stringify(after) === JSON.stringify(before)) return false;
  if (!(await deps.confirm(resetSectionQuestion(name)))) return false;
  await deps.settings.setDefaults(
    withoutPaths(deps.settings.data.defaults, sectionResetPaths(name)),
  );
  return true;
}
