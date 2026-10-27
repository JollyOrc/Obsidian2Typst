// Author-defined markup (US-016 callouts, US-017 heading rules). Pure: no Obsidian, Node, or I/O
// imports; depends only on core/parse.
export {
  BUILTIN_CALLOUT_STYLES,
  CALLOUT_ALIASES,
  defaultCalloutTitle,
  findCallout,
  parseCalloutHeader,
  resolveCalloutStyle,
  type Callout,
  type CalloutHeader,
  type CalloutPresetStyle,
  type CalloutStyle,
  type CalloutsSettings,
  type ResolvedCallout,
} from './callout';
export {
  BUILTIN_HEADING_RULES,
  HEADING_RULE_NAMES,
  headingRuleKey,
  type HeadingRule,
  type HeadingRulesSettings,
} from './heading-rules';
export {
  EMPTY_GLOSSARY_PLAN,
  findGlossary,
  headingRuleTable,
  type GlossaryPlan,
  type GlossaryRole,
  type GlossaryWarning,
} from './glossary';
