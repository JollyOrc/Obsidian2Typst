// US-008: presets (pure core). See the files for the acceptance criteria.
export {BUILTIN_PRESET_TEXTS, emptyPresetText} from './builtin';
export {getField, withField, type FieldPath} from './edit';
export {UNGROUPED_HEADING, groupPresets, type PresetGroup} from './groups';
export {
  effectiveSettings,
  resolveFields,
  type EffectiveResult,
  type EffectiveSettings,
  type ResolvedFields,
} from './merge';
export {
  copyName,
  isPresetNote,
  nameKey,
  pickActive,
  planDelete,
  sortPresetNames,
  validatePresetName,
  type DeletePlan,
  type NameResult,
} from './names';
export {
  coverAction,
  editPresetField,
  headingRuleAction,
  type PresetChange,
  type PresetChangePlan,
} from './note-edit';
export {COUNTING_SYMBOLS, isValidNumbering} from './numbering';
export {
  NUMBERING_NOTICE,
  formatPresetError,
  parsePreset,
  readGroup,
  validateFields,
  type ParseResult,
  type PresetError,
  type ValidateResult,
} from './parse';
export {
  BUILTIN_DEFAULTS,
  PRESET_FIELDS,
  SCHEMA_VERSION,
  type BuiltinDefaults,
  type CoverPresetFields,
  type PagePresetFields,
  type PresetFields,
} from './schema';
