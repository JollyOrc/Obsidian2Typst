// US-010: the fonts (pure core). See the files for the acceptance criteria.
export {
  createFontCatalog,
  decodeCoverage,
  type CodePointRange,
  type FontCatalog,
} from './catalog';
export {
  fontArchiveIgnored,
  fontFileInvalid,
  fontFolderMissing,
  isFontArchive,
  isFontFile,
  isInFolder,
} from './warnings';
export {GLYPH_LIST_LIMIT, checkGlyphs, type GlyphLookup} from './glyphs';
export {
  FEATURE_GLYPHS,
  familyOptions,
  featureGlyphNotice,
  missingFeatureGlyphs,
  type FamilyOption,
  type FeatureGlyph,
} from './picker';
export {
  emitFonts,
  resolveFonts,
  type FamilyLookup,
  type ResolvedFonts,
  type ResolvedRole,
} from './resolve';
export {
  BUNDLED_CODE_FAMILY,
  BUNDLED_DEFAULT_FAMILY,
  DEFAULT_FONTS,
  FONT_ROLES,
  MAX_FONT_SIZE,
  mergeFonts,
  type FaceInfo,
  type FontRole,
  type FontRoleFields,
  type FontRoleSettings,
  type FontsPresetFields,
  type FontsSettings,
} from './types';
