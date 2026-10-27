// US-011 AC-1: the cover settings that `convert` takes. Pure core.

/** What the cover is taken from (US-011 AC-2, AC-3). */
export type CoverMode = 'auto' | 'file' | 'none';

/** The cover settings, all with a value. */
export interface CoverSettings {
  mode: CoverMode;
  /** Vault path of the cover image; used when `mode` is `file`. */
  file: string | null;
  /** True: a blank page follows the cover (AC-5). */
  blankPageAfter: boolean;
  /** A crop above this share in percent is reported (AC-6). */
  cropWarningPercent: number;
  /** True when `cover.back` is set in the preset; reserved (AC-10). */
  back: boolean;
}

/** US-011 AC-1: the built-in cover settings. */
export const DEFAULT_COVER: Readonly<CoverSettings> = {
  mode: 'auto',
  file: null,
  blankPageAfter: false,
  cropWarningPercent: 5,
  back: false,
};
