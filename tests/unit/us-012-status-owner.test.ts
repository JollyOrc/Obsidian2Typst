// US-012 AC-11, AC-2 — the status line and the owner of a value, as pure
// functions (the controller and panel tests use them too, but those files wait
// for later tickets). Source of truth:
// docs/user-stories/US-012-style-preview-panel.md.
import {describe, expect, it} from 'vitest';
import {ownerNote, shownValue} from '../../src/core/presets/owner';
import {statusLine, warningCountText} from '../../src/core/preview/status';

const state = (over: Partial<Parameters<typeof statusLine>[0]> = {}) => ({
  status: 'ready' as const,
  noteName: 'Rules',
  error: null,
  hint: null,
  warnings: 2,
  ...over,
});

describe('US-012 AC-11 statusLine', () => {
  it('US-012 AC-11: no note says to open one', () => {
    expect(statusLine(state({status: 'no-note', noteName: null}))).toBe(
      'Open a note to preview it',
    );
  });

  it('US-012 AC-11: a finished compile ends with the warning count', () => {
    expect(statusLine(state())).toBe('Preview of: Rules · 2 warnings');
    expect(statusLine(state({warnings: 1}))).toBe(
      'Preview of: Rules · 1 warning',
    );
    expect(statusLine(state({warnings: 0}))).toBe(
      'Preview of: Rules · no warnings',
    );
    expect(warningCountText(0)).toBe('no warnings');
  });

  it('US-012 AC-11: compiling, export and error each have their text', () => {
    expect(statusLine(state({status: 'compiling'}))).toBe(
      'Preview of: Rules · Compiling…',
    );
    expect(statusLine(state({status: 'export'}))).toBe(
      'Preview of: Rules · Export running; the preview updates afterwards',
    );
    expect(statusLine(state({status: 'error', error: 'Typst error: x'}))).toBe(
      'Preview of: Rules · Typst error: x',
    );
  });

  it('US-012 AC-4: the hint is added at the end', () => {
    expect(statusLine(state({hint: 'Note changed; press Refresh'}))).toBe(
      'Preview of: Rules · 2 warnings · Note changed; press Refresh',
    );
  });

  it('US-012 AC-11: a result without a warning count shows only the note name', () => {
    expect(statusLine(state({warnings: null}))).toBe('Preview of: Rules');
  });
});

describe('US-012 AC-2 ownerNote and shownValue', () => {
  it('US-012 AC-2: trim size, width and height are one group; a preset that sets one owns all three', () => {
    for (const set of ['trimSize', 'trimWidth', 'trimHeight'])
      for (const row of ['trimSize', 'trimWidth', 'trimHeight'])
        expect(
          ownerNote('P', {page: {[set]: 1}}, ['page', row]),
          `${set} owns ${row}`,
        ).toContain('Set by preset');
    expect(ownerNote('P', {page: {bleed: 1}}, ['page', 'trimSize'])).toBeNull();
  });

  it('US-012 AC-2: a null value of the preset (empty YAML key) is not an owner', () => {
    expect(ownerNote('P', {page: {bleed: null}}, ['page', 'bleed'])).toBeNull();
  });

  it('US-012 AC-2: a preset that is not an object owns nothing', () => {
    expect(ownerNote('P', null, ['page', 'bleed'])).toBeNull();
    expect(ownerNote('P', 'text', ['page', 'bleed'])).toBeNull();
    expect(shownValue(undefined, {page: {bleed: 3}}, ['page', 'bleed'])).toBe(
      3,
    );
  });

  it('US-012 AC-2: a top-level field is owned like a nested one', () => {
    expect(
      ownerNote('P', {headingNumbering: 'a.1'}, ['headingNumbering']),
    ).toBe('Set by preset "P"; change it in the preset note');
  });

  it('US-012 AC-2: the arguments are not changed', () => {
    const preset = {page: {bleed: 5}};
    const defaults = {page: {bleed: 3}};
    shownValue(preset, defaults, ['page', 'bleed']);
    expect(preset).toEqual({page: {bleed: 5}});
    expect(defaults).toEqual({page: {bleed: 3}});
  });
});
