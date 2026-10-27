// US-008 AC-10, AC-11: the warnings about a template. Pure core.
import type {Warning} from '../emit';
import {PLUGIN_NAMES} from './plugin-names';
import {scanDefinitions} from './scan';
import {STD_NAMES} from './std-names';

const STD = new Set<string>(STD_NAMES);
const PLUGIN = new Set<string>(PLUGIN_NAMES);

// US-023 AC-5: `#set` or `#show` at line start, not followed by a character
// that would continue a name (`#showcase`, `#settings`, `#set-up` are others).
const RULE = /^#(?:set|show)(?![\p{L}\p{N}_-])/u;

/**
 * US-023 | AC-5: The 1-based lines of `template` that start a top-level
 * `#set` or `#show` rule. Same transform as the definition scan: a leading
 * byte-order mark is dropped (line numbers do not change). A rule at line
 * start inside a content block is found too (decision 1: accepted).
 */
function ruleLines(template: string): number[] {
  const text = template.charCodeAt(0) === 0xfeff ? template.slice(1) : template;
  const lines: number[] = [];
  text.split('\n').forEach((line, index) => {
    if (RULE.test(line)) lines.push(index + 1);
  });
  return lines;
}

/**
 * US-008 | AC-10; US-016 | AC-11: One warning per top-level definition of the
 * template, in line order: `TEMPLATE_SHADOWS_BUILTIN` for a Typst
 * standard-library name (the template's definition stays in effect),
 * `TEMPLATE_NAME_TAKEN` for a name the plugin defines (the plugin's definition
 * is used, because the preamble comes after the template import). Other names
 * give nothing. US-023 AC-5: `TEMPLATE_RULE_IGNORED` for every top-level
 * `#set` or `#show` line, which never applies through the import. All in line
 * order, at line 0 (the line is in the message).
 */
export function templateWarnings(template: string): Warning[] {
  const found: {at: number; code: string; message: string}[] = [];
  for (const {line, name} of scanDefinitions(template)) {
    if (STD.has(name)) {
      found.push({
        at: line,
        code: 'TEMPLATE_SHADOWS_BUILTIN',
        message: `Template line ${line} defines "${name}", which shadows a Typst built-in`,
      });
    } else if (PLUGIN.has(name)) {
      found.push({
        at: line,
        code: 'TEMPLATE_NAME_TAKEN',
        message: `Template line ${line} defines "${name}", which the plugin also defines; the plugin's definition is used`,
      });
    }
  }
  for (const line of ruleLines(template)) {
    found.push({
      at: line,
      code: 'TEMPLATE_RULE_IGNORED',
      message: `Template rule at line ${line} does not apply; put it inside template(doc)`,
    });
  }
  return found
    .sort((a, b) => a.at - b.at)
    .map(({code, message}) => ({code, message, line: 0}));
}

/** US-008 AC-11: the warning for a template file that does not exist. */
export function missingTemplateWarning(path: string): Warning {
  return {
    code: 'TEMPLATE_MISSING',
    message: `Template "${path}" does not exist; the export continues without it`,
    line: 0,
  };
}
