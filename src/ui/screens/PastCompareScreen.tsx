/**
 * 過去の完成済み2杯の閲覧比較。
 * 保存済み相対評価は、その組合せ（比較元→比較先）のものだけを表示する。
 */
import { useStore } from '../../application/store';
import type { Navigate } from '../routes';
import type { Id } from '../../domain/types';
import { formatDate, formatDateTime, formatRelativeTaste, PREFERENCE_LABELS } from '../../domain/format';
import { CompareTable } from '../CompareTable';

export function PastCompareScreen({
  baseId,
  trialId,
  navigate,
}: {
  baseId: Id | null;
  trialId: Id | null;
  navigate: Navigate;
}) {
  const store = useStore();
  const group = store.activeGroup;
  if (!group) {
    navigate({ name: 'history' });
    return null;
  }
  const brews = store.brews
    .filter((b) => b.groupId === group.id)
    .sort((a, b) => b.brewedAt.localeCompare(a.brewedAt));

  const base = brews.find((b) => b.id === baseId) ?? null;
  const trial = brews.find((b) => b.id === trialId) ?? null;

  // この組合せに対する保存済み評価のみ表示（別の組合せの評価を流用しない）
  const savedComparison =
    base && trial
      ? store.comparisons.find(
          (c) => c.baselineBrewId === base.id && c.trialBrewId === trial.id && c.preference !== null,
        ) ?? null
      : null;

  const select = (which: 'base' | 'trial', id: Id | null) =>
    navigate({
      name: 'pastCompare',
      baseId: which === 'base' ? id : baseId,
      trialId: which === 'trial' ? id : trialId,
    });

  const brewLabel = (b: (typeof brews)[number]) =>
    `${formatDateTime(b.brewedAt)}${b.revisionOf ? '（訂正版）' : ''}${
      group.baselineBrewId === b.id ? '（現在の基準）' : ''
    }`;

  return (
    <div>
      <div className="top-nav">
        <button type="button" className="btn btn--text" onClick={() => navigate({ name: 'history' })}>
          ← くらべるへ
        </button>
      </div>
      <h1 className="screen-title">過去の2杯をくらべる</h1>

      <div className="stack" style={{ marginBottom: 16 }}>
        <label className="field">
          <span className="field__label">比較元</span>
          <select value={baseId ?? ''} onChange={(e) => select('base', e.target.value || null)}>
            <option value="">選んでください</option>
            {brews.map((b) => (
              <option key={b.id} value={b.id} disabled={b.id === trialId}>
                {brewLabel(b)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">比較先</span>
          <select value={trialId ?? ''} onChange={(e) => select('trial', e.target.value || null)}>
            <option value="">選んでください</option>
            {brews.map((b) => (
              <option key={b.id} value={b.id} disabled={b.id === baseId}>
                {brewLabel(b)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {base && trial ? (
        <div className="card fade-in">
          <CompareTable
            baseLabel={`比較元（${formatDate(base.brewedAt)}）`}
            trialLabel={`比較先（${formatDate(trial.brewedAt)}）`}
            baseParams={base.params}
            trialParams={trial.params}
            plannedChanges={[]}
          />
          {(base.note || trial.note) && (
            <div style={{ marginTop: 12 }}>
              {base.note && <p style={{ margin: 0 }}>比較元：「{base.note}」</p>}
              {trial.note && <p style={{ margin: 0 }}>比較先：「{trial.note}」</p>}
            </div>
          )}
          {savedComparison ? (
            <div className="card card--sub" style={{ marginTop: 12 }}>
              <p style={{ margin: 0 }}>
                この組合せの当時の評価：<strong>{PREFERENCE_LABELS[savedComparison.preference!]}</strong>
              </p>
              {(['acidity', 'bitterness', 'body'] as const).map((k) => {
                const v = savedComparison.relativeTaste[k];
                if (!v) return null;
                const label = { acidity: '酸味', bitterness: '苦味', body: '濃さ' }[k];
                return (
                  <p key={k} className="text-sub" style={{ margin: 0 }}>
                    {label}：{formatRelativeTaste(v, '比較元')}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="text-sub" style={{ marginTop: 12, marginBottom: 0 }}>
              この組合せに対する保存済みの評価はありません。
            </p>
          )}
        </div>
      ) : (
        <p className="text-sub">2杯を選ぶと、条件と感想を横に並べて見られます。</p>
      )}
    </div>
  );
}
