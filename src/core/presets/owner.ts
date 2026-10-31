// US-012 AC-2: who owns the value of a row in the style panel, the active
// preset or the Defaults. US-029 AC-3, AC-9: the value an export would use,
// with the built-in value from the export's own merge. Pure core: no Obsidian
// or I/O imports.
import {resolveFields, type ResolvedFields} from './merge';

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

/** The resolved built-in fields, made once on first use. */
let builtins: ResolvedFields | null = null;

/** Furniture fields that live under `page` in a preset but apart when resolved. */
const FURNITURE = ['folios', 'runningHeader', 'runningHeaderLevel'];

/**
 * US-029 | AC-3, AC-9: The built-in value of the Defaults field at `path` (a
 * preset field path, as the settings rows name it), read from
 * `resolveFields({}, {})` — the merge an export uses, so a screen cannot show
 * another built-in than the export takes (SCAR-017). The path is mapped onto
 * the resolved shape: `page.folios`, `page.runningHeader`,
 * `page.runningHeaderLevel` → `pageFurniture.*`; `page.breakBefore.hN` →
 * `breakBefore.hN`; every other path as it is. Undefined for a field without
 * a built-in of its own (`page.trimWidth`, `page.trimHeight`: the trim size
 * decides) and for font fields (not resolved here); `null` for `template`.
 */
export function builtinValue(path: readonly string[]): unknown {
  builtins ??= resolveFields({}, {});
  const [head, second, ...rest] = path;
  if (head === 'fonts') return undefined;
  if (head === 'page' && second !== undefined) {
    if (FURNITURE.includes(second) && rest.length === 0) {
      return valueAt(builtins.pageFurniture, [second]);
    }
    if (second === 'breakBefore') {
      return valueAt(builtins.breakBefore, rest);
    }
  }
  return valueAt(builtins, path);
}

/**
 * US-029 | AC-3: The value an export would use for the field at `path`: the
 * preset's when it owns the field (the rule of `ownerNote`, the trim group
 * included), else the Defaults' when they set it, else `builtinValue`.
 * Neither argument is changed.
 */
export function effectiveValue(
  presetFields: unknown,
  defaults: unknown,
  path: readonly string[],
): unknown {
  if (owns(presetFields, path)) return valueAt(presetFields, path);
  const fromDefaults = valueAt(defaults, path);
  if (isSet(fromDefaults)) return fromDefaults;
  return builtinValue(path);
}
