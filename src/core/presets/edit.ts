// US-008 AC-1: reading and replacing one field of the Defaults, by path, for
// the settings tab. Pure core: no Obsidian, Node, or I/O imports.
import type {PresetFields} from './schema';

/** The path of a field: `['highlightColor']`, `['page', 'margins', 'top']`. */
export type FieldPath = readonly string[];

/** The value at `path`, or `undefined` when a part of the path is missing. */
export function getField(fields: PresetFields, path: FieldPath): unknown {
  let node: unknown = fields;
  for (const key of path) {
    if (
      typeof node !== 'object' ||
      node === null ||
      !Object.hasOwn(node, key)
    ) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/**
 * A copy of `fields` with the value at `path` replaced. `undefined` removes the
 * field, and a group (`page`, `margins`) that becomes empty is removed with
 * it. `fields` is not changed.
 */
export function withField(
  fields: PresetFields,
  path: FieldPath,
  value: unknown,
): PresetFields {
  const copy = JSON.parse(JSON.stringify(fields)) as Record<string, unknown>;
  const put = (node: Record<string, unknown>, rest: FieldPath): void => {
    const [key, ...tail] = rest as [string, ...string[]];
    if (tail.length === 0) {
      if (value === undefined) delete node[key];
      else node[key] = value;
      return;
    }
    const child = node[key];
    const group =
      typeof child === 'object' && child !== null && !Array.isArray(child)
        ? (child as Record<string, unknown>)
        : {};
    if (value !== undefined || Object.hasOwn(node, key)) put(group, tail);
    if (Object.keys(group).length === 0) delete node[key];
    else node[key] = group;
  };
  put(copy, path);
  return copy as PresetFields;
}
