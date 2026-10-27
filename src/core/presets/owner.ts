// US-012 AC-2: who owns the value of a row in the style panel, the active
// preset or the Defaults. Pure core: no Obsidian or I/O imports.

/** Trim size, width and height are one group (US-009 AC-14). */
const TRIM_GROUP = ['trimSize', 'trimWidth', 'trimHeight'];

/** The value at `path` of a plain object, or undefined. */
function valueAt(root: unknown, path: readonly string[]): unknown {
  let node: unknown = root;
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** A value the preset really sets: not missing and not an empty YAML key. */
const isSet = (value: unknown): boolean =>
  value !== undefined && value !== null;

/** True when the preset sets the field at `path` (or, for the trim group, any member). */
function owns(presetFields: unknown, path: readonly string[]): boolean {
  const last = path[path.length - 1] ?? '';
  const inTrimGroup =
    path[0] === 'page' && path.length === 2 && TRIM_GROUP.includes(last);
  if (!inTrimGroup) return isSet(valueAt(presetFields, path));
  return TRIM_GROUP.some((key) => isSet(valueAt(presetFields, ['page', key])));
}

/**
 * US-012 AC-2: the description of a row whose value the preset sets, or null
 * when the row belongs to the Defaults and can be changed in the panel.
 * `presetFields` is the object read from the preset note (not changed).
 */
export function ownerNote(
  presetName: string,
  presetFields: unknown,
  path: readonly string[],
): string | null {
  return owns(presetFields, path)
    ? `Set by preset "${presetName}"; change it in the preset note`
    : null;
}

/**
 * US-012 AC-2: the value a row shows: the preset's when it owns the field,
 * otherwise the Defaults' value, otherwise undefined. Neither argument is
 * changed.
 */
export function shownValue(
  presetFields: unknown,
  defaults: unknown,
  path: readonly string[],
): unknown {
  if (owns(presetFields, path)) return valueAt(presetFields, path);
  return valueAt(defaults, path);
}
