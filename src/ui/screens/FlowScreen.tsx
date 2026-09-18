/**
 * 比較フロー：条件の準備（plan）→ 抽出中（brewing）→ 実際の条件確認（actual）→ 保存。
 * 下書きは全体で1件。各段階の移動時に保存し、戻る・再読み込みで復元できる。
 */
import { useState } from 'react';
import { useStore } from '../../application/store';
import type { Navigate } from '../routes';
import type { BrewParameters, ParamKey } from '../../domain/types';
import { validateParams, hasErrors } from '../../domain/validate';
import { diffParams } from '../../domain/diff';
import { PARAM_LABELS, formatParamValue, formatDelta } from '../../domain/format';
import { ParamsEditor } from '../ParamsEditor';
import { CompareTable } from '../CompareTable';
import { Dialog, TextAreaField } from '../components';

export function FlowScreen({ navigate }: { navigate: Navigate }) {
  const store = useStore();
  const draft = store.draft;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (!draft) {
    // 下書きがない（保存済み・破棄済み）ときはホームへ
    navigate({ name: 'home' });
    return null;
  }

  const isFirst = draft.baselineBrewId === null;
  const params = draft.stage === 'actual' ? draft.actualParams ?? draft.plannedParams : draft.plannedParams;
  const issues = validateParams(params);
  // 未入力（0）の必須項目は、エラー文ではなくボタン無効＋ヒントで案内する
  const displayIssues = issues.filter(
    (i) => !(i.level === 'error' && (i.field === 'doseG' || i.field === 'waterMl') && params[i.field] === 0),
  );

  const save = async (patch: Partial<typeof draft>) => {
    setError(null);
    try {
      await store.saveDraft({ ...draft, ...patch });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  const updateParams = (v: BrewParameters) => {
    // 段階に応じて予定値／実測値を更新（保存失敗時も入力は state に残る）
    if (draft.stage === 'actual') {
      void save({ actualParams: v }).catch(() => undefined);
    } else {
      void save({ plannedParams: v }).catch(() => undefined);
    }
  };

  const plannedDiffs = draft.baselineSnapshot
    ? diffParams(draft.baselineSnapshot, draft.plannedParams, draft.plannedChanges).filter(
        (r) => r.kind !== 'unchanged',
      )
    : [];

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isFirst) {
        const brewId = await store.completeFirstBrew(note || null);
        navigate({ name: 'brewDetail', brewId });
      } else {
        const comparisonId = await store.completeComparison(note || null);
        navigate({ name: 'evaluate', comparisonId });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="top-nav" style={{ justifyContent: 'space-between' }}>
        {draft.stage === 'plan' ? (
          <button
            type="button"
            className="btn btn--text"
            onClick={() => navigate(isFirst ? { name: 'home' } : { name: 'startCompare' })}
          >
            ← 戻る
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--text"
            onClick={() => void save({ stage: draft.stage === 'actual' ? 'brewing' : 'plan' })}
          >
            ← 前の段階へ
          </button>
        )}
        <button type="button" className="btn btn--danger-text" onClick={() => setConfirmDiscard(true)}>
          破棄
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          {error} — 入力は残っています。もう一度お試しください。
        </div>
      )}

      {/* ---------- plan ---------- */}
      {draft.stage === 'plan' && (
        <>
          <h1 className="screen-title">{isFirst ? '最初の一杯の条件' : '今回の条件を決める'}</h1>

          {!isFirst && plannedDiffs.length > 0 && (
            <div className="card card--sub" style={{ marginBottom: 16 }}>
              <p className="text-sub" style={{ margin: '0 0 4px' }}>
                基準からの変更
              </p>
              {plannedDiffs.map((r) => (
                <p key={r.key} style={{ margin: 0, fontWeight: 600 }}>
                  {PARAM_LABELS[r.key]}：{formatParamValue(r.key, r.baseValue)} →{' '}
                  {formatParamValue(r.key, r.trialValue)}
                  {r.delta !== null && (
                    <span className="compare-table__delta">（{formatDelta(r.key, r.delta)}）</span>
                  )}
                </p>
              ))}
            </div>
          )}
          {!isFirst && draft.plannedChanges.length === 0 && (
            <p className="notice" style={{ marginBottom: 16 }}>
              同じ条件でもう一度淹れます。基準の条件を引き継ぎました。
            </p>
          )}

          <ParamsEditor
            value={draft.plannedParams}
            onChange={updateParams}
            issues={displayIssues}
            highlightKeys={draft.plannedChanges}
            collapsible={!isFirst}
          />

          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={hasErrors(issues) || busy}
              onClick={() => void save({ stage: 'brewing' })}
            >
              この条件で淹れる
            </button>
            {hasErrors(issues) && (
              <p className="text-sub" style={{ marginTop: 8 }}>
                豆量と総注湯量を入力すると進めます。
              </p>
            )}
          </div>
        </>
      )}

      {/* ---------- brewing ---------- */}
      {draft.stage === 'brewing' && (
        <>
          <h1 className="screen-title">抽出中</h1>
          <p className="text-sub" style={{ marginTop: -8 }}>
            条件を見ながら、自分のペースで淹れてください。このアプリは時間を計りません。
          </p>
          <div className="card" style={{ margin: '16px 0' }}>
            {draft.baselineSnapshot ? (
              <CompareTable
                baseLabel="基準"
                trialLabel="今回（予定）"
                baseParams={draft.baselineSnapshot}
                trialParams={draft.plannedParams}
                plannedChanges={draft.plannedChanges}
              />
            ) : (
              <dl className="baseline-summary">
                {(Object.keys(PARAM_LABELS) as ParamKey[]).map((k) => (
                  <div key={k}>
                    <dt>{PARAM_LABELS[k]}</dt>
                    <dd>{formatParamValue(k, draft.plannedParams[k])}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <button type="button" className="btn btn--primary" onClick={() => void save({ stage: 'actual', actualParams: draft.actualParams ?? { ...draft.plannedParams } })}>
            淹れ終わった
          </button>
        </>
      )}

      {/* ---------- actual ---------- */}
      {draft.stage === 'actual' && (
        <>
          <h1 className="screen-title">実際の条件を確認</h1>
          <p className="text-sub" style={{ marginTop: -8 }}>
            予定と実際が変わった項目があれば直してください。計れなかった項目は「不明・未計測」のままで保存できます。
          </p>
          <div style={{ marginTop: 16 }}>
            <ParamsEditor value={draft.actualParams ?? draft.plannedParams} onChange={updateParams} issues={displayIssues} />
          </div>
          <div style={{ marginTop: 16 }}>
            <TextAreaField
              label="味のひとこと"
              optional
              value={note}
              onChange={setNote}
              placeholder="例：酸味が立って華やか"
            />
          </div>
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn--primary"
              disabled={hasErrors(issues) || busy}
              onClick={() => void finish()}
            >
              {busy ? '保存中…' : isFirst ? '一杯を保存する' : '保存して比較する'}
            </button>
          </div>
        </>
      )}

      {confirmDiscard && (
        <Dialog title="この一杯を破棄しますか？" onClose={() => setConfirmDiscard(false)}>
          <p>入力した内容は保存されません。</p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmDiscard(false)}>
              続ける
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void store.discardDraft().then(() => navigate({ name: 'home' }))}
            >
              破棄する
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
