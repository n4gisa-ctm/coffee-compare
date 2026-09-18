/**
 * JSONバックアップ／復元。
 * 復元は全置換方式：事前検証で不正なら既存データを一切変更しない。
 */
import type { AllData } from './db';
import { STORES, writeTx, settingsPutOp, type WriteOp } from './db';
import type { BackupFile } from '../domain/types';
import { SCHEMA_VERSION, DEFAULT_SETTINGS } from '../domain/types';

export function buildBackup(data: AllData): BackupFile {
  return {
    app: 'coffee-compare',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    beanBatches: data.beanBatches,
    groups: data.groups,
    brews: data.brews,
    comparisons: data.comparisons,
    baselineChanges: data.baselineChanges,
    settings: data.settings,
  };
}

export interface RestorePreview {
  backup: BackupFile;
  counts: { groups: number; brews: number; comparisons: number };
}

/**
 * バックアップJSONの検証。失敗時は Error を投げる（既存データに触れない）。
 * 形式・型・対応バージョン・参照ID・重複IDを検証する。
 */
export function validateBackup(text: string): RestorePreview {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSONとして読み込めませんでした。ファイルを確認してください。');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('バックアップの形式が正しくありません。');
  const b = raw as Record<string, unknown>;
  if (b.app !== 'coffee-compare') throw new Error('このアプリのバックアップファイルではありません。');
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > SCHEMA_VERSION) {
    throw new Error('対応していないバージョンのバックアップです。');
  }
  for (const key of ['beanBatches', 'groups', 'brews', 'comparisons', 'baselineChanges'] as const) {
    if (!Array.isArray(b[key])) throw new Error(`データ（${key}）の形式が正しくありません。`);
  }

  const backup = raw as BackupFile;

  // 重複ID検証
  const seen = new Set<string>();
  const checkIds = (items: { id?: unknown }[], label: string) => {
    for (const item of items) {
      if (typeof item?.id !== 'string' || item.id === '') {
        throw new Error(`${label}にIDのないレコードがあります。`);
      }
      if (seen.has(item.id)) throw new Error(`IDが重複しています（${item.id}）。`);
      seen.add(item.id);
    }
  };
  checkIds(backup.beanBatches, '豆データ');
  checkIds(backup.groups, 'グループ');
  checkIds(backup.brews, '一杯の記録');
  checkIds(backup.comparisons, '比較');
  checkIds(backup.baselineChanges, '基準の履歴');

  // 参照ID検証
  const beanIds = new Set(backup.beanBatches.map((x) => x.id));
  const groupIds = new Set(backup.groups.map((x) => x.id));
  const brewIds = new Set(backup.brews.map((x) => x.id));
  for (const g of backup.groups) {
    if (!beanIds.has(g.beanBatchId)) throw new Error('グループが存在しない豆データを参照しています。');
    if (g.baselineBrewId !== null && !brewIds.has(g.baselineBrewId)) {
      throw new Error('グループの基準が存在しない一杯を参照しています。');
    }
  }
  for (const brew of backup.brews) {
    if (!groupIds.has(brew.groupId)) throw new Error('一杯の記録が存在しないグループを参照しています。');
    if (brew.revisionOf !== null && !brewIds.has(brew.revisionOf)) {
      throw new Error('訂正版が存在しない一杯を参照しています。');
    }
  }
  for (const c of backup.comparisons) {
    if (!groupIds.has(c.groupId)) throw new Error('比較が存在しないグループを参照しています。');
    if (!brewIds.has(c.baselineBrewId) || !brewIds.has(c.trialBrewId)) {
      throw new Error('比較が存在しない一杯を参照しています。');
    }
  }

  return {
    backup,
    counts: {
      groups: backup.groups.length,
      brews: backup.brews.length,
      comparisons: backup.comparisons.length,
    },
  };
}

/** 検証済みバックアップで全置換する（clear + put を1トランザクションで実行） */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  const ops: WriteOp[] = STORES.map((store) => ({ store, type: 'clear' as const }));
  const putAll = (store: (typeof STORES)[number], items: { id: string }[]) => {
    for (const item of items) ops.push({ store, type: 'put', value: item });
  };
  putAll('beanBatches', backup.beanBatches);
  putAll('groups', backup.groups);
  putAll('brews', backup.brews);
  putAll('comparisons', backup.comparisons);
  putAll('baselineChanges', backup.baselineChanges);
  ops.push(settingsPutOp({ ...DEFAULT_SETTINGS, ...backup.settings, schemaVersion: SCHEMA_VERSION }));
  await writeTx(ops);
}

/** JSONファイルとしてダウンロード */
export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = backup.exportedAt.slice(0, 10);
  a.href = url;
  a.download = `coffee-compare-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
