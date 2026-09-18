/** 変更点の選択：1条件変更を勧めるが、複数変更・変更なしも許可する */
import { useState } from 'react';
import { useStore } from '../../application/store';
import type { Navigate } from '../routes';
import type { ParamKey } from '../../domain/types';

const CHANGE_OPTIONS: { key: ParamKey; label: string }[] = [
  { key: 'grind', label: '挽き目' },
  { key: 'tempC', label: '湯温' },
  { key: 'doseG', label: '豆量' },
  { key: 'waterMl', label: '湯量' },
  { key: 'totalTimeSec', label: '目標抽出時間' },
  { key: 'bloomTimeSec', label: '蒸らし時間' },
  { key: 'pourNote', label: '注ぎ方' },
];

export function StartCompareScreen({ navigate }: { navigate: Navigate }) {
  const store = useStore();
  const [selected, setSelected] = useState<ParamKey[]>([]);
  const [same, setSame] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const group = store.activeGroup;

  if (!group) {
    navigate({ name: 'home' });
    return null;
  }

  const toggle = (key: ParamKey) => {
    setSame(false);
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const canStart = same || selected.length > 0;

  const start = () => {
    setBusy(true);
    setError(null);
    store
      .startComparison(group.id, same ? [] : selected)
      .then(() => navigate({ name: 'flow' }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <div className="top-nav">
        <button type="button" className="btn btn--text" onClick={() => navigate({ name: 'home' })}>
          ← 戻る
        </button>
      </div>
      <h1 className="screen-title">今回は、どこを変えますか？</h1>
      <p className="text-sub" style={{ marginTop: -8 }}>
        ひとつだけ変えると、違いの原因がわかりやすくなります（複数選択もできます）。
      </p>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="chips" style={{ margin: '16px 0' }}>
        {CHANGE_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            className="chip"
            aria-pressed={!same && selected.includes(o.key)}
            onClick={() => toggle(o.key)}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          aria-pressed={same}
          onClick={() => {
            setSame((v) => !v);
            setSelected([]);
          }}
        >
          同じ条件でもう一度
        </button>
      </div>

      {!same && selected.length > 1 && (
        <p className="notice" style={{ marginBottom: 16 }}>
          複数の条件を変えると、どの変更が味に効いたのか判断しづらくなります。
        </p>
      )}

      <button type="button" className="btn btn--primary" disabled={!canStart || busy} onClick={start}>
        条件の入力へ進む
      </button>
      {!canStart && (
        <p className="text-sub" style={{ marginTop: 8 }}>
          変更する項目、または「同じ条件でもう一度」を選ぶと進めます。
        </p>
      )}
    </div>
  );
}
