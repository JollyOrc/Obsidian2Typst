// US-007 AC-13: the default fonts embedded in main.js, decoded on first use.
import defaultFontTexts from 'embedded:default-fonts';
import {lazyFonts} from './default-fonts';

/** The decoded default font files; decodes on the first call only. */
export const embeddedFonts = lazyFonts(defaultFontTexts);
