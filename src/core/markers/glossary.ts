// US-017: glossary sections. Finds the top-level headings that a heading rule
// maps to `glossary`, the terms one level below them and the deeper headings
// inside a term. Pure: no Obsidian, Node, or I/O imports; nothing is emitted
// here (the Typst is written by core/emit/glossary.ts). The only place in
// `src` that decides which heading is a term (SCAR-017).
import {isNoteEmbed} from '../parse';
import type {
  BlockNode,
  HeadingIndex,
  HeadingNode,
  InlineNode,
  ParagraphNode,
} from '../parse';
import {
  BUILTIN_HEADING_RULES,
  headingRuleKey,
  type HeadingRule,
  type HeadingRulesSettings,
} from './heading-rules';

/** US-017 AC-4, AC-5, AC-14: what the rule makes of one heading. */
export type GlossaryRole =
  | {
      kind: 'term';
      /** AC-4: the paragraph printed after the term; null for AC-5. */
      runIn: ParagraphNode | null;
    }
  | {
      kind: 'in-term';
      /** AC-14: the visible text of the term the heading is in. */
      term: string;
    };

/** A warning of the plan, with its 1-based source line. */
export interface GlossaryWarning {
  code: 'HEADING_RULE_NO_TERMS' | 'HEADING_IN_TERM';
  message: string;
  line: number;
}

/** US-017: the roles of the headings of one note, and its warnings. */
export interface GlossaryPlan {
  roles: ReadonlyMap<HeadingNode, GlossaryRole>;
  /** The paragraphs that a run-in term prints; the block loop skips them. */
  consumed: ReadonlySet<BlockNode>;
  /**
   * US-018 AC-2: the top-level blocks of the terms' explanations: every block
   * after a term heading until the section ends (the run-in paragraph and the
   * blocks under a deeper heading in the term included; headings excluded).
   */
  explanations: ReadonlySet<BlockNode>;
  /**
   * US-022 AC-1: every top-level heading inside a glossary section (after its
   * heading until the section ends, terms included), where heading rules are
   * not looked at.
   */
  inSection: ReadonlySet<HeadingNode>;
  /** True when the note has at least one term (AC-6). */
  hasTerms: boolean;
  warnings: readonly GlossaryWarning[];
}

/** A plan that changes nothing (no rule, or no heading matched). */
export const EMPTY_GLOSSARY_PLAN: GlossaryPlan = Object.freeze({
  roles: new Map<HeadingNode, GlossaryRole>(),
  consumed: new Set<BlockNode>(),
  explanations: new Set<BlockNode>(),
  inSection: new Set<HeadingNode>(),
  hasTerms: false,
  warnings: [],
});

/**
 * US-017 | AC-1: The mapping in use, by comparison form: the built-in
 * mapping, then the preset's entries, a preset key replacing a built-in key
 * of the same form ({@link headingRuleKey}). Keys mapped to `none` stay in the
 * table, so they switch the built-in rule off. The order of the preset keys
 * does not matter: the parser refuses two keys of the same form (TICKET-046).
 */
export function headingRuleTable(
  preset: HeadingRulesSettings = {},
): ReadonlyMap<string, HeadingRule> {
  const table = new Map<string, HeadingRule>();
  for (const source of [BUILTIN_HEADING_RULES, preset]) {
    for (const [text, rule] of Object.entries(source)) {
      table.set(headingRuleKey(text), rule);
    }
  }
  return table;
}

/**
 * US-017 | AC-5: True when the first visible node of `nodes` is an image or a
 * file embed (also inside a mark or link), which the emitter places as a
 * block of its own (US-003 AC-1c), so the term cannot run into it. Blank text
 * and line breaks before it are skipped.
 */
function startsWithImage(nodes: readonly InlineNode[]): boolean {
  for (const node of nodes) {
    if (node.kind === 'softbreak' || node.kind === 'break') continue;
    if (node.kind === 'text' && node.value.trim() === '') continue;
    if (node.kind === 'image') return true;
    if (node.kind === 'embed') return !isNoteEmbed(node.file);
    if ('children' in node && Array.isArray(node.children)) {
      return startsWithImage(node.children as InlineNode[]);
    }
    return false;
  }
  return false;
}

/** An open glossary section while the top level is walked. */
interface Section {
  level: number;
  line: number;
  text: string;
  terms: number;
  /** The visible text of the last term; null before the first term. */
  term: string | null;
}

/**
 * US-017 | AC-2, AC-3, AC-5, AC-9, AC-14: Plans the glossary of a note.
 *
 * Walks `root` only, so a heading inside a callout, quote or list item never
 * matches and is never a term (AC-2, AC-8). A heading of level `n` (1 to 6)
 * whose visible text from `headings` has the comparison form of a key mapped
 * to `glossary` opens a section that runs to the next top-level heading of
 * level `n` or less (AC-3). Inside it a heading of level `n + 1` is a term:
 * run-in when the very next block is a paragraph that does not start with an
 * image (AC-4), else alone (AC-5);
 * a heading of level `n + 2` or deeper after the first term is `in-term` with
 * `HEADING_IN_TERM` (AC-14). A section without a term gives
 * `HEADING_RULE_NO_TERMS` at its heading's line (AC-9; a level-6 heading has
 * no sub-level and always gives it). US-018 AC-2: every non-heading block
 * after a term until the section ends is in `explanations`. US-022 AC-1:
 * every heading inside a section is in `inSection`. Empty headings (no entry in `headings`,
 * US-002 AC-7) take no part. Assumes `headings` was built from `root`. Never
 * changes its input; the same input gives the same plan.
 */
export function findGlossary(
  root: readonly BlockNode[],
  headings: HeadingIndex,
  table: ReadonlyMap<string, HeadingRule>,
): GlossaryPlan {
  const roles = new Map<HeadingNode, GlossaryRole>();
  const consumed = new Set<BlockNode>();
  const explanations = new Set<BlockNode>();
  const inSection = new Set<HeadingNode>();
  const warnings: GlossaryWarning[] = [];
  let section: Section | null = null;
  let hasTerms = false;

  const close = (): void => {
    if (section !== null && section.terms === 0) {
      warnings.push({
        code: 'HEADING_RULE_NO_TERMS',
        message: `Heading "${section.text}" has the rule glossary but no headings one level below it; nothing was changed`,
        line: section.line,
      });
    }
    section = null;
  };

  root.forEach((block, position) => {
    if (block.kind !== 'heading') {
      // US-018 AC-2: inside a term until the section closes.
      const open = section as Section | null;
      if (open !== null && open.term !== null) explanations.add(block);
      return;
    }
    const info = headings.byNode.get(block);
    if (info === undefined) return;
    const open = section as Section | null;
    if (open !== null && block.depth <= open.level) close();
    const current = section as Section | null;
    // US-022 AC-1: a heading inside an open section never opens a rule.
    if (current !== null) inSection.add(block);
    if (current !== null) {
      if (block.depth === current.level + 1) {
        const next = root[position + 1];
        const runIn =
          next?.kind === 'paragraph' && !startsWithImage(next.children)
            ? next
            : null;
        if (runIn !== null) consumed.add(runIn);
        roles.set(block, {kind: 'term', runIn});
        current.terms += 1;
        current.term = info.text;
        hasTerms = true;
      } else if (current.term !== null) {
        roles.set(block, {kind: 'in-term', term: current.term});
        warnings.push({
          code: 'HEADING_IN_TERM',
          message: `Heading "${info.text}" is inside the glossary term "${current.term}"; it is printed without number and outline entry`,
          line: block.line,
        });
      }
      return;
    }
    if (table.get(headingRuleKey(info.text)) === 'glossary') {
      section = {
        level: block.depth,
        line: block.line,
        text: info.text,
        terms: 0,
        term: null,
      };
    }
  });
  close();
  return {roles, consumed, explanations, inSection, hasTerms, warnings};
}
