// US-008 AC-5, AC-8: rules for preset names. A name is the file name of the
// preset note. Pure core: no Obsidian, Node, or I/O imports.

const FORBIDDEN = /[/\\:*?"<>|]/;
const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_LENGTH = 100;

export type NameResult = {ok: true; name: string} | {ok: false; error: string};

/**
 * The form in which names are compared: Unicode NFC, then lower case. The
 * invariant is "no two names have the same key" (SCAR-011), so `Ä` as one
 * character and as `A` plus a combining diaeresis are the same name.
 */
export function nameKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}

/** Orders names case-insensitively, then by code point (NFC first). */
export function sortPresetNames(names: readonly string[]): string[] {
  const key = (n: string): string => nameKey(n);
  return [...names].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return compareCodePoints(ka, kb);
  });
}

function compareCodePoints(a: string, b: string): number {
  const ca = Array.from(a);
  const cb = Array.from(b);
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i++) {
    const x = (ca[i] as string).codePointAt(0) as number;
    const y = (cb[i] as string).codePointAt(0) as number;
    if (x !== y) return x - y;
  }
  return ca.length - cb.length;
}

/**
 * Checks a new name. `existing` are the names in use; `own` is the name of the
 * preset that is being renamed, which may keep its own name (also in another
 * case or normalisation). The name is trimmed and returned in NFC.
 */
export function validatePresetName(
  raw: string,
  existing: readonly string[],
  own?: string,
): NameResult {
  const name = raw.trim().normalize('NFC');
  if (name === '') return {ok: false, error: 'A preset needs a name'};
  if (FORBIDDEN.test(name)) {
    return {
      ok: false,
      error: 'A preset name cannot contain / \\ : * ? " < > |',
    };
  }
  if (name.startsWith('.')) {
    return {ok: false, error: 'A preset name cannot start with a dot'};
  }
  if (name.endsWith('.')) {
    return {ok: false, error: 'A preset name cannot end with a dot'};
  }
  if (Array.from(name).length > MAX_LENGTH) {
    return {
      ok: false,
      error: `A preset name is too long (${MAX_LENGTH} characters at most)`,
    };
  }
  const base = name.split('.')[0] as string;
  if (DEVICE_NAME.test(base.trimEnd())) {
    return {ok: false, error: 'A preset name cannot be a Windows device name'};
  }
  const key = nameKey(name);
  const ownKey = own === undefined ? null : nameKey(own);
  if (existing.some((n) => nameKey(n) === key && nameKey(n) !== ownKey)) {
    return {ok: false, error: 'A preset with this name already exists'};
  }
  return {ok: true, name};
}

/** The name of a duplicate: `<name> copy`, `<name> copy 2`, and so on. */
export function copyName(name: string, existing: readonly string[]): string {
  const base = name.normalize('NFC');
  const taken = new Set(existing.map(nameKey));
  let candidate = `${base} copy`;
  for (let n = 2; taken.has(nameKey(candidate)); n++) {
    candidate = `${base} copy ${n}`;
  }
  return candidate;
}

export type DeletePlan =
  {ok: true; active: string} | {ok: false; error: string};

/**
 * Which preset is active after `deleted` is removed: the active one stays, or
 * the first in alphabetical order when the active one is deleted. The last
 * preset cannot be deleted.
 */
export function planDelete(
  names: readonly string[],
  deleted: string,
  active: string,
): DeletePlan {
  const rest = names.filter((n) => nameKey(n) !== nameKey(deleted));
  if (rest.length === 0) {
    return {ok: false, error: 'The last preset cannot be deleted'};
  }
  if (nameKey(active) !== nameKey(deleted) && rest.some((n) => n === active)) {
    return {ok: true, active};
  }
  return {ok: true, active: sortPresetNames(rest)[0] as string};
}

/**
 * US-008 AC-3, US-020 AC-6, US-022 AC-6: true when the vault path `path` is a
 * note inside the presets folder `folder` (a preset note): it is not exported
 * and its menus get no item. The one place that decides it (SCAR-017; a text
 * check in the US-022 tests). Compares the path as written, as Obsidian gives
 * it; a folder named like the prefix (`Presets2/` for `Presets`) is not inside.
 */
export function isPresetNote(path: string, folder: string): boolean {
  return path.startsWith(`${folder}/`);
}

/**
 * US-008 AC-8: the stored active preset if it exists, else the first in
 * alphabetical order, else `null`.
 */
export function pickActive(
  names: readonly string[],
  stored: string,
): string | null {
  if (names.includes(stored)) return stored;
  return sortPresetNames(names)[0] ?? null;
}
