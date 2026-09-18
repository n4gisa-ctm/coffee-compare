/**
 * 抽出条件の入力フォーム。
 * highlightKeys（意図して変える項目）を先頭に表示し、他は基準値を引き継いだまま編集可能。
 */
import { useState } from 'react';
import type { BrewParameters, ParamKey } from '../domain/types';
import type { ValidationIssue } from '../domain/validate';
import { NumberField, TextField, TimeField, TextAreaField } from './components';

function issueFor(issues: ValidationIssue[], field: ParamKey, level: 'error' | 'warning') {
  return issues.find((i) => i.field === field && i.level === level)?.message;
}

export function ParamsEditor({
  value,
  onChange,
  issues,
  highlightKeys = [],
  collapsible = false,
}: {
  value: BrewParameters;
  onChange: (v: BrewParameters) => void;
  issues: ValidationIssue[];
  /** 先頭に表示する（意図して変える）項目 */
  highlightKeys?: ParamKey[];
  /** true のとき、highlightKeys 以外を「ほかの条件も変更」で開閉 */
  collapsible?: boolean;
}) {
  const [showOthers, setShowOthers] = useState(!collapsible);

  const set = <K extends ParamKey>(key: K, v: BrewParameters[K]) =>
    onChange({ ...value, [key]: v });

  const fields: Record<ParamKey, JSX.Element> = {
    doseG: (
      <NumberField
        key="doseG"
        label="豆量"
        unit="g"
        value={value.doseG > 0 ? value.doseG : null}
        onChange={(v) => set('doseG', v ?? 0)}
        error={issueFor(issues, 'doseG', 'error')}
        warning={issueFor(issues, 'doseG', 'warning')}
      />
    ),
    waterMl: (
      <NumberField
        key="waterMl"
        label="総注湯量"
        unit="ml"
        value={value.waterMl > 0 ? value.waterMl : null}
        onChange={(v) => set('waterMl', v ?? 0)}
        hint="完成した飲料量ではなく、注いだお湯の量です"
        error={issueFor(issues, 'waterMl', 'error')}
        warning={issueFor(issues, 'waterMl', 'warning')}
      />
    ),
    grind: (
      <TextField
        key="grind"
        label="挽き目"
        optional
        value={value.grind ?? ''}
        onChange={(v) => set('grind', v || null)}
        placeholder="例：C40 24クリック、店で中挽き"
      />
    ),
    tempC: (
      <NumberField
        key="tempC"
        label="湯温"
        unit="℃"
        optional
        allowUnknown
        value={value.tempC}
        onChange={(v) => set('tempC', v)}
        error={issueFor(issues, 'tempC', 'error')}
      />
    ),
    totalTimeSec: (
      <TimeField
        key="totalTimeSec"
        label="総抽出時間"
        valueSec={value.totalTimeSec}
        onChange={(v) => set('totalTimeSec', v)}
        hint="最初にお湯を注いでから、ドリッパーを外すまで"
        error={issueFor(issues, 'totalTimeSec', 'error')}
        warning={issueFor(issues, 'totalTimeSec', 'warning')}
      />
    ),
    bloomTimeSec: (
      <TimeField
        key="bloomTimeSec"
        label="蒸らし時間"
        valueSec={value.bloomTimeSec}
        onChange={(v) => set('bloomTimeSec', v)}
        error={issueFor(issues, 'bloomTimeSec', 'error')}
        warning={issueFor(issues, 'bloomTimeSec', 'warning')}
      />
    ),
    pourNote: (
      <TextAreaField
        key="pourNote"
        label="注ぎ方メモ"
        optional
        value={value.pourNote ?? ''}
        onChange={(v) => set('pourNote', v || null)}
        placeholder="例：3投、center pour"
      />
    ),
  };

  const order: ParamKey[] = ['doseG', 'waterMl', 'grind', 'tempC', 'totalTimeSec', 'bloomTimeSec', 'pourNote'];
  const first = order.filter((k) => highlightKeys.includes(k));
  const rest = order.filter((k) => !highlightKeys.includes(k));

  return (
    <div className="stack">
      {first.map((k) => fields[k])}
      {collapsible && rest.length > 0 && !showOthers && (
        <button type="button" className="btn btn--text" onClick={() => setShowOthers(true)}>
          ほかの条件も変更する
        </button>
      )}
      {showOthers && rest.map((k) => fields[k])}
    </div>
  );
}
