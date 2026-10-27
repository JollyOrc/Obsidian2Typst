// US-016 AC-11: the names the plugin's preamble defines. Pure core.

/**
 * US-016 | AC-11, US-017 | AC-6: Every name a preamble rule defines with
 * `#let` (`fit-image` of US-003, `callout` and `callout-styles` of US-016,
 * `glossary-term` of US-017, `running-text` and `running-title` of US-019,
 * `page-ref` of US-018). The preamble comes
 * after the template import, so these replace a template's definition of the
 * same name; `templateWarnings` reports it. A text check in the US-016 tests
 * fails when the preamble defines a name that is not in this list.
 */
export const PLUGIN_NAMES: readonly string[] = Object.freeze([
  'callout',
  'callout-styles',
  'fit-image',
  'glossary-term',
  'page-ref',
  'running-text',
  'running-title',
]);
