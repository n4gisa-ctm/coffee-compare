/**
 * 差分判定ロジック。
 * ルール：
 * - 空欄（null）は「不明」。不明→値あり は「新たに入力」であり、差分を捏造しない。
 * - 意図した変更（planned）と観測された差（actual）を区別する。
 */
import type { BrewParameters, ParamKey } from './types';
import { PARAM_KEYS } from './types';

export type DiffKind =
  | 'unchanged' // 同じ値（両方不明を含む）
  | 'changed' // 値あり → 別の値
  | 'newly-entered' // 不明 → 値あり
  | 'cleared'; // 値あり → 不明

export interface DiffRow {
  key: ParamKey;
  baseValue: number | string | null;
  trialValue: number | string | null;
  kind: DiffKind;
  /** 数値項目の差分（例 -2, +15）。changed かつ数値のときのみ */
  delta: number | null;
  /** 意図して変えた項目か */
  planned: boolean;
}

const NUMERIC_KEYS: ReadonlySet<ParamKey> = new Set([
  'doseG',
  'waterMl',
  'tempC',
  'totalTimeSec',
  'bloomTimeSec',
]);

export function isNumericKey(key: ParamKey): boolean {
  return NUMERIC_KEYS.has(key);
}

function valuesEqual(a: number | string | null, b: number | string | null): boolean {
  if (a === null && b === null) return true;
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return a === b;
}

export function diffParam(
  key: ParamKey,
  base: BrewParameters,
  trial: BrewParameters,
  plannedChanges: ParamKey[],
): DiffRow {
  const baseValue = base[key];
  const trialValue = trial[key];
  const planned = plannedChanges.includes(key);

  let kind: DiffKind;
  let delta: number | null = null;

  if (valuesEqual(baseValue, trialValue)) {
    kind = 'unchanged';
  } else if (baseValue === null) {
    kind = 'newly-entered'; // 差分を出さない
  } else if (trialValue === null) {
    kind = 'cleared';
  } else {
    kind = 'changed';
    if (isNumericKey(key) && typeof baseValue === 'number' && typeof trialValue === 'number') {
      delta = round2(trialValue - baseValue);
    }
  }

  return { key, baseValue, trialValue, kind, delta, planned };
}

export function diffParams(
  base: BrewParameters,
  trial: BrewParameters,
  plannedChanges: ParamKey[],
): DiffRow[] {
  return PARAM_KEYS.map((key) => diffParam(key, base, trial, plannedChanges));
}

/** 意図した変更以外で観測された差（actualDifferences） */
export function actualDifferences(rows: DiffRow[]): DiffRow[] {
  return rows.filter((r) => !r.planned && r.kind !== 'unchanged');
}

/** 豆量・湯量からの参考比率 1:x（派生値。操作項目として数えない） */
export function brewRatio(params: BrewParameters): number | null {
  if (params.doseG > 0 && params.waterMl > 0) {
    return round1(params.waterMl / params.doseG);
  }
  return null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
