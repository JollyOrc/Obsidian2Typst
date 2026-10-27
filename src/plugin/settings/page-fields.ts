// US-009 AC-12, AC-13: the rules behind the trim size dropdown and the gutter
// field of the settings tab. Pure: no Obsidian imports.
//
// Transforms (SCAR-001): `planTrimChoice` returns a new object and never
// changes its argument; a named size stores `trimSize` and removes `trimWidth`
// and `trimHeight` (they would win over the name, US-009 AC-1), `(built-in)`
// removes all three, `Custom` changes nothing.
import {NAMED_SIZES} from '../../core/layout/page-setup';
import type {PagePresetFields} from '../../core/presets/schema';
import type {DeleteConfirmation} from './dialog';

export const BUILTIN_CHOICE = '(built-in)';
export const CUSTOM_CHOICE = 'Custom';

/** The entries of the dropdown, in this order. */
export const TRIM_CHOICES = [
  BUILTIN_CHOICE,
  ...Object.keys(NAMED_SIZES),
  CUSTOM_CHOICE,
] as const;

type Page = PagePresetFields | undefined;

/** What the dropdown shows for the page group of the Defaults. */
export function trimChoiceOf(page: Page): string {
  if (page?.trimWidth !== undefined || page?.trimHeight !== undefined) {
    return CUSTOM_CHOICE;
  }
  const name = page?.trimSize;
  return name !== undefined && name in NAMED_SIZES ? name : BUILTIN_CHOICE;
}

export interface TrimPlan {
  /** The new page group to save. */
  page: PagePresetFields;
  /** The question to ask before saving; null when nothing needs one. */
  confirm: DeleteConfirmation | null;
}

/** What choosing `choice` saves, and the question before it (SCAR-014). */
export function planTrimChoice(page: Page, choice: string): TrimPlan {
  const next: PagePresetFields = {...(page ?? {})};
  if (choice === CUSTOM_CHOICE) return {page: page ?? {}, confirm: null};
  delete next.trimWidth;
  delete next.trimHeight;
  if (choice === BUILTIN_CHOICE) delete next.trimSize;
  else next.trimSize = choice;
  const had = page?.trimWidth !== undefined || page?.trimHeight !== undefined;
  if (!had) return {page: next, confirm: null};
  const width = page?.trimWidth ?? '–';
  const height = page?.trimHeight ?? '–';
  const use =
    choice === BUILTIN_CHOICE
      ? 'the built-in trim size'
      : `the trim size "${choice}"`;
  return {
    page: next,
    confirm: {
      title: 'Remove the custom trim size?',
      lines: [
        `The values "${width} × ${height} mm" are removed from the Defaults. Presets that do not set them use ${use}.`,
      ],
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    },
  };
}

export interface TrimSizesPlan {
  /** The new page group to save; null when nothing may be saved yet. */
  page: PagePresetFields | null;
  /** The description for the two rows when nothing is saved; else null. */
  hint: string | null;
}

export const TRIM_SIZES_HINT =
  'Enter width and height; they are saved together';

/**
 * US-009 AC-12: the width and the height are saved together, never one alone
 * (a lone value makes every preset invalid, AC-10). `width` and `height` are
 * the texts of the two fields. Both numbers: both saved; both empty: both
 * removed; anything else: nothing saved and the hint. A number that AC-2 refuses
 * is saved as typed and refused by the validation. Returns a new object.
 */
export function planTrimSizes(
  page: Page,
  width: string,
  height: string,
): TrimSizesPlan {
  const read = (text: string): number | 'empty' | 'bad' => {
    const t = text.trim();
    if (t === '') return 'empty';
    const n = Number(t);
    return Number.isFinite(n) ? n : 'bad';
  };
  const w = read(width);
  const h = read(height);
  const next: PagePresetFields = {...(page ?? {})};
  if (w === 'empty' && h === 'empty') {
    delete next.trimWidth;
    delete next.trimHeight;
    return {page: next, hint: null};
  }
  if (typeof w === 'number' && typeof h === 'number') {
    next.trimWidth = w;
    next.trimHeight = h;
    return {page: next, hint: null};
  }
  return {page: null, hint: TRIM_SIZES_HINT};
}

/** The gutter field is enabled while the Defaults have facing pages on. */
export function gutterEnabled(page: Page): boolean {
  return page?.facingPages === true;
}
