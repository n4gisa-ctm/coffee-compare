/** くらべる：比較履歴と過去の2杯の閲覧比較。順位付け・平均点は出さない。 */
import { useStore } from '../../application/store';
import type { Navigate } from '../routes';
import { formatDate, PARAM_LABELS, PREFERENCE_LABELS } from '../../domain/format';
import { EmptyState } from '../components';

export function HistoryScreen({ navigate }: { navigate: Navigate }) {
  const store = useStore();
  const group = store.activeGroup;
  const activeGroups = store.groups.filter((g) => g.archivedAt === null);

  if (!group) {
    return (
      <div>
        <h1 className="screen-title">くらべる</h1>
        <EmptyState
          message="まだ豆と器具が登録されていません。"
          action={
            <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'groupForm', groupId: null })}>
              豆と器具を登録する
            </button>
          }
        />
      </div>
    );
  }

  const comparisons = store.comparisons
    .filter((c) => c.groupId === group.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const brews = store.brews
    .filter((b) => b.groupId === group.id)
    .sort((a, b) => b.brewedAt.localeCompare(a.brewedAt));

  return (
    <div>
      <h1 className="screen-title">くらべる</h1>

      <label className="field" style={{ marginBottom: 16 }}>
        <span className="field__label">豆・器具</span>
        <select value={group.id} onChange={(e) => void store.setActiveGroup(e.target.value)}>
          {activeGroups.map((g) => {
            const b = store.beanBatches.find((x) => x.id === g.beanBatchId);
            return (
              <option key={g.id} value={g.id}>
                {b?.name ?? '豆'} × {g.brewerName}
              </option>
            );
          })}
        </select>
      </label>

      <h2 className="section-heading">比較の履歴</h2>
      {comparisons.length === 0 ? (
        <EmptyState
          message={
            brews.length === 0
              ? 'まだ一杯もありません。最初の一杯を作りましょう。'
              : brews.length === 1
                ? '一杯だけあります。次の一杯を淹れると比較できます。'
                : 'まだ比較がありません。'
          }
          action={
            <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'home' })}>
              淹れるへ
            </button>
          }
        />
      ) : (
        <div className="stack">
          {comparisons.map((c) => {
            const changeLabels =
              c.plannedChanges.length === 0
                ? '同じ条件でもう一度'
                : c.plannedChanges.map((k) => PARAM_LABELS[k]).join('・');
            return (
              <button
                key={c.id}
                type="button"
                className="card history-card"
                onClick={() => navigate({ name: 'evaluate', comparisonId: c.id })}
              >
                <p className="text-sub" style={{ margin: 0 }}>
                  {formatDate(c.createdAt)}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>変更：{changeLabels}</strong>
                </p>
                {c.preference !== null ? (
                  <span className="badge badge--diff">{PREFERENCE_LABELS[c.preference]}</span>
                ) : (
                  <span className="badge badge--muted">未評価</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {brews.length >= 2 && (
        <>
          <h2 className="section-heading">過去の2杯をくらべる</h2>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate({ name: 'pastCompare', baseId: null, trialId: null })}
          >
            2杯を選んで見くらべる
          </button>
        </>
      )}

      {brews.length > 0 && (
        <>
          <h2 className="section-heading">一杯の記録</h2>
          <div className="stack">
            {brews.map((b) => {
              const isBaseline = group.baselineBrewId === b.id;
              const superseded = store.brews.some((x) => x.revisionOf === b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  className="card history-card"
                  onClick={() => navigate({ name: 'brewDetail', brewId: b.id })}
                >
                  <p style={{ margin: 0 }}>
                    {formatDate(b.brewedAt)}
                    {isBaseline && (
                      <span className="badge badge--baseline" style={{ marginLeft: 8 }}>
                        現在の基準
                      </span>
                    )}
                    {b.revisionOf && (
                      <span className="badge badge--muted" style={{ marginLeft: 8 }}>
                        訂正版
                      </span>
                    )}
                    {superseded && (
                      <span className="badge badge--muted" style={{ marginLeft: 8 }}>
                        訂正済み
                      </span>
                    )}
                  </p>
                  {b.note && (
                    <p className="text-sub" style={{ margin: '4px 0 0' }}>
                      「{b.note}」
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
