/**
 * 入力バリデーション。
 * 数値必須項目は正数、温度0〜100℃、時間は0以上の整数秒。
 * 異常に大きい値はエラーではなく確認（warning）にする。
 */
import type { BrewParameters } from './types';

export interface ValidationIssue {
  field: keyof BrewParameters;
  level: 'error' | 'warning';
  message: string;
}

export function validateParams(params: BrewParameters): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!(params.doseG > 0)) {
    issues.push({ field: 'doseG', level: 'error', message: '豆量は0より大きい数値で入力してください' });
  } else if (params.doseG > 100) {
    issues.push({ field: 'doseG', level: 'warning', message: '豆量が100gを超えています。値を確認できます' });
  }

  if (!(params.waterMl > 0)) {
    issues.push({ field: 'waterMl', level: 'error', message: '総注湯量は0より大きい数値で入力してください' });
  } else if (params.waterMl > 2000) {
    issues.push({ field: 'waterMl', level: 'warning', message: '総注湯量が2000mlを超えています。値を確認できます' });
  }

  if (params.tempC !== null) {
    if (params.tempC < 0 || params.tempC > 100) {
      issues.push({ field: 'tempC', level: 'error', message: '湯温は0〜100℃の範囲で入力してください' });
    }
  }

  for (const field of ['totalTimeSec', 'bloomTimeSec'] as const) {
    const v = params[field];
    if (v !== null) {
      if (v < 0 || !Number.isInteger(v)) {
        issues.push({ field, level: 'error', message: '時間は0以上の整数秒で入力してください' });
      } else if (v > 30 * 60) {
        issues.push({ field, level: 'warning', message: '30分を超えています。値を確認できます' });
      }
    }
  }

  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}
