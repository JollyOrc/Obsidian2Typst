// US-017: heading rules. Holds the rule names, the built-in mapping and the
// one function that brings a heading text or a mapping key into the form in
// which the two are compared (SCAR-017: the parser of the preset field and the
// matcher of the conversion both use it). Pure: no Obsidian, Node, or I/O
// imports.

/** US-017 AC-1: the rule a heading text maps to; `none` switches it off. */
export type HeadingRule = 'glossary' | 'none';

/** US-017 AC-1: heading texts mapped to rules, as written in the preset. */
export type HeadingRulesSettings = Readonly<Record<string, HeadingRule>>;

/** US-017 AC-1: the rule names a preset may use. */
export const HEADING_RULE_NAMES: readonly HeadingRule[] = Object.freeze([
  'glossary',
  'none',
]);

/**
 * US-017 | AC-1: The built-in mapping (decided by the user 2026-10-19). It
 * is used for every key the preset does not name; a preset entry with the
 * same comparison form ({@link headingRuleKey}) replaces it.
 */
export const BUILTIN_HEADING_RULES: HeadingRulesSettings = Object.freeze({
  Glossary: 'glossary',
});

/**
 * US-017 | AC-1, AC-2: The comparison form of a heading text or a key.
 *
 * Transforms, all of them (SCAR-001): (1) every run of white space becomes
 * one blank, (2) leading and trailing blanks are removed, (3) the text is
 * lower-cased with `toLowerCase` (no locale rules). (1) and (2) are the form
 * that `visibleText` of US-002 already gives a heading (decided by the user
 * 2026-10-19: `Tidal   Basin` matches `Tidal Basin`), so a key written by
 * hand compares equal to the heading it names. Never fails; `""` stays `""`.
 */
export function headingRuleKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
