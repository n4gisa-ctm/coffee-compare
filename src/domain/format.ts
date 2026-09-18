/**
 * 表示用フォーマット。値がnullのとき「—（不明）」表現はUI側で行い、
 * ここでは値→文字列の変換のみを担う。
 */
import type { ParamKey, RoastLevel, RelativeLevel, Preference } from './types';

export const PARAM_LABELS: Record<ParamKey, string> = {
  doseG: '豆量',
  waterMl: '総注湯量',
  grind: '挽き目',
  tempC: '湯温',
  totalTimeSec: '総抽出時間',
  bloomTimeSec: '蒸らし時間',
  pourNote: '注ぎ方メモ',
};

export const PARAM_UNITS: Partial<Record<ParamKey, string>> = {
  doseG: 'g',
  waterMl: 'ml',
  tempC: '℃',
};

export const ROAST_LABELS: Record<RoastLevel, string> = {
  light: '浅煎り',
  'medium-light': '中浅煎り',
  medium: '中煎り',
  'medium-dark': '中深煎り',
  dark: '深煎り',
};

export const RELATIVE_LABELS: Record<RelativeLevel, string> = {
  weaker: '弱い',
  same: '同じくらい',
  stronger: '強い',
  unsure: '分からない',
};

export const PREFERENCE_LABELS: Record<Preference, string> = {
  baseline: '基準が好き',
  trial: '今回が好き',
  unsure: '違いが分からない',
};

/** 相対味評価の文（例：基準より弱い／基準と同じくらい／分からない） */
export function formatRelativeTaste(level: RelativeLevel, baseLabel = '基準'): string {
  switch (level) {
    case 'weaker':
      return `${baseLabel}より弱い`;
    case 'stronger':
      return `${baseLabel}より強い`;
    case 'same':
      return `${baseLabel}と同じくらい`;
    case 'unsure':
      return '分からない';
  }
}

/** 秒 → 「m分s秒」 */
export function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}秒`;
  if (s === 0) return `${m}分`;
  return `${m}分${s}秒`;
}

export function formatParamValue(key: ParamKey, value: number | string | null): string {
  if (value === null || value === '') return '—';
  if (key === 'totalTimeSec' || key === 'bloomTimeSec') {
    return formatSeconds(value as number);
  }
  const unit = PARAM_UNITS[key];
  return unit ? `${value}${unit}` : String(value);
}

/** 差分表示（例 -2℃, +15秒）。時間はわかりやすく秒表記 */
export function formatDelta(key: ParamKey, delta: number): string {
  const sign = delta > 0 ? '+' : '−';
  const abs = Math.abs(delta);
  if (key === 'totalTimeSec' || key === 'bloomTimeSec') {
    return `${sign}${formatSeconds(abs)}`;
  }
  const unit = PARAM_UNITS[key] ?? '';
  return `${sign}${abs}${unit}`;
}

/** ISO datetime → 2026/09/19 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(iso)} ${hh}:${mm}`;
}
