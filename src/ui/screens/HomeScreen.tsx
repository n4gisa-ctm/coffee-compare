/** ホーム「淹れる」：主操作は記録ではなく「基準と比べて淹れる」 */
import { useState } from 'react';
import { useStore } from '../../application/store';
import type { Navigate } from '../routes';
import { formatDate, formatParamValue } from '../../domain/format';
import { Dialog } from '../components';

export function HomeScreen({ navigate }: { navigate: Navigate }) {
  const store = useStore();
  const [confirmDiscard, setConfirmDiscard] = useState<null | (() => void)>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const group = store.activeGroup;
  const baseline = group?.baselineBrewId
    ? store.brews.find((b) => b.id === group.baselineBrewId)
    : null;
  const activeGroups = store.groups.filter((g) => g.archivedAt === null);
  const draft = store.draft;
  const unevaluated = store.comparisons.filter(
    (c) => c.preference === null && c.groupId === group?.id,
  );
  // 完成済みだがまだ基準になっていない初回の一杯（基準化の再案内）
  const baselineCandidate =
    group && !group.baselineBrewId
      ? store.brews.filter((b) => b.groupId === group.id).slice(-1)[0] ?? null
      : null;

  const startNew = (action: () => void) => {
    if (draft) {
      setConfirmDiscard(() => action);
    } else {
      action();
    }
  };

  const beginFirstBrew = () => {
    if (!group) return;
    startNew(() => {
      setBusy(true);
      setError(null);
      store
        .startFirstBrew(group.id, {
          doseG: 0,
          waterMl: 0,
          grind: null,
          tempC: null,
          totalTimeSec: null,
          bloomTimeSec: null,
          pourNote: null,
        })
        .then(() => navigate({ name: 'flow' }))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setBusy(false));
    });
  };

  return (
    <div>
      <h1 className="screen-title">淹れる</h1>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {/* 途中の比較を最優先で再開 */}
      {draft && (
        <div className="card stack" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>
            <strong>途中の一杯があります</strong>
          </p>
          <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'flow' })}>
            途中の比較を再開する
          </button>
        </div>
      )}

      {/* 未評価の案内 */}
      {unevaluated.length > 0 && (
        <div className="card card--sub" style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px' }}>
            <span className="badge badge--muted">未評価</span> あとで比べる一杯が{unevaluated.length}件あります
          </p>
          <button
            type="button"
            className="btn btn--text"
            onClick={() => navigate({ name: 'evaluate', comparisonId: unevaluated[0].id })}
          >
            評価を再開する
          </button>
        </div>
      )}

      {activeGroups.length === 0 ? (
        <div className="card">
          <p style={{ marginTop: 0 }}>
            まだ豆と器具が登録されていません。同じ豆・同じ器具の組合せが、比較のひとつの単位になります。
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => navigate({ name: 'groupForm', groupId: null })}
          >
            豆と器具を登録する
          </button>
        </div>
      ) : (
        group && (
          <>
            {/* グループ切替 */}
            <label className="field" style={{ marginBottom: 16 }}>
              <span className="field__label">いま淹れている豆・器具</span>
              <select
                value={group.id}
                onChange={(e) => void store.setActiveGroup(e.target.value)}
              >
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

            {baseline ? (
              <div className="card stack">
                <div>
                  <span className="badge badge--baseline">基準の一杯</span>{' '}
                  <span className="text-sub">{formatDate(baseline.brewedAt)} に淹れた一杯</span>
                </div>
                <dl className="baseline-summary">
                  <div>
                    <dt>豆量</dt>
                    <dd>{formatParamValue('doseG', baseline.params.doseG)}</dd>
                  </div>
                  <div>
                    <dt>湯量</dt>
                    <dd>{formatParamValue('waterMl', baseline.params.waterMl)}</dd>
                  </div>
                  <div>
                    <dt>湯温</dt>
                    <dd>{formatParamValue('tempC', baseline.params.tempC)}</dd>
                  </div>
                  <div>
                    <dt>抽出時間</dt>
                    <dd>{formatParamValue('totalTimeSec', baseline.params.totalTimeSec)}</dd>
                  </div>
                  <div>
                    <dt>挽き目</dt>
                    <dd>{formatParamValue('grind', baseline.params.grind)}</dd>
                  </div>
                </dl>
                {baseline.note && <p style={{ margin: 0 }}>「{baseline.note}」</p>}
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() => startNew(() => navigate({ name: 'startCompare' }))}
                >
                  この一杯と比べて淹れる
                </button>
              </div>
            ) : baselineCandidate ? (
              <div className="card stack">
                <p style={{ margin: 0 }}>
                  {formatDate(baselineCandidate.brewedAt)} の一杯があります。基準にすると、次の一杯から比較できます。
                </p>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => navigate({ name: 'brewDetail', brewId: baselineCandidate.id })}
                >
                  一杯を確認して基準にする
                </button>
              </div>
            ) : (
              <div className="card stack">
                <p style={{ margin: 0 }}>
                  この豆ではまだ一杯も淹れていません。最初の一杯が、比較の基準になります。
                </p>
                <button type="button" className="btn btn--primary" disabled={busy} onClick={beginFirstBrew}>
                  最初の一杯を作る
                </button>
              </div>
            )}

            <p className="text-sub" style={{ marginTop: 16 }}>
              1回にひとつの条件だけ変えると、違いの原因がわかりやすくなります。
            </p>
          </>
        )
      )}

      {confirmDiscard && (
        <Dialog title="途中の一杯を破棄しますか？" onClose={() => setConfirmDiscard(null)}>
          <p>進行中の一杯があります。新しく始めると、途中の内容は破棄されます。</p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmDiscard(null)}>
              戻る
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                const action = confirmDiscard;
                setConfirmDiscard(null);
                void store.discardDraft().then(() => action());
              }}
            >
              破棄して始める
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
