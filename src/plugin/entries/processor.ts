// US-035: the `o2t-entry` preview in Obsidian and the drawing API. The block
// is drawn from the shared statblock model (`src/core/entries/model.ts`, the
// one the PDF emitter uses, SCAR-017) with the active preset's settings,
// read each time a block is drawn (SCAR-016, SCAR-022). Nothing here imports
// Obsidian: the element is Obsidian's `HTMLElement` helpers (`createEl`,
// `setCssProps`), the readers are injected by `main.ts`.
import {parseDocument, isMap} from 'yaml';
import {
  recolourSvg,
  statblockModel,
  type StatblockModel,
} from '../../core/entries/model';
import {
  statblockLookValues,
  type StatblockLookValues,
} from '../../core/emit/entry';
import {
  flattenLinks,
  keepLinks,
  linkShown,
  type ColorMode,
} from '../../core/markers';
import type {EntriesSettings} from '../../core/markers/entries';
import {parseInline, visibleText, type InlineNode} from '../../core/parse';

/** The parts of Obsidian's element helpers the drawing uses. */
export interface DrawEl {
  createEl(
    tag: string,
    options?: {text?: string; cls?: string; attr?: Record<string, string>},
  ): DrawEl;
  createDiv(options?: {cls?: string}): DrawEl;
  setCssProps(props: Record<string, string>): void;
}

/** What the preview reads, each time it draws (US-035 AC-7). */
export interface PreviewDeps {
  /** The active preset's effective settings; null without a valid preset. */
  settings(): Promise<{entries?: unknown; colorMode?: string} | null>;
  /** An icon file's text from the vault; null when missing. */
  readIcon(path: string): Promise<string | null>;
  /** The nearest heading above the block, or null. */
  heading(ctx: unknown): string | null;
  /** The note's file name without `.md`. */
  fileName(ctx: unknown): string;
  /** True when the block sits in a quote or callout. */
  inContainer(ctx: unknown): boolean;
}

/** US-035 AC-4: the notices shown instead of a statblock. */
export const NO_SETTINGS =
  'No statblock: the active preset has no entries settings.';
export const NO_STATS = 'No statblock: no stats or attacks.';

/** US-035 AC-3: preset pt per em of the editor's text (1 pt = 1/10.5 em). */
const PT_PER_EM = 10.5;
const em = (pt: number): string => `${Number((pt / PT_PER_EM).toFixed(4))}em`;

/**
 * The raw block and its notice above it (US-035 AC-4, AC-5, AC-9; US-038
 * AC-14 draws the same notices for its block).
 */
export function raw(el: DrawEl, source: string, notice: string): void {
  el.createDiv({cls: 'o2t-sb-notice'}).createEl('span', {text: notice});
  el.createEl('pre', {cls: 'o2t-sb-raw'}).createEl('code', {text: source});
}

/**
 * US-035 AC-2: a value as the PDF reads it: links as their text, bold,
 * italic. US-038 AC-9, AC-14: with `links` a link stays one (a wikilink an
 * Obsidian internal link, `a.internal-link` with `data-href`; a Markdown
 * link an external one) and images and embeds are their text (`keepLinks`).
 */
export function inline(el: DrawEl, value: string, links = false): void {
  const walk = (parent: DrawEl, nodes: readonly InlineNode[]): void => {
    for (const node of nodes) {
      switch (node.kind) {
        case 'text':
          parent.createEl('span', {text: node.value});
          break;
        case 'strong':
          walk(parent.createEl('strong'), node.children);
          break;
        case 'emph':
          walk(parent.createEl('em'), node.children);
          break;
        case 'delete':
          walk(parent.createEl('del'), node.children);
          break;
        case 'mark':
          walk(parent.createEl('mark'), node.children);
          break;
        case 'code-inline':
          parent.createEl('code', {text: node.value});
          break;
        case 'link':
          if (links)
            walk(
              parent.createEl('a', {
                cls: 'external-link',
                attr: {href: node.href},
              }),
              node.children,
            );
          else walk(parent, node.children);
          break;
        case 'wikilink': {
          // only with `links`: `flattenLinks` leaves none
          const target =
            node.file + (node.anchor === null ? '' : `#${node.anchor}`);
          parent.createEl('a', {
            cls: 'internal-link',
            text: linkShown(node),
            attr: {'data-href': target, href: target},
          });
          break;
        }
        case 'softbreak':
        case 'break':
          parent.createEl('span', {text: ' '});
          break;
        default:
          break;
      }
    }
  };
  walk(
    el,
    links
      ? keepLinks(parseInline(value, 0))
      : flattenLinks(parseInline(value, 0)),
  );
}

/** True when `value` has no markup: it is drawn as one text. */
const plain = (value: string): boolean =>
  flattenLinks(parseInline(value, 0)).every((n) => n.kind === 'text');

/**
 * The labelled values of a line, `Might 4 · Wits —` (AC-2: unset as —):
 * one text when no value has markup (the model's `text`), else value by
 * value with bold and italic.
 */
function valueLine(
  el: DrawEl,
  cls: string,
  text: string,
  values: StatblockModel['stats'],
): void {
  const line = el.createDiv({cls});
  if (values.every((v) => v.value === null || plain(v.value))) {
    line.createEl('span', {text});
    return;
  }
  values.forEach((v, i) => {
    if (i > 0) line.createEl('span', {text: ' · '});
    line.createEl('span', {text: `${v.label} `});
    if (v.value === null) line.createEl('span', {text: '—'});
    else inline(line.createEl('span'), v.value);
  });
}

/** The CSS custom properties of the look (AC-3). */
function lookProps(look: StatblockLookValues): Record<string, string> {
  const props: Record<string, string> = {
    '--o2t-sb-fill': look.fill === 'none' ? 'transparent' : look.fill,
    '--o2t-sb-frame': look.frame.color,
    '--o2t-sb-frame-width': `${look.frame.width}pt`,
    '--o2t-sb-rule': look.rules.color,
    '--o2t-sb-rule-width': `${look.rules.width}pt`,
    '--o2t-sb-box-fill': look.boxFill === 'none' ? 'transparent' : look.boxFill,
    '--o2t-sb-accent': look.accent,
  };
  for (const [role, size] of Object.entries(look.sizes))
    props[`--o2t-sb-size-${role}`] = em(size);
  for (const [role, family] of Object.entries(look.fonts))
    props[`--o2t-sb-font-${role}`] = JSON.stringify(family);
  return props;
}

/** Icons read once per path until the cache is cleared (AC-8; US-038 AC-14 too). */
export function iconCache<T = string>(
  read: (path: string) => Promise<T | null>,
) {
  const cache = new Map<string, Promise<T | null>>();
  return {
    get(path: string): Promise<T | null> {
      let found = cache.get(path);
      if (found === undefined) {
        found = read(path).catch(() => null);
        cache.set(path, found);
      }
      return found;
    },
    clear(): void {
      cache.clear();
    },
  };
}

/**
 * US-035 | AC-1 to AC-3, AC-6, AC-11: draws the statblock of `model` into
 * `el`; returns the boxes and cells in their drawn order. No listeners.
 */
async function draw(
  el: DrawEl,
  model: StatblockModel,
  look: StatblockLookValues,
  icon: (path: string) => Promise<string | null>,
): Promise<{boxes: DrawEl[]; cells: DrawEl[]}> {
  const root = el.createDiv({cls: 'o2t-sb'});
  root.setCssProps(lookProps(look));
  root.createDiv({cls: 'o2t-sb-band'}).createEl('span', {
    text: `◆ ${model.band} ◆`,
  });
  const boxes: DrawEl[] = [];
  if (model.parts.includes('boxes')) {
    const row = root.createDiv({cls: 'o2t-sb-boxrow'});
    const label = row.createDiv({cls: 'o2t-sb-boxlabel'});
    label.createEl('span', {text: model.boxLabel ?? ''});
    inline(
      label.createEl('span', {cls: 'o2t-sb-boxvalue'}),
      model.boxValue ?? '',
    );
    const field = row.createDiv({cls: 'o2t-sb-boxes'});
    for (let i = 0; i < model.boxes; i++) {
      boxes.push(field.createEl('span', {cls: 'o2t-sb-box'}));
    }
  }
  const cells: DrawEl[] = [];
  if (model.parts.includes('track')) {
    const track = root.createDiv({cls: 'o2t-sb-track'});
    if (model.trackLabel !== null)
      track.createDiv({cls: 'o2t-sb-tracklabel'}).createEl('span', {
        text: model.trackLabel,
      });
    const row = track.createDiv({cls: 'o2t-sb-cells'});
    const svgs = await Promise.all(model.cells.map((c) => icon(c.icon)));
    model.cells.forEach((c, i) => {
      const cell = row.createEl('span', {
        cls: 'o2t-sb-cell',
        attr: {'aria-label': c.label},
      });
      const svg = svgs[i];
      // AC-3: a missing icon leaves its cell empty.
      if (svg !== null && svg !== undefined) {
        cell.createEl('img', {
          cls: 'o2t-sb-icon',
          attr: {
            alt: '',
            src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(recolourSvg(svg, look.icon))}`,
          },
        });
      }
      cells.push(cell);
    });
  }
  if (model.parts.includes('attributes'))
    valueLine(root, 'o2t-sb-attributes', model.attributes, model.stats);
  if (model.parts.includes('traits'))
    valueLine(root, 'o2t-sb-traits', model.traits, model.traitValues);
  if (model.parts.includes('attacks')) {
    const list = root.createDiv({cls: 'o2t-sb-attacks'});
    for (const a of model.attacks) {
      // AC-2: an attack without dice is highlighted.
      const line = list.createDiv({
        cls: a.noDice ? 'o2t-sb-attack o2t-sb-nodice' : 'o2t-sb-attack',
      });
      inline(line.createEl('span', {cls: 'o2t-sb-attackname'}), a.name);
      if (a.dice !== '')
        inline(line.createEl('span', {cls: 'o2t-sb-dice'}), a.dice);
    }
  }
  if (model.parts.includes('skills')) {
    const line = root.createDiv({cls: 'o2t-sb-skills'});
    if (model.skillItems.every(plain)) {
      line.createEl('span', {text: model.skills});
    } else {
      line.createEl('em', {text: 'Skills: '});
      model.skillItems.forEach((s, i) => {
        if (i > 0) line.createEl('span', {text: ', '});
        inline(line.createEl('span'), s);
      });
    }
  }
  if (model.parts.includes('tags'))
    root.createDiv({cls: 'o2t-sb-tags'}).createEl('span', {text: model.tags});
  // AC-2: the data checks as a notice line under the statblock.
  if (model.notices.length > 0)
    el.createDiv({cls: 'o2t-sb-notice'}).createEl('span', {
      text: model.notices.join(' · '),
    });
  return {boxes, cells};
}

/** The settings as the model and the look read them; null without a statblock setup. */
function entriesOf(
  settings: {entries?: unknown; colorMode?: string} | null,
): {entries: EntriesSettings; colorMode: ColorMode | undefined} | null {
  const entries = settings?.entries as EntriesSettings | undefined;
  if (entries?.statblock?.stats === undefined) return null;
  if (entries.statblock.stats.length === 0) return null;
  return {entries, colorMode: settings?.colorMode as ColorMode | undefined};
}

/**
 * US-035 | AC-1, AC-4, AC-5, AC-7 to AC-9: the code-block processor of
 * `o2t-entry`. Every datum is read when the handler runs; icons are cached
 * per path until `clearIconCache` (a preset change).
 */
export function createEntryProcessor(deps: PreviewDeps): {
  handler: (source: string, el: unknown, ctx: unknown) => Promise<void>;
  clearIconCache(): void;
} {
  const icons = iconCache((path) => deps.readIcon(path));
  return {
    async handler(source, target, ctx) {
      const el = target as DrawEl;
      if (deps.inContainer(ctx)) {
        raw(el, source, 'ENTRY_BLOCK_IN_CONTAINER');
        return;
      }
      const doc = parseDocument(source, {version: '1.2'});
      if (
        doc.errors.length > 0 ||
        (doc.contents !== null && !isMap(doc.contents))
      ) {
        const line = doc.errors[0]?.linePos?.[0]?.line ?? 1;
        raw(el, source, `ENTRY_YAML_INVALID (line ${line})`);
        return;
      }
      const setup = entriesOf(await deps.settings());
      if (setup === null) {
        raw(el, source, NO_SETTINGS);
        return;
      }
      const data = (doc.toJS() ?? {}) as Record<string, unknown>;
      const model = statblockModel(data, setup.entries, {
        heading: deps.heading(ctx),
        fileName: deps.fileName(ctx),
        missing: 'dash',
      });
      if (model === null) {
        raw(el, source, NO_STATS);
        return;
      }
      await draw(
        el,
        model,
        statblockLookValues(setup.entries, setup.colorMode),
        (p) => icons.get(p),
      );
    },
    clearIconCache() {
      icons.clear();
    },
  };
}

/** US-035 AC-11: the API's version; a change that breaks callers raises it. */
export const ENTRIES_API_VERSION = 1;

/** US-035 AC-11: the drawing API the author's vault views call. */
export interface EntriesApi {
  version: number;
  renderStatblock(
    el: unknown,
    data: Record<string, unknown>,
    options?: {heading?: string},
  ): Promise<{boxes: unknown[]; cells: unknown[]}>;
  /** Forgets the icons read (a preset change). */
  clearIconCache(): void;
}

/**
 * US-035 | AC-11 (decision 1): `renderStatblock(el, data, options?)` draws
 * as the processor does, for a plain object of note properties (keys in any
 * case) and the active preset; the band is `options.heading`, else
 * `data.name`, else `—`. Returns the boxes and cells in drawn order; adds no
 * click handler. Without a statblock it draws the notice and returns none.
 */
export function createEntriesApi(deps: PreviewDeps): EntriesApi {
  const icons = iconCache((path) => deps.readIcon(path));
  return {
    version: ENTRIES_API_VERSION,
    async renderStatblock(target, data, options) {
      const el = target as DrawEl;
      const setup = entriesOf(await deps.settings());
      if (setup === null) {
        el.createDiv({cls: 'o2t-sb-notice'}).createEl('span', {
          text: NO_SETTINGS,
        });
        return {boxes: [], cells: []};
      }
      const name = Object.entries(data).find(
        ([key]) => key.toLowerCase() === 'name',
      )?.[1];
      const band =
        options?.heading ??
        (typeof name === 'string' && name.trim() !== '' ? name : '—');
      const model = statblockModel(data, setup.entries, {
        heading: band,
        fileName: band,
        missing: 'dash',
      });
      if (model === null) {
        el.createDiv({cls: 'o2t-sb-notice'}).createEl('span', {
          text: NO_STATS,
        });
        return {boxes: [], cells: []};
      }
      return draw(
        el,
        model,
        statblockLookValues(setup.entries, setup.colorMode),
        (p) => icons.get(p),
      );
    },
    clearIconCache() {
      icons.clear();
    },
  };
}

/**
 * US-035 AC-1 (as US-030 AC-1): the nearest heading above line `at` of the
 * note's `lines`, as plain text (links as their text, marks removed);
 * lines inside a fenced code block are skipped. Null without one.
 */
export function headingAbove(
  lines: readonly string[],
  at: number,
): string | null {
  let fenced = false;
  let found: string | null = null;
  for (let i = 0; i < at && i < lines.length; i++) {
    const line = lines[i] as string;
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const m = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (m !== null) found = visibleText(parseInline(m[1] as string, i + 1));
  }
  return found;
}

/** US-035 AC-9 (as US-030 AC-4): the block's first line is in a quote or callout. */
export const inQuote = (lines: readonly string[], at: number): boolean =>
  /^\s{0,3}>/.test(lines[at] ?? '');
