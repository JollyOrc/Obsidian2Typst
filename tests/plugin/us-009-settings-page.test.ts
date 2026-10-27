// US-009 AC-12, AC-13 — the trim size dropdown and the gutter field of the
// settings tab: the pure rules behind them (what the dropdown shows, what a
// choice saves and removes, the question before a custom size is removed, when
// the gutter is enabled) and a text check of the wiring. The tab itself is
// checked by the manual check M2 (step 14). Source of truth:
// docs/user-stories/US-009-page-setup.md.
import {describe, expect, it} from 'vitest';
import {
  TRIM_CHOICES,
  gutterEnabled,
  planTrimChoice,
  planTrimSizes,
  trimChoiceOf,
} from '../../src/plugin/settings/page-fields';
import {settingsSource} from '../support/settings-source';

describe('US-009 AC-12 what the dropdown shows', () => {
  it('US-009 AC-12: offers (built-in), the four names and Custom, in this order', () => {
    expect([...TRIM_CHOICES]).toEqual([
      '(built-in)',
      'A4',
      'A5',
      'A6',
      'US Letter',
      'Custom',
    ]);
  });

  it('US-009 AC-12: shows Custom when a width or a height is stored, else the name, else (built-in)', () => {
    expect(trimChoiceOf(undefined)).toBe('(built-in)');
    expect(trimChoiceOf({})).toBe('(built-in)');
    expect(trimChoiceOf({trimSize: 'A5'})).toBe('A5');
    expect(trimChoiceOf({trimSize: 'US Letter'})).toBe('US Letter');
    expect(trimChoiceOf({trimWidth: 160})).toBe('Custom');
    expect(trimChoiceOf({trimHeight: 240})).toBe('Custom');
    expect(
      trimChoiceOf({trimSize: 'A5', trimWidth: 160, trimHeight: 240}),
    ).toBe('Custom');
  });

  it('US-009 AC-12: shows (built-in) for a name that is not one of the four (the value is invalid anyway)', () => {
    expect(trimChoiceOf({trimSize: 'A55'})).toBe('(built-in)');
  });
});

describe('US-009 AC-12 what a choice saves', () => {
  it('US-009 AC-12: Custom removes nothing and asks nothing', () => {
    const page = {trimSize: 'A5', gutter: 4};
    expect(planTrimChoice(page, 'Custom')).toEqual({page, confirm: null});
  });

  it('US-009 AC-12: a name stores trimSize and removes width and height in one result, keeping the other fields', () => {
    const plan = planTrimChoice(
      {trimWidth: 160, trimHeight: 240, bleed: 3, margins: {top: 18}},
      'A5',
    );
    expect(plan.page).toEqual({trimSize: 'A5', bleed: 3, margins: {top: 18}});
    expect('trimWidth' in plan.page).toBe(false);
    expect('trimHeight' in plan.page).toBe(false);
  });

  it('US-009 AC-12: asks before a stored custom size is removed, with the exact text', () => {
    expect(
      planTrimChoice({trimWidth: 160, trimHeight: 240}, 'A5').confirm,
    ).toEqual({
      title: 'Remove the custom trim size?',
      lines: [
        'The values "160 × 240 mm" are removed from the Defaults. Presets that do not set them use the trim size "A5".',
      ],
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });
  });

  it('US-009 AC-12: (built-in) removes all three values and says so in the question', () => {
    const plan = planTrimChoice(
      {trimSize: 'A4', trimWidth: 160, trimHeight: 240},
      '(built-in)',
    );
    expect(plan.page).toEqual({});
    expect(plan.confirm?.lines[0]).toBe(
      'The values "160 × 240 mm" are removed from the Defaults. Presets that do not set them use the built-in trim size.',
    );
  });

  it('US-009 AC-12: writes a missing value as a dash', () => {
    expect(planTrimChoice({trimWidth: 160}, 'A4').confirm?.lines[0]).toContain(
      '"160 × – mm"',
    );
    expect(planTrimChoice({trimHeight: 240}, 'A4').confirm?.lines[0]).toContain(
      '"– × 240 mm"',
    );
  });

  it('US-009 AC-12: asks nothing when no width or height is removed (name to name, name to built-in)', () => {
    expect(planTrimChoice({trimSize: 'A4'}, 'A6')).toEqual({
      page: {trimSize: 'A6'},
      confirm: null,
    });
    expect(planTrimChoice({trimSize: 'A4'}, '(built-in)')).toEqual({
      page: {},
      confirm: null,
    });
    expect(planTrimChoice(undefined, 'US Letter')).toEqual({
      page: {trimSize: 'US Letter'},
      confirm: null,
    });
  });

  it('US-009 AC-12: does not change the object it was given', () => {
    const page = {trimWidth: 160, trimHeight: 240};
    planTrimChoice(page, 'A5');
    expect(page).toEqual({trimWidth: 160, trimHeight: 240});
  });
});

describe('US-009 AC-12 the width and height are saved together', () => {
  const hint = 'Enter width and height; they are saved together';

  it('US-009 AC-12: saves both when both are numbers, in one result that keeps the other fields', () => {
    expect(planTrimSizes({bleed: 3, trimSize: 'A5'}, '160', '240')).toEqual({
      page: {bleed: 3, trimSize: 'A5', trimWidth: 160, trimHeight: 240},
      hint: null,
    });
  });

  it('US-009 AC-12: saves nothing while one field is empty or not a number, and says why', () => {
    expect(planTrimSizes({}, '160', '')).toEqual({page: null, hint});
    expect(planTrimSizes({}, '', '240')).toEqual({page: null, hint});
    expect(planTrimSizes({}, '160', 'abc')).toEqual({page: null, hint});
    expect(planTrimSizes({}, ' ', '240')).toEqual({page: null, hint});
  });

  it('US-009 AC-12: removes both when both are emptied', () => {
    expect(
      planTrimSizes({trimWidth: 160, trimHeight: 240, bleed: 3}, '', ' '),
    ).toEqual({page: {bleed: 3}, hint: null});
  });

  it('US-009 AC-12: hands a number that AC-2 refuses to the validation (it is saved as typed)', () => {
    expect(planTrimSizes({}, '10', '20').page).toEqual({
      trimWidth: 10,
      trimHeight: 20,
    });
  });

  it('US-009 AC-12: does not change the object it was given', () => {
    const page = {trimWidth: 160, trimHeight: 240};
    planTrimSizes(page, '', '');
    expect(page).toEqual({trimWidth: 160, trimHeight: 240});
  });
});

describe('US-009 AC-13 the gutter field', () => {
  it('US-009 AC-13: is enabled only while the Defaults have facing pages turned on', () => {
    expect(gutterEnabled({facingPages: true})).toBe(true);
    expect(gutterEnabled({facingPages: false})).toBe(false);
    expect(gutterEnabled({})).toBe(false);
    expect(gutterEnabled(undefined)).toBe(false);
  });
});

describe('US-009 AC-12, AC-13 wiring of the settings tab (text check)', () => {
  const tab = settingsSource();

  it('US-009 AC-12: the Trim size row is a dropdown driven by the plan and the question', () => {
    expect(tab).toContain('planTrimChoice(');
    expect(tab).toContain('trimChoiceOf(');
    expect(tab).toMatch(/plan\.confirm/);
  });

  it('US-009 AC-12: the width and height rows are only built for Custom', () => {
    expect(tab).toMatch(/=== 'Custom'/);
  });

  it('US-009 AC-13: the gutter row is disabled by gutterEnabled and the tab is drawn again when Facing pages changes (SCAR-016)', () => {
    expect(tab).toContain('gutterEnabled(');
    expect(tab).toContain('setDisabled(');
    expect(tab).toMatch(/facingPages[\s\S]{0,400}env\.redraw\(\)/);
  });

  it('US-009 AC-13: the gutter field is disabled with the result of gutterEnabled, not a constant', () => {
    expect(tab).toContain('t.setDisabled(!enabled || owner !== null)');
    expect(tab).toContain('Used only with facing pages');
  });

  it('US-009 AC-12: choosing Custom is remembered so that the width and height rows appear before a size is stored', () => {
    expect(tab).toContain("env.trim.custom = choice === 'Custom'");
    expect(tab).toMatch(/stored === 'Custom' \|\| env\.trim\.custom/);
  });

  it('US-009 AC-12: the width and height rows are always built, disabled unless Custom, saved with planTrimSizes and have no reset icon', () => {
    expect(tab).not.toContain('!custom && (key');
    expect(tab).toContain('addTrimSizeRow(');
    expect(tab).toContain('planTrimSizes(');
    expect(tab).toContain('Used only with a custom trim size');
  });

  it('US-009 AC-13: the gutter row stands directly under the Facing pages row', () => {
    expect(tab).toMatch(
      /label: 'Facing pages'[^}]*\},\s*\{label: 'Gutter \(mm\)'/,
    );
  });

  it('US-009 AC-12: the width and height fields are disabled with the result of custom, not a constant', () => {
    expect(tab).toContain('t.setDisabled(!custom || owner !== null)');
  });
});
