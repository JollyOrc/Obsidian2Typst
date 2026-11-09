// US-038 AC-4, AC-16: the row's drawing model — which badges a block's data
// gives under the preset's `details` group, and its data checks. Pure: no
// Obsidian, Node, or I/O imports. The one model of the PDF emitter and the
// Obsidian preview and API (SCAR-017); the one place of key matching, value
// matching and the unmapped and not-text checks.
import {lowerKeys} from '../markers';
import type {DetailItem, DetailsSettings} from '../markers';

/** One badge of the row. */
export interface DetailBadge {
  /** The preset item's key. */
  key: string;
  /** The vault path of the icon; null: none. */
  icon: string | null;
  /** The preset's text for the value (plain text); null: none. */
  label: string | null;
  /** The value as written (trimmed; markup typeset by the writer), when no label replaces it; null otherwise. */
  value: string | null;
}

/** One data check of AC-4; `detail` after the heading (`pace: soon`, `kind`). */
export interface DetailCheck {
  code: 'DETAIL_VALUE_NOT_TEXT' | 'DETAIL_VALUE_UNMAPPED';
  detail: string;
}

/** What one block draws: the badges in the preset's order and the checks. */
export interface DetailsModel {
  badges: DetailBadge[];
  checks: DetailCheck[];
}

/** A value compared without case and surrounding spaces. */
const norm = (value: string): string => value.trim().toLowerCase();

/**
 * A map of value → text keyed by `norm`; an empty or missing map is
 * undefined (AC-4: an empty `labels` or `icons` counts as not set).
 */
function table(
  map: Readonly<Record<string, string>> | undefined,
): Map<string, string> | undefined {
  if (map === undefined) return undefined;
  const entries = Object.entries(map);
  if (entries.length === 0) return undefined;
  // The first of two keys that agree without case wins, as for block keys.
  const out = new Map<string, string>();
  for (const [key, text] of entries)
    if (!out.has(norm(key))) out.set(norm(key), text);
  return out;
}

const isUnset = (v: unknown): boolean =>
  v === null ||
  v === undefined ||
  v === false ||
  (typeof v === 'string' && v.trim() === '');

/**
 * US-038 | AC-4: the badges and checks of one block's data (a plain object
 * of properties, keys in any case) under `settings` (the `details` group,
 * as the preset parser gives it), or null when there is none (no group, or
 * no item). Transforms, in this order, per item of the preset: the key is
 * compared lower-cased (`lowerKeys`: the first of a case pair wins); `null`,
 * `false`, empty and blank text are not set; `true` is a flag (label and icon
 * of the item, or of `labels.true` / `icons.true`; nothing when it has
 * neither); a text or a finite number is text, `String(n)` trimmed, compared
 * with `trim().toLowerCase()` against the lower-cased, trimmed keys of the
 * item's maps; the label is `labels[value]`, else `label`, else none (then
 * the value is printed as written); the icon is `icons[value]`, else `icon`;
 * a value that the item's `labels` (without a `label`) or `icons` (without
 * an `icon`) do not know gives one `DETAIL_VALUE_UNMAPPED` for the item;
 * anything else (a list, a map, NaN) gives one `DETAIL_VALUE_NOT_TEXT` for
 * the key and the item draws nothing.
 */
export function detailsModel(
  data: Readonly<Record<string, unknown>>,
  settings: unknown,
): DetailsModel | null {
  const items = (settings as DetailsSettings | undefined)?.items;
  if (items === undefined || items.length === 0) return null;
  const fields = lowerKeys(data);
  const badges: DetailBadge[] = [];
  const checks: DetailCheck[] = [];
  for (const item of items) {
    const key = item.key.toLowerCase();
    const raw = fields.get(key);
    if (isUnset(raw)) continue;
    const labels = table(item.labels);
    const icons = table(item.icons);
    if (raw === true) {
      const label = labels?.get('true') ?? item.label ?? null;
      const icon = icons?.get('true') ?? item.icon ?? null;
      if (label !== null || icon !== null)
        badges.push({key, icon, label, value: null});
      continue;
    }
    if (!isText(raw)) {
      checks.push({code: 'DETAIL_VALUE_NOT_TEXT', detail: item.key});
      continue;
    }
    const written = String(raw).trim();
    const at = norm(written);
    const label = labels?.get(at) ?? item.label ?? null;
    const icon = icons?.get(at) ?? item.icon ?? null;
    if (unmapped(item, labels, icons, at))
      checks.push({
        code: 'DETAIL_VALUE_UNMAPPED',
        detail: `${item.key}: ${written}`,
      });
    badges.push({
      key,
      icon,
      label,
      value: label === null ? written : null,
    });
  }
  return {badges, checks};
}

const isText = (v: unknown): v is string | number =>
  typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));

/** True when a map of the item exists, lacks the value and has no single fallback. */
function unmapped(
  item: DetailItem,
  labels: Map<string, string> | undefined,
  icons: Map<string, string> | undefined,
  at: string,
): boolean {
  return (
    (labels !== undefined && !labels.has(at) && item.label === undefined) ||
    (icons !== undefined && !icons.has(at) && item.icon === undefined)
  );
}
