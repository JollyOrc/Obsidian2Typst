// US-016 AC-11: the names the plugin's preamble defines. Pure core.

/**
 * US-016 | AC-11, US-017 | AC-6: Every name a preamble rule defines with
 * `#let` (`fit-image` of US-003, `callout` and `callout-styles` of US-016,
 * `glossary-term` of US-017, `running-text` and `running-title` of US-019,
 * `page-ref` of US-018, `o2t-blank` of US-025, `o2t-part` of US-026, `fit-flow`
 * of US-028 with its labels' prefix `o2t-fit` and `o2t-fit-decision`, and
 * its hints `o2t-fit-hints` and `o2t-fit-pinned`, AC-17; `o2t-statblock` of
 * US-030 AC-15; `o2t-entries`, `o2t-entry-mark`, `o2t-entry-end`, `o2t-even`,
 * `o2t-fitted` of US-031; `o2t-continued` of US-032; `o2t-chapter-header`, `o2t-section-end` of US-033). The
 * preamble comes
 * after the template import, so these replace a template's definition of the
 * same name; `templateWarnings` reports it. A text check in the US-016 tests
 * fails when the preamble defines a name that is not in this list.
 */
export const PLUGIN_NAMES: readonly string[] = Object.freeze([
  'callout',
  'callout-styles',
  'fit-flow',
  'fit-image',
  'glossary-term',
  'o2t-blank',
  'o2t-chapter-header',
  'o2t-continued',
  'o2t-entries',
  'o2t-entry-end',
  'o2t-entry-mark',
  'o2t-even',
  'o2t-fit',
  'o2t-fit-decision',
  'o2t-fit-hints',
  'o2t-fit-pinned',
  'o2t-fitted',
  'o2t-part',
  'o2t-section-end',
  'o2t-statblock',
  'page-ref',
  'running-text',
  'running-title',
]);
