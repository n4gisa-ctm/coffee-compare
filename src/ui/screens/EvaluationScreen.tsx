/**
 * 比較画面（中核）：基準 vs 今回。
 * - 相対評価は「基準が好き／今回が好き／違いが分からない」。未選択保存＝未評価。
 * - 「今回が好き」でも基準は自動更新しない。明示操作でのみ更新する。
 */
import { useState } from 'react';
import { useStore } from '../../application/store';
import type { Navigate } from '../routes';
import type { Id, Preference, RelativeLevel, RelativeTaste, ComparisonMode } from '../../domain/types';
import { formatDate } from '../../domain/format';
import { PREFERENCE_LABELS, RELATIVE_LABELS } from '../../domain/format';
import { CompareTable } from '../CompareTable';
import { Dialog, Segmented } from '../components';

const PREF_OPTIONS: { value: Preference; label: string }[] = [
  { value: 'baseline', label: '基準が好き' },
  { value: 'trial', label: '今回が好き' },
  { value: 'unsure', label: '違いが分からない' },
];

const LEVEL_OPTIONS: { value: RelativeLevel; label: string }[] = (
  ['weaker', 'same', 'stronger', 'unsure'] as RelativeLevel[]
).map((v) => ({ value: v, label: RELATIVE_LABELS[v] }));

export function EvaluationScreen({
  comparisonId,
  navigate,
}: {
  comparisonId: Id;
  navigate: Navigate;
}) {
  const store = useStore();
  const comparison = store.comparisons.find((c) => c.id === comparisonId);
  const [pref, setPref] = useState<Preference | null>(comparison?.preference ?? null);
  const [taste, setTaste] = useState<RelativeTaste>(
    comparison?.relativeTaste ?? { acidity: null, bitterness: null, body: null },
  );
  const [mode, setMode] = useState<ComparisonMode>(comparison?.comparisonMode ?? 'remembered');
  const [showTaste, setShowTaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmBaseline, setConfirmBaseline] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  if (!comparison) {
    return (
      <div>
        <div className="top-nav">
          <button type="button" className="btn btn--text" onClick={() => navigate({ name: 'home' })}>
            ← ホームへ
          </button>
        </div>
        <p>比較が見つかりませんでした。</p>
      </div>
    );
  }

  const baseline = store.brews.find((b) => b.id === comparison.baselineBrewId);
  const trial = store.brews.find((b) => b.id === comparison.trialBrewId);
  const group = store.groups.find((g) => g.id === comparison.groupId);
  if (!baseline || !trial || !group) {
    return <p>データが見つかりませんでした。</p>;
  }

  const evaluated = comparison.preference !== null;
  const isCurrentBaseline = group.baselineBrewId === trial.id;

  const saveEvaluation = async (p: Preference | null) => {
    setBusy(true);
    setError(null);
    try {
      await store.evaluateComparison(comparison.id, p, taste, mode);
      if (p !== null) setSavedFeedback(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setTasteKey = (key: keyof RelativeTaste, v: RelativeLevel) =>
    setTaste((t) => ({ ...t, [key]: v }));

  return (
    <div>
      <div className="top-nav" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--text" onClick={() => navigate({ name: 'home' })}>
          ← ホームへ
        </button>
        {!evaluated && (
          <button
            type="button"
            className="btn btn--text"
            onClick={() => navigate({ name: 'home' })}
          >
            あとで比べる
          </button>
        )}
      </div>

      <h1 className="screen-title">基準と今回をくらべる</h1>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <CompareTable
          baseLabel={`基準（${formatDate(baseline.brewedAt)}）`}
          trialLabel={`今回（${formatDate(trial.brewedAt)}）`}
          baseParams={baseline.params}
          trialParams={trial.params}
          plannedChanges={comparison.plannedChanges}
        />
      </div>

      {(baseline.note || trial.note) && (
        <div className="card card--sub" style={{ marginBottom: 16 }}>
          <p className="text-sub" style={{ margin: '0 0 4px' }}>感想</p>
          {baseline.note && (
            <p style={{ margin: 0 }}>
              基準：「{baseline.note}」
            </p>
          )}
          {trial.note && (
            <p style={{ margin: 0 }}>
              今回:「{trial.note}」
            </p>
          )}
        </div>
      )}

      {evaluated ? (
        <div className="card stack">
          <p style={{ margin: 0 }}>
            あなたの評価：<strong>{PREFERENCE_LABELS[comparison.preference!]}</strong>
          </p>
          {(['acidity', 'bitterness', 'body'] as const).map((k) => {
            const v = comparison.relativeTaste[k];
            if (!v) return null;
            const label = { acidity: '酸味', bitterness: '苦味', body: '濃さ' }[k];
            return (
              <p key={k} className="text-sub" style={{ margin: 0 }}>
                {label}：基準より{RELATIVE_LABELS[v]}（あなたの感想）
              </p>
            );
          })}
          {!isCurrentBaseline && (
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmBaseline(true)}>
              今回の一杯を次回の基準にする
            </button>
          )}
          {isCurrentBaseline && (
            <p style={{ margin: 0 }}>
              <span className="badge badge--baseline">現在の基準</span> この一杯が次回の基準です
            </p>
          )}
        </div>
      ) : (
        <div className="card stack">
          <p style={{ margin: 0, fontWeight: 600 }}>どちらが好きでしたか？</p>
          <div className="stack" role="group" aria-label="相対評価">
            {PREF_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className="chip"
                style={{ width: '100%' }}
                aria-pressed={pref === o.value}
                onClick={() => setPref(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>

          {!showTaste ? (
            <button type="button" className="btn btn--text" onClick={() => setShowTaste(true)}>
              くわしい感想も残す（任意）
            </button>
          ) : (
            <div className="stack">
              <p className="text-sub" style={{ margin: 0 }}>
                基準と比べてどうでしたか（あなたの感想です。点数ではありません）
              </p>
              <Segmented label="酸味" options={LEVEL_OPTIONS} value={taste.acidity} onChange={(v) => setTasteKey('acidity', v)} />
              <Segmented label="苦味" options={LEVEL_OPTIONS} value={taste.bitterness} onChange={(v) => setTasteKey('bitterness', v)} />
              <Segmented label="濃さ" options={LEVEL_OPTIONS} value={taste.body} onChange={(v) => setTasteKey('body', v)} />
              <Segmented
                label="比べ方"
                options={[
                  { value: 'remembered', label: '記憶と比較' },
                  { value: 'sideBySide', label: '同時に飲み比べ' },
                ]}
                value={mode}
                onChange={setMode}
              />
            </div>
          )}

          <button
            type="button"
            className="btn btn--primary"
            disabled={pref === null || busy}
            onClick={() => void saveEvaluation(pref)}
          >
            評価を保存する
          </button>
          <p className="text-sub" style={{ margin: 0 }}>
            まだ決められないときは「あとで比べる」で保存できます。
          </p>
        </div>
      )}

      {confirmBaseline && (
        <Dialog title="次回の基準にしますか？" onClose={() => setConfirmBaseline(false)}>
          <p>
            今回の一杯（{formatDate(trial.brewedAt)}）が新しい基準になります。これまでの基準（
            {formatDate(baseline.brewedAt)}）や過去の比較は履歴に残ります。
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
                  .setBaseline(group.id, trial.id)
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

      {savedFeedback && (
        <Dialog title="評価を保存しました" onClose={() => setSavedFeedback(false)}>
          <p>
            {pref === 'trial' && !isCurrentBaseline
              ? '今回が好きだったようです。次回の基準にしますか？（基準は自動では変わりません）'
              : '比較の履歴は「くらべる」からいつでも見返せます。'}
          </p>
          <div className="btn-row">
            {pref === 'trial' && !isCurrentBaseline && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setSavedFeedback(false);
                  setConfirmBaseline(true);
                }}
              >
                基準にする
              </button>
            )}
            <button type="button" className="btn btn--primary" onClick={() => setSavedFeedback(false)}>
              閉じる
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
