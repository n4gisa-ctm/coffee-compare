/**
 * 比較表（中核コンポーネント）。
 * 同じ項目を同じ行に配置し、変更行のみ淡い背景＋差分テキストで強調する。
 * 色だけに依存せず、差分テキスト・バッジ・記号を併記する。
 */
import type { BrewParameters, ParamKey } from '../domain/types';
import { diffParams, brewRatio, type DiffRow } from '../domain/diff';
import { PARAM_LABELS, formatParamValue, formatDelta } from '../domain/format';

function rowClass(row: DiffRow): string {
  if (row.kind === 'changed' || row.kind === 'cleared') return 'compare-table__row--changed';
  if (row.kind === 'newly-entered') return 'compare-table__row--new';
  return '';
}

export function CompareTable({
  baseLabel,
  trialLabel,
  baseParams,
  trialParams,
  plannedChanges,
  caption,
}: {
  baseLabel: string;
  trialLabel: string;
  baseParams: BrewParameters;
  trialParams: BrewParameters;
  plannedChanges: ParamKey[];
  caption?: string;
}) {
  const rows = diffParams(baseParams, trialParams, plannedChanges);
  const baseRatio = brewRatio(baseParams);
  const trialRatio = brewRatio(trialParams);
  const hasActualDiff = rows.some((r) => !r.planned && r.kind !== 'unchanged');

  return (
    <div>
      {(plannedChanges.length > 0 || hasActualDiff) && (
        <p className="text-sub" style={{ margin: '0 0 8px' }}>
          ● 意図した変更 ／ ○ 観測された差（変更の意図なし）
        </p>
      )}
      <table className="compare-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th scope="col">{baseLabel}</th>
            <th scope="col">{trialLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={rowClass(row)}>
              <th scope="row">
                {row.kind !== 'unchanged' && (
                  <span className="compare-table__marker" aria-hidden="true">
                    {row.planned ? '● ' : '○ '}
                  </span>
                )}
                {PARAM_LABELS[row.key]}
              </th>
              <td>{formatParamValue(row.key, row.baseValue)}</td>
              <td>
                {formatParamValue(row.key, row.trialValue)}
                {row.kind === 'changed' && row.delta !== null && (
                  <span className="compare-table__delta">{formatDelta(row.key, row.delta)}</span>
                )}
                {row.kind === 'newly-entered' && (
                  <span className="badge badge--new" style={{ marginLeft: 4 }}>
                    新規入力
                  </span>
                )}
                {row.kind === 'cleared' && (
                  <span className="badge badge--muted" style={{ marginLeft: 4 }}>
                    未計測
                  </span>
                )}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row">比率（参考）</th>
            <td>{baseRatio !== null ? `1:${baseRatio}` : '—'}</td>
            <td>{trialRatio !== null ? `1:${trialRatio}` : '—'}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-sub" style={{ marginTop: 8 }}>
        比率は豆量と湯量から自動計算した参考値です。
      </p>
    </div>
  );
}
