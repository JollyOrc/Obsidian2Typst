// US-015 AC-2: the rules of the preamble, in a registry with fixed order
// numbers. Pure: no Obsidian, Node, or I/O imports.
//
// Later stories register their rules here with the order numbers reserved in
// the story (text-and-fonts 40, cover 90), so no other rule moves.
import {
  FIT_IMAGE_HELPER,
  FOOTNOTE_RESTART_RULE,
  headingNumberingRule,
} from '../emit';
import {emitPageSetup} from '../layout/page-setup';
import type {ConvertSettings} from './types';

export const DEFAULT_HIGHLIGHT_COLOR = '#ffeb3b';
export const DEFAULT_HEADING_NUMBERING = '1.1';

// Built in two parts: the import-purity test of AC-9 reads every module name
// out of the source text and must not take this Typst line for one.
const TEMPLATE_IMPORT = ['#import', '"template.typ": *'].join(' ');

/** US-023 AC-1: applies the template's `template(doc)` to the document. */
const TEMPLATE_HOOK = '#show: template';

/** What a rule may look at. */
export interface PreambleContext {
  noteName: string;
  settings: ConvertSettings;
  /** True when a found image is placed with the `fit-image` helper. */
  usesFitImage: boolean;
  /** The cover pages (US-011), or null when there is no cover. */
  cover?: string | null;
  /** US-010 AC-2: the four font lines, or null without font settings. */
  fonts?: string | null;
  /** US-016 AC-11: the callout styles and helper, or null without callouts. */
  callouts?: string | null;
  /** US-017 AC-6: the term helper, or null without a term. */
  glossary?: string | null;
  /** US-019 AC-3: the page-furniture rule, or null when it is off. */
  furniture?: string | null;
  /** US-018 AC-3: the page-ref helper, or null without a call in the body. */
  pageRefs?: string | null;
}

/** One rule of the preamble; `render` returns null when it writes nothing. */
export interface PreambleRule {
  id: string;
  /** Position in the preamble; unique. */
  order: number;
  render(context: PreambleContext): string | null;
}

export const PREAMBLE_RULES: readonly PreambleRule[] = [
  {
    // US-023 AC-1, AC-3: the hook right after the import, before every rule
    // the plugin generates, so those win on a conflict (measured 2026-10-22).
    id: 'template-import',
    order: 20,
    render: ({settings}) => {
      if (settings.template !== true) return null;
      return settings.templateHook === true
        ? `${TEMPLATE_IMPORT}\n${TEMPLATE_HOOK}`
        : TEMPLATE_IMPORT;
    },
  },
  {
    id: 'page',
    order: 30,
    render: ({settings}) => emitPageSetup(settings.page),
  },
  {
    // US-010 AC-2: after the page rules, before the highlight rule.
    id: 'text-and-fonts',
    order: 40,
    render: ({fonts}) => fonts ?? null,
  },
  {
    // US-019 AC-3: after the fonts (the header uses the body font), before
    // the highlight rule; only when folios or the header are on.
    id: 'page-furniture',
    order: 45,
    render: ({furniture}) => furniture ?? null,
  },
  {
    // US-018 AC-3: after the furniture (the folios it prints), before the
    // highlight rule; only when the body holds a page-ref call.
    id: 'page-refs',
    order: 47,
    render: ({pageRefs}) => pageRefs ?? null,
  },
  {
    id: 'highlight',
    order: 50,
    render: ({settings}) =>
      `#set highlight(fill: rgb("${settings.highlightColor ?? DEFAULT_HIGHLIGHT_COLOR}"))`,
  },
  {
    id: 'heading-numbering',
    order: 60,
    render: ({settings}) =>
      headingNumberingRule(
        settings.headingNumbering ?? DEFAULT_HEADING_NUMBERING,
      ),
  },
  {
    id: 'footnote-restart',
    order: 70,
    render: () => FOOTNOTE_RESTART_RULE,
  },
  {
    id: 'fit-image',
    order: 80,
    render: ({usesFitImage}) => (usesFitImage ? FIT_IMAGE_HELPER : null),
  },
  {
    // US-016 AC-11: after the image helper, before the cover; only when the
    // body holds a callout.
    id: 'callouts',
    order: 85,
    render: ({callouts}) => callouts ?? null,
  },
  {
    // US-017 AC-6: after the callouts, before the cover; only when the body
    // holds a glossary term.
    id: 'glossary',
    order: 86,
    render: ({glossary}) => glossary ?? null,
  },
  {
    // US-011 AC-4: after everything that sets up the document, with a blank
    // line before it so that the pages read as their own block.
    id: 'cover',
    order: 90,
    render: ({cover}) =>
      cover === undefined || cover === null ? null : `\n${cover}`,
  },
];

/** The problems of a registry: an id or an order number used twice. */
export function checkPreambleRules(rules: readonly PreambleRule[]): string[] {
  const problems: string[] = [];
  const ids = new Map<string, number>();
  const orders = new Map<number, string[]>();
  for (const rule of rules) {
    ids.set(rule.id, (ids.get(rule.id) ?? 0) + 1);
    orders.set(rule.order, [...(orders.get(rule.order) ?? []), rule.id]);
  }
  for (const [id, count] of ids) {
    if (count > 1) problems.push(`The id "${id}" is registered ${count} times`);
  }
  for (const [order, names] of orders) {
    if (names.length > 1) {
      problems.push(`The order number ${order} is used by ${names.join(', ')}`);
    }
  }
  return problems;
}

/** The lines of the rules, sorted by order number; null results are skipped. */
export function renderPreamble(
  rules: readonly PreambleRule[],
  context: PreambleContext,
): string[] {
  const problems = checkPreambleRules(rules);
  if (problems.length > 0) {
    throw new Error(`Invalid preamble rules: ${problems.join('; ')}`);
  }
  return [...rules]
    .sort((a, b) => a.order - b.order)
    .map((rule) => rule.render(context))
    .filter((text): text is string => text !== null);
}
