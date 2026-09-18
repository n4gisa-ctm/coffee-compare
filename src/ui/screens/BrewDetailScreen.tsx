/**
 * 一杯の詳細。基準にする（確認付き）／訂正版の作成ができる。
 * 訂正は上書きではなく新しいレコード。既存の比較は当時の値を維持する。
 */
import { useState } from 'react';
import { useStore } from '../../application/store';
import type { Navigate } from '../routes';
import type { Id, ParamKey } from '../../domain/types';
import { formatDateTime, PARAM_LABELS, formatParamValue } from '../../domain/format';
import { validateParams, hasErrors } from '../../domain/validate';
import { ParamsEditor } from '../ParamsEditor';
import { Dialog, TextAreaField } from '../components';
import { PARAM_KEYS } from '../../domain/types';

export function BrewDetailScreen({ brewId, navigate }: { brewId: Id; navigate: Navigate }) {
  const store = useStore();
  const brew = store.brews.find((b) => b.id === brewId);
  const [confirmBaseline, setConfirmBaseline] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [params, setParams] = useState(brew ? { ...brew.params } : null);
  const [note, setNote] = useState(brew?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!brew || !params) {
    return (
      <div>
        <div className="top-nav">
          <button type="button" className="btn btn--text" onClick={() => navigate({ name: 'history' })}>
            ← 戻る
          </button>
        </div>
        <p>一杯が見つかりませんでした。</p>
      </div>
    );
  }

  const group = store.groups.find((g) => g.id === brew.groupId);
  const isBaseline = group?.baselineBrewId === brew.id;
  const revision = store.brews.find((x) => x.revisionOf === brew.id) ?? null;
  const original = brew.revisionOf ? store.brews.find((x) => x.id === brew.revisionOf) ?? null : null;
  const issues = params ? validateParams(params) : [];

  const saveCorrection = async () => {
    setBusy(true);
    setError(null);
    try {
      const newId = await store.correctBrew(brew.id, params, note || null);
      setCorrecting(false);
      navigate({ name: 'brewDetail', brewId: newId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="top-nav">
        <button type="button" className="btn btn--text" onClick={() => navigate({ name: 'history' })}>
          ← くらべるへ
        </button>
      </div>
      <h1 className="screen-title">一杯の詳細</h1>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="card stack">
        <p style={{ margin: 0 }}>
          {formatDateTime(brew.brewedAt)}
          {isBaseline && (
            <span className="badge badge--baseline" style={{ marginLeft: 8 }}>
              現在の基準
            </span>
          )}
          {brew.revisionOf && (
            <span className="badge badge--muted" style={{ marginLeft: 8 }}>
              訂正版
            </span>
          )}
        </p>

        {revision && (
          <p className="notice" style={{ margin: 0 }}>
            この一杯には訂正版があります。
            <button
              type="button"
              className="btn btn--text"
              onClick={() => navigate({ name: 'brewDetail', brewId: revision.id })}
            >
              最新版を見る
            </button>
          </p>
        )}
        {original && (
          <p className="notice" style={{ margin: 0 }}>
            訂正前の一杯も履歴に残っています。
            <button
              type="button"
              className="btn btn--text"
              onClick={() => navigate({ name: 'brewDetail', brewId: original.id })}
            >
              訂正前を見る
            </button>
          </p>
        )}

        {!correcting ? (
          <>
            <dl className="baseline-summary">
              {PARAM_KEYS.map((k: ParamKey) => (
                <div key={k}>
                  <dt>{PARAM_LABELS[k]}</dt>
                  <dd>{formatParamValue(k, brew.params[k])}</dd>
                </div>
              ))}
            </dl>
            {brew.note && <p style={{ margin: 0 }}>「{brew.note}」</p>}

            {!isBaseline && !revision && (
              <button type="button" className="btn btn--secondary" onClick={() => setConfirmBaseline(true)}>
                この一杯を基準にする
              </button>
            )}
            {!revision && (
              <button type="button" className="btn btn--text" onClick={() => setCorrecting(true)}>
                誤入力を訂正する
              </button>
            )}
          </>
        ) : (
          <>
            <p className="notice" style={{ margin: 0 }}>
              訂正は上書きではなく、訂正版として新しく保存されます。過去の比較は当時の値のまま残ります。
            </p>
            <ParamsEditor value={params} onChange={setParams} issues={issues} />
            <TextAreaField label="味のひとこと" optional value={note} onChange={setNote} />
            <div className="btn-row">
              <button type="button" className="btn btn--secondary" onClick={() => setCorrecting(false)}>
                やめる
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={hasErrors(issues) || busy}
                onClick={() => void saveCorrection()}
              >
                訂正版を保存する
              </button>
            </div>
          </>
        )}
      </div>

      {confirmBaseline && group && (
        <Dialog title="この一杯を基準にしますか？" onClose={() => setConfirmBaseline(false)}>
          <p>
            次の比較から、この一杯（{formatDateTime(brew.brewedAt)}）が基準になります。過去の比較は変わりません。
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmBaseline(false)}>
              やめる
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                store
                  .setBaseline(group.id, brew.id)
                  .then(() => setConfirmBaseline(false))
                  .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                  .finally(() => setBusy(false));
              }}
            >
              基準にする
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
