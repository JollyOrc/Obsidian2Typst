// Typst output helpers (US-013). Pure: no Obsidian, Node, or I/O imports.
export {
  MARKUP_TRANSFORMS,
  escapeMarkup,
  type MarkupOptions,
  type Transform,
} from './escape-markup';
export {emitBlocks, type BlockOptions} from './blocks';
export {FIT_IMAGE_HELPER, imageRequest} from './image';
export {headingNumberingRule} from './heading';
export {FOOTNOTE_RESTART_RULE, type NoteEnv} from './footnote';
export {DEFAULT_BODY_FAMILY, type FontInfo} from './tasks';
export {CALL_TRANSFORMS, callSeparator} from './call';
export {EmitContext, type Warning} from './context';
export {
  emitInline,
  type InlineOptions,
  type LinkEnv,
  type Where,
} from './inline';
export {
  EMPHASIS_TRANSFORMS,
  wrapEmphasis,
  type EmphasisContext,
} from './emphasis';
export {RAW_TRANSFORMS, rawBlock, rawInline} from './raw';
export {STRING_TRANSFORMS, typstString} from './typst-string';
export {ptLength} from './length';
export {
  CALLOUT_HELPER,
  calloutStylesRule,
  createCalloutRecorder,
  type CalloutRecorder,
  type CalloutStyleEntry,
} from './callout';
export {
  GLOSSARY_HELPER,
  emitTermAlone,
  emitTermRunIn,
  emitUnnumberedHeading,
} from './glossary';
export {
  RUNNING_TEXT_HELPER,
  RUNNING_TITLE_HELPER,
  pageFurnitureRule,
} from './furniture';
export {pageRefCall, pageRefHelper, type PageRefEnv} from './page-refs';
