import { describe, it, expect } from 'vitest';
import { validateBackup } from './backup';
import type { BackupFile } from '../domain/types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../domain/types';

function makeBackup(): BackupFile {
  const params = {
    doseG: 15,
    waterMl: 240,
    grind: null,
    tempC: 92,
    totalTimeSec: null,
    bloomTimeSec: null,
    pourNote: null,
  };
  return {
    app: 'coffee-compare',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: '2026-09-19T00:00:00.000Z',
    beanBatches: [{ id: 'bean1', name: '豆', roastLevel: null, purchasedAt: null, roastedAt: null }],
    groups: [
      {
        id: 'g1',
        beanBatchId: 'bean1',
        brewerName: 'V60',
        grinderName: null,
        baselineBrewId: 'b1',
        archivedAt: null,
        createdAt: '2026-09-19T00:00:00.000Z',
      },
    ],
    brews: [
      { id: 'b1', groupId: 'g1', brewedAt: '2026-09-19T00:00:00.000Z', params, note: null, revisionOf: null },
      { id: 'b2', groupId: 'g1', brewedAt: '2026-09-19T01:00:00.000Z', params, note: null, revisionOf: null },
    ],
    comparisons: [
      {
        id: 'c1',
        groupId: 'g1',
        baselineBrewId: 'b1',
        trialBrewId: 'b2',
        plannedChanges: ['tempC'],
        preference: 'trial',
        relativeTaste: { acidity: null, bitterness: null, body: null },
        comparisonMode: 'remembered',
        evaluatedAt: '2026-09-19T01:10:00.000Z',
        createdAt: '2026-09-19T01:05:00.000Z',
      },
    ],
    baselineChanges: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

describe('validateBackup（受け入れ条件12：不正JSONは既存データを壊さない＝検証で弾く）', () => {
  it('正しいバックアップは件数プレビューを返す', () => {
    const preview = validateBackup(JSON.stringify(makeBackup()));
    expect(preview.counts).toEqual({ groups: 1, brews: 2, comparisons: 1 });
  });

  it('JSONでないテキストはエラー', () => {
    expect(() => validateBackup('not json')).toThrow();
  });

  it('別アプリのファイルはエラー', () => {
    const b = { ...makeBackup(), app: 'other-app' };
    expect(() => validateBackup(JSON.stringify(b))).toThrow(/このアプリ/);
  });

  it('新しすぎる schemaVersion はエラー', () => {
    const b = { ...makeBackup(), schemaVersion: SCHEMA_VERSION + 1 };
    expect(() => validateBackup(JSON.stringify(b))).toThrow(/バージョン/);
  });

  it('重複IDはエラー', () => {
    const b = makeBackup();
    b.brews[1].id = 'b1';
    expect(() => validateBackup(JSON.stringify(b))).toThrow(/重複/);
  });

  it('存在しない一杯を参照する比較はエラー', () => {
    const b = makeBackup();
    b.comparisons[0].trialBrewId = 'missing';
    expect(() => validateBackup(JSON.stringify(b))).toThrow(/存在しない/);
  });

  it('存在しない基準を参照するグループはエラー', () => {
    const b = makeBackup();
    b.groups[0].baselineBrewId = 'missing';
    expect(() => validateBackup(JSON.stringify(b))).toThrow(/存在しない/);
  });
});
