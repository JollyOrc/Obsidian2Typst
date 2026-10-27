// US-022: changing one key of a preset note, and planning the change a menu
// item makes. Pure core: no Obsidian, Node, or I/O imports; nothing is written
// here (the plugin's `changePreset` action writes, SCAR-017). The note is
// edited with the `yaml` Document API, which keeps the other keys, their order
// and their comments; its re-spacing (blanks before a comment, a blank line
// before a final comment, flow maps, quoting) was measured and accepted by the
// user (2026-10-21).
import {isMap, parseDocument, type Document} from 'yaml';
import {headingRuleKey, headingRuleTable, type HeadingRule} from '../markers';
import {frontmatterSpan} from './parse';
import type {PresetFields} from './schema';

/**
 * US-022 AC-2, AC-4: one change of a preset note. A heading rule: `rule` is
 * the value to write for the heading text, or null to remove the key. The
 * cover: a vault path makes it `mode: file` with that file; null goes back to
 * `mode: auto` without a file.
 */
export type PresetChange =
  | {kind: 'heading-rule'; text: string; rule: HeadingRule | null}
  | {kind: 'cover'; file: string | null};

/** What a menu item does: its title, the change, and the question first. */
export interface PresetChangePlan {
  title: string;
  change: PresetChange;
  question: string;
}

/** The key of `map` whose comparison form is `key`'s, or undefined. */
function keyOfForm(doc: Document, key: string): string | undefined {
  const map = doc.getIn(['headingRules']);
  if (!isMap(map)) return undefined;
  for (const pair of map.items) {
    const text = String(
      (pair.key as {value?: unknown} | null)?.value ?? pair.key,
    );
    if (headingRuleKey(text) === key) return text;
  }
  return undefined;
}

/**
 * US-022 | AC-2, AC-4, AC-7: The text of the preset note `text` after
 * `change`: only the frontmatter's YAML is replaced (with the line end of the
 * note), every byte before and after it stays. A heading rule is written for
 * the heading text, or for a key of the same comparison form already present
 * (changed or removed in place, never doubled); a `headingRules` map that
 * becomes empty is removed. A note without frontmatter, with an unclosed one,
 * or whose frontmatter is not a YAML mapping is not changed: the result says
 * why.
 */
export function editPresetField(
  text: string,
  change: PresetChange,
): {ok: true; text: string} | {ok: false; error: string} {
  const span = frontmatterSpan(text);
  if (span === null) {
    return {ok: false, error: 'The preset note has no frontmatter'};
  }
  if ('unclosed' in span) {
    return {ok: false, error: 'Frontmatter is not closed'};
  }
  const doc = parseDocument(span.yaml, {prettyErrors: false});
  const error = doc.errors[0];
  if (error !== undefined) return {ok: false, error: error.message};
  if (!isMap(doc.contents)) {
    return {ok: false, error: 'The frontmatter is not a group of settings'};
  }
  if (change.kind === 'heading-rule') {
    const present = keyOfForm(doc, headingRuleKey(change.text));
    if (change.rule === null) {
      if (present !== undefined) doc.deleteIn(['headingRules', present]);
      const map = doc.getIn(['headingRules']);
      if (isMap(map) && map.items.length === 0) doc.deleteIn(['headingRules']);
    } else {
      doc.setIn(['headingRules', present ?? change.text], change.rule);
    }
  } else if (change.file === null) {
    doc.setIn(['cover', 'mode'], 'auto');
    doc.deleteIn(['cover', 'file']);
  } else {
    doc.setIn(['cover', 'mode'], 'file');
    doc.setIn(['cover', 'file'], change.file);
  }
  const yaml = String(doc).replace(/\n/g, span.eol);
  return {
    ok: true,
    text: text.slice(0, span.start) + yaml + text.slice(span.end),
  };
}

/**
 * US-022 | AC-1, AC-2, AC-5: The item for a heading whose visible text is
 * `text`, for the preset `presetName` with `fields`. In use when the rule
 * table (the built-in mapping and the preset's) maps the text to `glossary`.
 * The smallest change: to use it, remove a preset `none` where the built-in
 * rule applies, else write `glossary`; to stop, write `none` where the
 * built-in rule applies, else remove the preset key. The question's verb
 * follows the change: `Add … to` for a new key with `glossary`, `Set … in`
 * for a changed value or a new key with `none`, `Remove … from`.
 */
export function headingRuleAction(
  fields: unknown,
  text: string,
  presetName: string,
): PresetChangePlan {
  const rules = (fields as PresetFields | null)?.headingRules ?? {};
  const key = headingRuleKey(text);
  const builtin = headingRuleTable({}).get(key) === 'glossary';
  const present = Object.keys(rules).find((k) => headingRuleKey(k) === key);
  const inUse = headingRuleTable(rules).get(key) === 'glossary';
  const where = `the heading rules of preset "${presetName}"`;
  const set = (rule: HeadingRule): string =>
    `Set "${text}" → ${rule} in ${where}?`;
  const remove = `Remove "${text}" from ${where}?`;
  if (!inUse) {
    const title = 'Use as glossary section';
    if (present !== undefined && builtin) {
      return {
        title,
        change: {kind: 'heading-rule', text, rule: null},
        question: remove,
      };
    }
    return {
      title,
      change: {kind: 'heading-rule', text, rule: 'glossary'},
      question:
        present === undefined
          ? `Add "${text}" → glossary to ${where}?`
          : set('glossary'),
    };
  }
  const title = 'Stop using as glossary section';
  if (builtin) {
    return {
      title,
      change: {kind: 'heading-rule', text, rule: 'none'},
      question: set('none'),
    };
  }
  return {
    title,
    change: {kind: 'heading-rule', text, rule: null},
    question: remove,
  };
}

/**
 * US-022 | AC-3, AC-4, AC-5: The item for the image at the vault path `path`.
 * In use when the preset holds `cover.mode: file` with that file. With
 * `several` images on the line the title names the file (`Use "front.png" as
 * cover`). Using it sets `mode: file` and the file; stopping goes back to
 * `auto`, the built-in behaviour (the first image of the note).
 */
export function coverAction(
  fields: unknown,
  path: string,
  presetName: string,
  several: boolean,
): PresetChangePlan {
  const cover = (fields as PresetFields | null)?.cover;
  const inUse = cover?.mode === 'file' && cover.file === path;
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (inUse) {
    return {
      title: several ? `Stop using "${name}" as cover` : 'Stop using as cover',
      change: {kind: 'cover', file: null},
      question: `Set the cover of preset "${presetName}" back to auto (the first image of the note)?`,
    };
  }
  return {
    title: several ? `Use "${name}" as cover` : 'Use as cover',
    change: {kind: 'cover', file: path},
    question: `Make "${path}" the cover of preset "${presetName}"?`,
  };
}
