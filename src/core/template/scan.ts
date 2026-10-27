// US-008 AC-10, US-016 AC-11: finds the names a template defines at the top
// level, so that the plugin can tell when one of them shadows a Typst built-in
// or a name the plugin defines. Pure core.
import {STD_NAMES} from './std-names';

/** A top-level definition in a template; `line` is 1-based. */
export interface Definition {
  line: number;
  name: string;
}

const STD = new Set<string>(STD_NAMES);

// `#let name` or `#let name(` at line start; spaces or tabs after `#let`. A name
// is followed by anything that cannot continue it, so `#let quoted` is the name
// `quoted` and `#letquote` is no definition.
const DEFINITION = /^#let[ \t]+([\p{L}_][\p{L}\p{N}_-]*)/u;

/**
 * US-008 | AC-10; US-016 | AC-11: Scans `template` for top-level `#let name`
 * and `#let name(` definitions and returns all of them, in line order.
 *
 * The only transform: a leading byte-order mark is dropped before the lines are
 * counted (line numbers do not change). Definitions that are not at the start
 * of a line (a CR before the line break does not matter), or inside code
 * blocks, are not found (documented limit).
 */
export function scanDefinitions(template: string): Definition[] {
  const text = template.charCodeAt(0) === 0xfeff ? template.slice(1) : template;
  const found: Definition[] = [];
  text.split('\n').forEach((line, index) => {
    const name = DEFINITION.exec(line)?.[1];
    if (name !== undefined) found.push({line: index + 1, name});
  });
  return found;
}

/**
 * US-023 | AC-1, AC-2: True when `template` defines `template` at the top
 * level, so that the plugin applies it with `#show: template`. Uses the
 * definitions of {@link scanDefinitions} (its byte-order-mark and line-start
 * rules; the one scan, SCAR-017), so `#let templates`, an indented or a
 * commented definition do not count. Whether the value is a function is left
 * to the compiler (decision 2).
 */
export function definesTemplateHook(template: string): boolean {
  return scanDefinitions(template).some((d) => d.name === 'template');
}

/**
 * US-008 | AC-10: The definitions of {@link scanDefinitions} whose name is a
 * Typst standard-library name (the contract US-008 tests rely on; split from
 * `scanDefinitions` instead of changed, SCAR-001).
 */
export function scanTemplate(template: string): Definition[] {
  return scanDefinitions(template).filter((d) => STD.has(d.name));
}
