import { describe, it, expect } from 'vitest';
import { validateParams, hasErrors } from './validate';
import type { BrewParameters } from './types';

const ok: BrewParameters = {
  doseG: 15,
  waterMl: 240,
  grind: null,
  tempC: 92,
  totalTimeSec: 165,
  bloomTimeSec: 30,
  pourNote: null,
};

describe('validateParams', () => {
  it('正常値はエラーなし', () => {
    expect(validateParams(ok)).toHaveLength(0);
  });

  it('豆量0・湯量0はエラー', () => {
    const issues = validateParams({ ...ok, doseG: 0, waterMl: 0 });
    expect(hasErrors(issues)).toBe(true);
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(2);
  });

  it('湯温101℃はエラー、湯温nullは許可（不明）', () => {
    expect(hasErrors(validateParams({ ...ok, tempC: 101 }))).toBe(true);
    expect(hasErrors(validateParams({ ...ok, tempC: null }))).toBe(false);
  });

  it('負の時間・小数秒はエラー', () => {
    expect(hasErrors(validateParams({ ...ok, totalTimeSec: -1 }))).toBe(true);
    expect(hasErrors(validateParams({ ...ok, totalTimeSec: 1.5 }))).toBe(true);
  });

  it('異常に大きい値は warning（エラーにしない）', () => {
    const issues = validateParams({ ...ok, doseG: 500 });
    expect(hasErrors(issues)).toBe(false);
    expect(issues.some((i) => i.level === 'warning')).toBe(true);
  });
});
