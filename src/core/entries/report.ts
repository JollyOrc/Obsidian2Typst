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

/** What `<o2t-section>` records (US-033 AC-1, AC-4). */
export interface SectionFact {
  section: string;
  /** The opener page. */
  page: number;
  /** The page the intro ends on. */
  introEnd: number;
  /** The chapter's first section (it shares the chapter's opener page). */
  first?: boolean;
}

/**
 * US-033 | AC-3, AC-4, AC-13, US-031 AC-10: the page warnings of the
 * entries chapters, from the compile's facts, each once:
 * - `SECTION_INTRO_OVERFLOW "<section>"` for an intro that runs on;
 * - `ENTRY_BLANK_PAGE "<section>"` when a page between the previous
 *   section's last page and this opener holds nothing (the opener could not
 *   reuse a free right page);
 * - `ENTRY_UNPAIRED "<heading>"` for a page entry on a left page that does
 *   not overflow, is followed by another entry or opener, and whose right
 *   page holds neither an entry nor an opener.
 * The gap page after a long intro is not reported as blank (AC-4).
 */
export function sectionWarnings(
  sections: readonly SectionFact[],
  places: readonly EntryPlaceFact[],
  ends: readonly EntryEndFact[],
): Warning[] {
  const out: Warning[] = [];
  const seen = new Set<string>();
  const add = (code: string, message: string, line: number): void => {
    const key = `${code} ${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({code, message, line});
  };
  const placed = places.filter((p) => p.size !== 'inline');
  const endOf = (heading: string, page: number): number =>
    ends.find((e) => e.heading === heading && e.page >= page)?.page ?? page;
  const unique = sections.filter(
    (s, i) =>
      sections.findIndex(
        (t) => t.section === s.section && t.page === s.page,
      ) === i,
  );
  unique.forEach((s, i) => {
    if (s.introEnd > s.page) add('SECTION_INTRO_OVERFLOW', `"${s.section}"`, 0);
    const before = unique[i - 1];
    // The first section of a chapter shares the chapter's opener page.
    if (before === undefined || s.first === true) return;
    const used = placed
      .filter((p) => p.page > before.page && p.page < s.page)
      .map((p) => endOf(p.heading, p.page));
    const last = Math.max(before.introEnd, ...used);
    if (s.page - last > 1) add('ENTRY_BLANK_PAGE', `"${s.section}"`, 0);
  });
  const openers = new Set(unique.map((s) => s.page));
  const starts = new Set(placed.map((p) => p.page));
  const lastPage = Math.max(0, ...placed.map((p) => p.page), ...openers);
  for (const p of placed) {
    if (p.size !== 'page' || p.page % 2 !== 0) continue;
    if (endOf(p.heading, p.page) > p.page) continue;
    // Something placed after it: the last entry's right page is what the
    // chapter's next part (US-033's quick reference, the next chapter) uses.
    if (p.page >= lastPage) continue;
    if (!starts.has(p.page + 1) && !openers.has(p.page + 1))
      add('ENTRY_UNPAIRED', `"${p.heading}"`, p.line ?? 0);
  }
  return out;
}

/** What `<o2t-sheet>` records (US-036 AC-3, AC-8). */
export interface SheetFact {
  form: 'A4' | 'book';
  rows: number;
  columns: number;
  /** The tick boxes' size in mm. */
  boxMm: number;
}

/**
 * US-036 | AC-3 (decision 2): `ENCOUNTER_SHEET_SMALL_BOXES "<form>": <size>
 * mm (min 2.0)` once per form whose boxes are under 2.0 mm (the size
 * rounded to 0.1 mm), in the order the forms come.
 */
export function sheetWarnings(sheets: readonly SheetFact[]): Warning[] {
  const out: Warning[] = [];
  const seen = new Set<string>();
  for (const s of sheets) {
    if (seen.has(s.form) || !(s.boxMm < 2.0)) continue;
    seen.add(s.form);
    out.push({
      code: 'ENCOUNTER_SHEET_SMALL_BOXES',
      message: `"${s.form}": ${s.boxMm.toFixed(1)} mm (min 2.0)`,
      line: 0,
    });
  }
  return out;
}
