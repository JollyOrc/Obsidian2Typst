// US-010 AC-2, AC-4, AC-7: the families and sizes that an export uses, with the
// fallback chain and its warnings, and the four Typst lines. One function for
// the export now and the preview later. Pure core.
import type {Warning} from '../emit';
import {ptLength, typstString} from '../emit';
import type {FontCatalog} from './catalog';
import {
  BUNDLED_CODE_FAMILY,
  BUNDLED_DEFAULT_FAMILY,
  FONT_ROLES,
  type FontRole,
  type FontsSettings,
} from './types';

/** The family and the size (a Typst length like `10pt`, or null) of a role. */
export interface ResolvedRole {
  family: string;
  size: string | null;
}

/** AC-4: what the export writes. */
export interface ResolvedFonts {
  defaultFamily: string;
  body: ResolvedRole;
  heading: ResolvedRole;
  caption: ResolvedRole;
  code: ResolvedRole;
}

/** The part of the catalog that the resolution needs. */
export type FamilyLookup = Pick<FontCatalog, 'resolve'>;

/** A number of pt without trailing zeros (`ptLength`, shared with US-016). */
const length = (size: number | null): string | null =>
  size === null ? null : ptLength(size);

/**
 * AC-4: a family that is not available falls back to the default family (code:
 * the bundled code family), a default that is not available to the bundled
 * one; every configured family and role is reported once, at line 0. Without a
 * lookup the names are taken as written and nothing is reported.
 */
export function resolveFonts(
  settings: FontsSettings,
  lookup?: FamilyLookup,
): {fonts: ResolvedFonts; warnings: Warning[]} {
  const warnings: Warning[] = [];
  const found = (name: string): string | null =>
    lookup === undefined ? name.trim() : lookup.resolve(name);
  const bundled = (name: string): string => found(name) ?? name;

  let defaultFamily = found(settings.default);
  if (defaultFamily === null) {
    defaultFamily = bundled(BUNDLED_DEFAULT_FAMILY);
    warnings.push({
      code: 'FONT_MISSING',
      message: `Default font "${settings.default}" was not found; "${defaultFamily}" is used`,
      line: 0,
    });
  }

  const role = (name: FontRole): ResolvedRole => {
    const {family, size} = settings[name];
    const fallback =
      name === 'code' ? bundled(BUNDLED_CODE_FAMILY) : defaultFamily;
    let used = fallback;
    if (family !== null) {
      const match = found(family);
      if (match === null) {
        warnings.push({
          code: 'FONT_MISSING',
          message: `Font "${family}" for ${name} was not found; "${fallback}" is used`,
          line: 0,
        });
      } else used = match;
    }
    return {family: used, size: length(size)};
  };

  const [body, heading, caption, code] = FONT_ROLES.map(role) as [
    ResolvedRole,
    ResolvedRole,
    ResolvedRole,
    ResolvedRole,
  ];
  return {
    fonts: {defaultFamily, body, heading, caption, code},
    warnings,
  };
}

const RELATIVE_SIZE = '0.9em';

/** AC-2: the four lines of the preamble, in this order. */
export function emitFonts(fonts: ResolvedFonts): string {
  const text = (role: ResolvedRole, fallbackSize: string | null): string => {
    const size = role.size ?? fallbackSize;
    return `font: ${typstString(role.family)}${size === null ? '' : `, size: ${size}`}`;
  };
  return [
    `#set text(${text(fonts.body, null)})`,
    `#show heading: set text(${text(fonts.heading, null)})`,
    `#show raw: set text(${text(fonts.code, RELATIVE_SIZE)})`,
    `#show figure.caption: set text(${text(fonts.caption, RELATIVE_SIZE)})`,
  ].join('\n');
}
