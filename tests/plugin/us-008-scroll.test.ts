// US-008 AC-19 — a redraw of the settings tab keeps the scroll position: the
// helper that finds the scrolling part and puts the position back (plugin
// logic over plain objects; the tab itself: manual check M2 step 14). Source of
// truth: docs/user-stories/US-008-presets-and-settings.md.
import {describe, expect, it} from 'vitest';
import {captureScroll, type ScrollNode} from '../../src/plugin/settings/scroll';
import {settingsSource} from '../support/settings-source';

function node(
  name: string,
  over: Partial<ScrollNode> = {},
  parent: ScrollNode | null = null,
): ScrollNode {
  return {
    name,
    parentElement: parent,
    scrollTop: 0,
    scrollHeight: 100,
    clientHeight: 100,
    overflowY: 'visible',
    ...over,
  } as ScrollNode;
}

describe('US-008 AC-19 captureScroll', () => {
  it('US-008 AC-19: puts the position of the nearest scrolling ancestor back', () => {
    const outer = node('outer', {
      scrollHeight: 2000,
      clientHeight: 500,
      overflowY: 'auto',
      scrollTop: 640,
    });
    const content = node('content', {}, outer);
    const restore = captureScroll(content);
    outer.scrollTop = 0; // the redraw empties the container
    restore();
    expect(outer.scrollTop).toBe(640);
  });

  it('US-008 AC-19: takes the element itself when it scrolls', () => {
    const el = node('el', {
      scrollHeight: 900,
      clientHeight: 300,
      overflowY: 'scroll',
      scrollTop: 120,
    });
    const restore = captureScroll(el);
    el.scrollTop = 0;
    restore();
    expect(el.scrollTop).toBe(120);
  });

  it('US-008 AC-19: skips ancestors that cannot scroll', () => {
    const far = node('far', {
      scrollHeight: 3000,
      clientHeight: 500,
      overflowY: 'auto',
      scrollTop: 77,
    });
    const flat = node('flat', {overflowY: 'auto'}, far); // nothing to scroll
    const hidden = node(
      'hidden',
      {scrollHeight: 900, clientHeight: 100, overflowY: 'hidden'},
      flat,
    );
    const content = node('content', {}, hidden);
    const restore = captureScroll(content);
    far.scrollTop = 0;
    restore();
    expect(far.scrollTop).toBe(77);
  });

  it('US-008 AC-19: does nothing when nothing scrolls', () => {
    const content = node('content', {}, node('parent'));
    expect(() => captureScroll(content)()).not.toThrow();
  });
});

describe('US-008 AC-19 wiring of the settings tab (text check)', () => {
  const tab = settingsSource();

  it('US-008 AC-19: display() captures the position before it empties the tab and restores it after the rows are built, also after the fonts are filled', () => {
    expect(tab).toMatch(/captureScroll\(containerEl\b/);
    expect(tab.match(/restoreScroll\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('US-008 AC-19: the position is put back right after the draw and again after the fonts are filled', () => {
    expect(tab).toMatch(
      /this\.showGlobals\(containerEl\);\s*this\.restoreScroll\(\);/,
    );
    expect(tab).toMatch(
      /addFontRows\(holder, this\.rowsEnv\(\)\)\.finally\(\s*\(\) =>\s*this\.restoreScroll\(\),?\s*\)/,
    );
  });
});
