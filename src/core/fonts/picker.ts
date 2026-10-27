// US-010 AC-5b, AC-6: the glyphs that features need and what the font picker of
// the settings tab shows. Pure core.
import type {FontCatalog} from './catalog';

/** A character that a feature needs from the font. */
export interface FeatureGlyph {
  char: string;
  codePoint: number;
}

/** AC-5b: the task-list glyphs (US-005 AC-6); later features add to it. */
export const FEATURE_GLYPHS: readonly FeatureGlyph[] = [
  {char: '☐', codePoint: 0x2610},
  {char: '☒', codePoint: 0x2612},
];

/** AC-6: the feature glyphs that `family` lacks. */
export function missingFeatureGlyphs(
  catalog: Pick<FontCatalog, 'hasGlyph'>,
  family: string,
): FeatureGlyph[] {
  return FEATURE_GLYPHS.filter((g) => !catalog.hasGlyph(family, g.codePoint));
}

/** AC-6: the text under the picker, or null when nothing is missing. */
export function featureGlyphNotice(
  missing: readonly FeatureGlyph[],
): string | null {
  if (missing.length === 0) return null;
  const list = missing
    .map((g) => `${g.char} U+${g.codePoint.toString(16).toUpperCase()}`)
    .join(', ');
  return `Missing: ${list}. Task lists will use [ ] and [x].`;
}

/** One entry of a family dropdown. */
export interface FamilyOption {
  value: string;
  label: string;
}

/**
 * AC-6: the entries of a dropdown: the available families sorted without
 * regard to case, an entry for the current value first when it is not found
 * (`<name> (not found)`), and for a role an entry to use the default family.
 */
export function familyOptions(
  available: readonly string[],
  current: string | null,
  options: {allowUnset?: boolean} = {},
): FamilyOption[] {
  const sorted = [...available].sort((a, b) => {
    const [x, y] = [a.toLowerCase(), b.toLowerCase()];
    return x < y ? -1 : x > y ? 1 : 0;
  });
  const result: FamilyOption[] = [];
  if (options.allowUnset === true) {
    result.push({value: '', label: '(default family)'});
  }
  if (
    current !== null &&
    current.trim() !== '' &&
    !sorted.some((name) => name.toLowerCase() === current.trim().toLowerCase())
  ) {
    result.push({value: current, label: `${current} (not found)`});
  }
  for (const name of sorted) result.push({value: name, label: name});
  return result;
}
