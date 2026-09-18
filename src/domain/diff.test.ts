import { describe, it, expect } from 'vitest';
import { diffParam, diffParams, actualDifferences, brewRatio } from './diff';
import type { BrewParameters } from './types';

const base: BrewParameters = {
  doseG: 15,
  waterMl: 240,
  grind: 'C40 24クリック',
  tempC: 92,
  totalTimeSec: 165,
  bloomTimeSec: 30,
  pourNote: null,
};

describe('diffParam', () => {
  it('92℃→90℃ は changed で差分 -2（受け入れ条件2）', () => {
    const trial = { ...base, tempC: 90 };
    const row = diffParam('tempC', base, trial, ['tempC']);
    expect(row.kind).toBe('changed');
    expect(row.delta).toBe(-2);
    expect(row.planned).toBe(true);
  });

  it('不明→90℃ は newly-entered で差分を捏造しない（受け入れ条件3）', () => {
    const b = { ...base, tempC: null };
    const trial = { ...b, tempC: 90 };
    const row = diffParam('tempC', b, trial, []);
    expect(row.kind).toBe('newly-entered');
    expect(row.delta).toBeNull();
  });

  it('値あり→不明 は cleared で差分なし', () => {
    const trial = { ...base, tempC: null };
    const row = diffParam('tempC', base, trial, []);
    expect(row.kind).toBe('cleared');
    expect(row.delta).toBeNull();
  });

  it('両方不明は unchanged（空欄を同条件と混同しないが差分も出さない）', () => {
    const b = { ...base, tempC: null };
    const row = diffParam('tempC', b, { ...b }, []);
    expect(row.kind).toBe('unchanged');
  });

  it('文字列項目の変更は changed だが数値差分なし', () => {
    const trial = { ...base, grind: 'C40 26クリック' };
    const row = diffParam('grind', base, trial, ['grind']);
    expect(row.kind).toBe('changed');
    expect(row.delta).toBeNull();
  });

  it('時間の差分は秒で計算される', () => {
    const trial = { ...base, totalTimeSec: 180 };
    const row = diffParam('totalTimeSec', base, trial, []);
    expect(row.delta).toBe(15);
  });
});

describe('actualDifferences（意図と観測の区別、受け入れ条件4）', () => {
  it('挽き目を意図して変え、時間も変わった場合、時間は観測された差として分離される', () => {
    const trial = { ...base, grind: 'C40 20クリック', totalTimeSec: 180 };
    const rows = diffParams(base, trial, ['grind']);
    const actual = actualDifferences(rows);
    expect(actual.map((r) => r.key)).toEqual(['totalTimeSec']);
    const grindRow = rows.find((r) => r.key === 'grind')!;
    expect(grindRow.planned).toBe(true);
  });

  it('変更なし（同じ条件でもう一度）は差分ゼロ', () => {
    const rows = diffParams(base, { ...base }, []);
    expect(rows.every((r) => r.kind === 'unchanged')).toBe(true);
    expect(actualDifferences(rows)).toHaveLength(0);
  });
});

describe('brewRatio', () => {
  it('豆量と湯量から 1:x を計算する（参考表示）', () => {
    expect(brewRatio(base)).toBe(16);
  });
  it('小数は1桁に丸める', () => {
    expect(brewRatio({ ...base, doseG: 14 })).toBe(17.1);
  });
});
