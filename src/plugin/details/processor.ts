// US-038 AC-14, AC-15: the detail row in Obsidian — the code-block processor
// of the details block and the drawing API. The row is drawn from the shared
// model (`src/core/details/model.ts`, the one the PDF emitter uses, SCAR-017)
// with the active preset's settings, read each time a block is drawn
// (SCAR-016, SCAR-022). Nothing here imports Obsidian: the element is
// Obsidian's `HTMLElement` helpers (`createEl`, `setCssProps`), the readers
// are injected by `main.ts`.
import {parseDocument, isMap} from 'yaml';
import {detailsModel, type DetailsModel} from '../../core/details/model';
import {
  detailsLookValues,
  type DetailsLookValues,
} from '../../core/emit/details';
import {recolourSvg} from '../../core/entries/model';
import type {ColorMode, DetailsSettings} from '../../core/markers';
import {
  iconCache,
  inline,
  raw,
  type DrawEl,
  type EntriesApi,
} from '../entries/processor';

/** What the preview reads, each time it draws (AC-14). */
export interface DetailsDeps {
  /** The active preset's effective settings; null without a valid preset. */
  settings(): Promise<{details?: unknown; colorMode?: string} | null>;
  /** An icon file's text from the vault; null when missing. */
  readIcon(path: string): Promise<string | null>;
  /** The nearest heading above the block, or null. */
  heading(ctx: unknown): string | null;
  /** The note's file name without `.md`. */
  fileName(ctx: unknown): string;
  /** True when the block sits in a quote or callout. */
  inContainer(ctx: unknown): boolean;
}

/** AC-14: the notice shown instead of a row when the preset has no group. */
export const NO_DETAILS =
  'No details row: the active preset has no details settings.';

/** AC-14: preset pt per em of the editor's text (1 pt = 1/10.5 em, as the statblock). */
const PT_PER_EM = 10.5;
const em = (pt: number): string => `${Number((pt / PT_PER_EM).toFixed(4))}em`;

/** The settings as the model and the look read them; null without an item. */
function detailsOf(
  settings: {details?: unknown; colorMode?: string} | null,
): {details: DetailsSettings; colorMode: ColorMode | undefined} | null {
  const details = settings?.details as DetailsSettings | undefined;
  if ((details?.items ?? []).length === 0) return null;
  return {
    details: details as DetailsSettings,
    colorMode: settings?.colorMode as ColorMode | undefined,
  };
}

/**
 * US-038 | AC-14, AC-15: draws the row of `model` into `el` (nothing when it
 * has no badge) and the checks as one notice line under it; returns the badge
 * elements in drawn order. No listeners. A missing icon leaves its badge
 * without one.
 */
async function draw(
  el: DrawEl,
  model: DetailsModel,
  look: DetailsLookValues,
  icon: (path: string) => Promise<string | null>,
  heading: string | null,
): Promise<DrawEl[]> {
  const badges: DrawEl[] = [];
  if (model.badges.length > 0) {
    const root = el.createDiv({cls: 'o2t-dt'});
    root.setCssProps({
      '--o2t-dt-color': look.color,
      '--o2t-dt-size': em(look.size),
    });
    const svgs = await Promise.all(
      model.badges.map((b) => (b.icon === null ? null : icon(b.icon))),
    );
    model.badges.forEach((badge, i) => {
      const item = root.createEl('span', {cls: 'o2t-dt-item'});
      const svg = svgs[i];
      if (svg !== null && svg !== undefined) {
        item.createEl('img', {
          cls: 'o2t-dt-icon',
          attr: {
            alt: '',
            src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(recolourSvg(svg, look.color))}`,
          },
        });
      }
      if (badge.label !== null)
        item.createEl('span', {cls: 'o2t-dt-text', text: badge.label});
      else if (badge.value !== null)
        inline(item.createEl('span', {cls: 'o2t-dt-text'}), badge.value, true);
      badges.push(item);
    });
  }
  if (model.checks.length > 0) {
    const where = heading === null ? '' : ` "${heading}"`;
    el.createDiv({cls: 'o2t-sb-notice'}).createEl('span', {
      text: model.checks
        .map((c) => `${c.code}${where}: ${c.detail}`)
        .join(' · '),
    });
  }
  return badges;
}

/**
 * US-038 | AC-14: the code-block processor of the details block. Every datum
 * is read when the handler runs; icons are cached per path until
 * `clearIconCache` (a preset change). A block in a quote or callout, with
 * invalid YAML, or under a preset without the group shows the raw block
 * with one notice; a block with nothing to show draws nothing.
 */
export function createDetailsProcessor(deps: DetailsDeps): {
  handler: (source: string, el: unknown, ctx: unknown) => Promise<void>;
  clearIconCache(): void;
} {
  const icons = iconCache((path) => deps.readIcon(path));
  return {
    async handler(source, target, ctx) {
      const el = target as DrawEl;
      if (deps.inContainer(ctx)) {
        raw(el, source, 'DETAIL_BLOCK_IN_CONTAINER');
        return;
      }
      const doc = parseDocument(source, {version: '1.2'});
      if (
        doc.errors.length > 0 ||
        (doc.contents !== null && !isMap(doc.contents))
      ) {
        const line = doc.errors[0]?.linePos?.[0]?.line ?? 1;
        raw(el, source, `DETAIL_YAML_INVALID (line ${line})`);
        return;
      }
      const setup = detailsOf(await deps.settings());
      if (setup === null) {
        raw(el, source, NO_DETAILS);
        return;
      }
      const data = (doc.toJS() ?? {}) as Record<string, unknown>;
      const model = detailsModel(data, setup.details);
      if (model === null) {
        raw(el, source, NO_DETAILS);
        return;
      }
      await draw(
        el,
        model,
        detailsLookValues(setup.details, setup.colorMode),
        (p) => icons.get(p),
        deps.heading(ctx),
      );
    },
    clearIconCache() {
      icons.clear();
    },
  };
}

/** US-038 AC-15: the row part of the drawing API. */
export interface DetailsApi {
  renderDetails(
    el: unknown,
    data: Record<string, unknown>,
    options?: {heading?: string},
  ): Promise<{badges: unknown[]}>;
  /** Forgets the icons read (a preset change). */
  clearIconCache(): void;
}

/**
 * US-038 | AC-15: `renderDetails(el, data, options?)` draws as the processor
 * does, for a plain object of note properties (keys in any case) and the
 * active preset; `options.heading` names the heading in the notices. Returns
 * the badge elements in drawn order; adds no click handler. Without a group
 * it draws the notice and returns none.
 */
export function createDetailsApi(deps: DetailsDeps): DetailsApi {
  const icons = iconCache((path) => deps.readIcon(path));
  return {
    async renderDetails(target, data, options) {
      const el = target as DrawEl;
      const setup = detailsOf(await deps.settings());
      const model = setup === null ? null : detailsModel(data, setup.details);
      if (setup === null || model === null) {
        el.createDiv({cls: 'o2t-sb-notice'}).createEl('span', {
          text: NO_DETAILS,
        });
        return {badges: []};
      }
      const badges = await draw(
        el,
        model,
        detailsLookValues(setup.details, setup.colorMode),
        (p) => icons.get(p),
        options?.heading ?? null,
      );
      return {badges};
    },
    clearIconCache() {
      icons.clear();
    },
  };
}

/** US-038 AC-15: the one API object of the plugin (`version` stays 1). */
export interface PluginApi extends EntriesApi {
  renderDetails: DetailsApi['renderDetails'];
}

/**
 * US-038 | AC-15: joins the statblock API and the details API into the one
 * object `app.plugins.plugins["obsidian2typst"].api`: the version and
 * `renderStatblock` of the first, `renderDetails` of the second, and a
 * `clearIconCache` that clears both.
 */
export function composeApi(
  entries: EntriesApi,
  details: DetailsApi,
): PluginApi {
  return {
    version: entries.version,
    renderStatblock: entries.renderStatblock,
    renderDetails: details.renderDetails,
    clearIconCache() {
      entries.clearIconCache();
      details.clearIconCache();
    },
  };
}
