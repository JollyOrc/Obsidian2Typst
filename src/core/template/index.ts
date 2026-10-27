// US-008 AC-10, AC-11, US-016 AC-11: the template file (pure core).
export {PLUGIN_NAMES} from './plugin-names';
export {
  definesTemplateHook,
  scanDefinitions,
  scanTemplate,
  type Definition,
} from './scan';
export {STD_NAMES} from './std-names';
export {missingTemplateWarning, templateWarnings} from './warnings';
