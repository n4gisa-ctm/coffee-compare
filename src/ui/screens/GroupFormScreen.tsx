/** 豆と器具の登録・編集。1グループ＝豆の袋＋器具＋ミル。 */
import { useState } from 'react';
import { useStore } from '../../application/store';
import type { Navigate } from '../routes';
import type { Id, RoastLevel } from '../../domain/types';
import { ROAST_LABELS } from '../../domain/format';
import { TextField, DateField } from '../components';

const ROAST_OPTIONS = Object.entries(ROAST_LABELS) as [RoastLevel, string][];

export function GroupFormScreen({ groupId, navigate }: { groupId: Id | null; navigate: Navigate }) {
  const store = useStore();
  const group = groupId ? store.groups.find((g) => g.id === groupId) ?? null : null;
  const bean = group ? store.beanBatches.find((b) => b.id === group.beanBatchId) ?? null : null;

  const [beanName, setBeanName] = useState(bean?.name ?? '');
  const [roastLevel, setRoastLevel] = useState<RoastLevel | null>(bean?.roastLevel ?? null);
  const [purchasedAt, setPurchasedAt] = useState<string | null>(bean?.purchasedAt ?? null);
  const [roastedAt, setRoastedAt] = useState<string | null>(bean?.roastedAt ?? null);
  const [brewerName, setBrewerName] = useState(group?.brewerName ?? '');
  const [grinderName, setGrinderName] = useState(group?.grinderName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const beanError = touched && beanName.trim() === '' ? '豆の呼び名を入力してください' : undefined;
  const brewerError = touched && brewerName.trim() === '' ? '器具の呼び名を入力してください' : undefined;
  const valid = beanName.trim() !== '' && brewerName.trim() !== '';

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      if (group && bean) {
        await store.updateGroup(
          { ...group, brewerName: brewerName.trim(), grinderName: grinderName.trim() || null },
          { ...bean, name: beanName.trim(), roastLevel, purchasedAt, roastedAt },
        );
        navigate({ name: 'settings' });
      } else {
        await store.createGroup({
          beanName,
          roastLevel,
          purchasedAt,
          roastedAt,
          brewerName,
          grinderName: grinderName || null,
        });
        navigate({ name: 'home' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="top-nav">
        <button
          type="button"
          className="btn btn--text"
          onClick={() => navigate(group ? { name: 'settings' } : { name: 'home' })}
        >
          ← 戻る
        </button>
      </div>
      <h1 className="screen-title">{group ? '豆と器具を編集' : '豆と器具を登録'}</h1>
      <p className="text-sub" style={{ marginTop: -8 }}>
        同じ豆（袋）・同じ器具・同じミルの組合せが、比較のひとつの単位になります。豆を買い直したときや器具を変えるときは、新しく登録してください。
      </p>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="stack" style={{ marginTop: 16 }}>
        <TextField label="豆の呼び名" value={beanName} onChange={setBeanName} placeholder="例：エチオピア イルガチェフェ（9月の袋）" error={beanError} />
        <label className="field">
          <span className="field__label">
            焙煎度 <span className="field__optional">（任意）</span>
          </span>
          <select
            value={roastLevel ?? ''}
            onChange={(e) => setRoastLevel((e.target.value || null) as RoastLevel | null)}
          >
            <option value="">選択しない</option>
            {ROAST_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <DateField label="購入日" optional value={purchasedAt} onChange={setPurchasedAt} />
        <DateField label="焙煎日" optional value={roastedAt} onChange={setRoastedAt} />
        <TextField label="器具の呼び名" value={brewerName} onChange={setBrewerName} placeholder="例：V60 02 プラスチック" error={brewerError} />
        <TextField label="ミル" optional value={grinderName} onChange={setGrinderName} placeholder="例：コマンダンテ C40" />
      </div>

      <div style={{ marginTop: 24 }}>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          {group ? '保存する' : '登録する'}
        </button>
      </div>
    </div>
  );
}
