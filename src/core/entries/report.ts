// US-032 AC-2, AC-5, AC-7, AC-9 to AC-11: the layout warnings of the entries,
// made from the facts the compile records (`<o2t-entry>`, `<o2t-entry-end>`,
// read with `world.query` after the compile). Pure: no Obsidian, Node, or
// I/O imports. Measuring candidates records nothing, so each warning comes
// from the placed entry only, once (SCAR-038).
import type {Warning} from '../emit/context';

/** What `<o2t-entry>` records (US-031 AC-14, US-032 AC-2, AC-4). */
export interface EntryPlaceFact {
  heading: string;
  layout: string;
  size: 'page' | 'spread' | 'inline';
  page: number;
  /** The block's line in the note (0 when unknown). */
  line?: number;
  asked?: string;
  reason?: string;
  auto?: boolean;
  scale?: number;
}

/** What `<o2t-entry-end>` records (US-032 AC-5, AC-7, AC-9). */
export interface EntryEndFact {
  heading: string;
  page: number;
  overflowLines?: number;
  rightEmpty?: number;
  partnerMoved?: string;
}

/** US-032 AC-9: the layouts whose right page can stay empty. */
const SPREADS_WITH_TEXT = new Set([
  'spread-text',
  'spread-landscape',
  'spread-portrait',
]);

/**
 * US-032 | AC-2, AC-5, AC-7, AC-9 to AC-11, US-031 AC-4: the warnings of the
 * placed entries, in their order, each at most once (facts repeated for an
 * entry laid out twice give one warning):
 * - `ENTRY_LAYOUT_CONFLICT "<h>": <asked> → <used> (<reason>)` for a replaced
 *   layout, else `ENTRY_AUTO "<h>": <layout>` for a chosen one;
 * - `ENTRY_OVERFLOW "<h>": <layout>, about <N> lines over` (with
 *   `(partner "<p>" moved)`);
 * - `ENTRY_SPREAD_EMPTY "<h>": <layout>, right page <P> % empty – consider an
 *   illustration or trimming` when `emptyWarn` is above 0 and the right page
 *   of a spread with text is at least that empty.
 * Inline entries (outside the chapters, nested) have no layout and no facts
 * of their own here. Ends pair with places by heading, in order.
 */
export function entryLayoutWarnings(
  places: readonly EntryPlaceFact[],
  ends: readonly EntryEndFact[],
  options: {emptyWarn: number},
): Warning[] {
  const out: Warning[] = [];
  const seen = new Set<string>();
  const add = (code: string, message: string, line: number): void => {
    const key = `${code} ${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({code, message, line});
  };
  const used = new Set<number>();
  for (const place of places) {
    if (place.size === 'inline') continue;
    const name = `"${place.heading}"`;
    const line = place.line ?? 0;
    if (place.asked !== undefined) {
      add(
        'ENTRY_LAYOUT_CONFLICT',
        `${name}: ${place.asked} → ${place.layout} (${place.reason ?? ''})`,
        line,
      );
    } else if (place.auto === true) {
      add('ENTRY_AUTO', `${name}: ${place.layout}`, line);
    }
    const at = ends.findIndex(
      (end, i) => !used.has(i) && end.heading === place.heading,
    );
    if (at < 0) continue;
    used.add(at);
    const end = ends[at] as EntryEndFact;
    const over = end.overflowLines ?? 0;
    if (over > 0) {
      const moved =
        end.partnerMoved === undefined
          ? ''
          : ` (partner "${end.partnerMoved}" moved)`;
      add(
        'ENTRY_OVERFLOW',
        `${name}: ${place.layout}, about ${over} lines over${moved}`,
        line,
      );
    }
    const empty = end.rightEmpty;
    if (
      options.emptyWarn > 0 &&
      empty !== undefined &&
      SPREADS_WITH_TEXT.has(place.layout) &&
      empty >= options.emptyWarn
    ) {
      add(
        'ENTRY_SPREAD_EMPTY',
        `${name}: ${place.layout}, right page ${empty} % empty – consider an illustration or trimming`,
        line,
      );
    }
  }
  return out;
}
