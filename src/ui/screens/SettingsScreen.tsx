/** 設定：アカウント・グループ管理・バックアップ／復元・全削除・保存先の説明 */
import { useRef, useState } from 'react';
import { useStore } from '../../application/store';
import { useAuth } from '../../application/auth';
import { googleLoginEnabled } from '../../infrastructure/supabase';
import type { Navigate } from '../routes';
import type { RestorePreview } from '../../infrastructure/backup';
import { formatDateTime } from '../../domain/format';
import { Dialog, TextField } from '../components';

/** アカウントセクション：ゲスト⇄ログインの切替 */
function AccountSection() {
  const auth = useAuth();
  const store = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!auth.enabled) {
    return (
      <p className="notice">
        アカウント機能はこの環境ではまだ有効になっていません（サーバー設定が未構成です）。現在は端末内保存で利用できます。
      </p>
    );
  }

  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    fn()
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  if (auth.session) {
    return (
      <div className="card stack">
        <p style={{ margin: 0 }}>
          <strong>{auth.email}</strong> でログイン中
        </p>
        <p className="text-sub" style={{ margin: 0 }}>
          記録はアカウントに保存され、ログインすればどの端末からでも見られます。
        </p>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <button
          type="button"
          className="btn btn--secondary"
          disabled={busy}
          onClick={() => run(() => auth.signOut())}
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div className="card stack">
      <p className="text-sub" style={{ margin: 0 }}>
        ログインすると記録がアカウントに保存され、複数の端末から使えるようになります。ログインしなくても、この端末内でずっと使えます。
      </p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {info && <div className="notice" role="status">{info}</div>}
      <TextField label="メールアドレス" value={email} onChange={setEmail} placeholder="you@example.com" />
      <label className="field">
        <span className="field__label">パスワード</span>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="field__hint">6文字以上</p>
      </label>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || !email || !password}
          onClick={() => run(() => auth.signInWithPassword(email.trim(), password))}
        >
          ログイン
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          disabled={busy || !email || !password}
          onClick={() =>
            run(async () => {
              const result = await auth.signUpWithPassword(email.trim(), password);
              if (result === 'confirm-email') {
                setInfo('確認メールを送りました。届いたメールのリンクを開くと登録が完了します。');
              }
            })
          }
        >
          新規登録
        </button>
      </div>
      {googleLoginEnabled && (
        <button
          type="button"
          className="btn btn--secondary"
          disabled={busy}
          onClick={() => run(() => auth.signInWithGoogle())}
        >
          Googleでログイン
        </button>
      )}
      {store.groups.length > 0 && (
        <p className="text-sub" style={{ margin: 0 }}>
          この端末のデータは消えません。ログイン後に、アカウントへコピーするか選べます。
        </p>
      )}
    </div>
  );
}

export function SettingsScreen({ navigate }: { navigate: Navigate }) {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = [...store.groups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const onFile = async (file: File) => {
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      setRestorePreview(store.previewRestore(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div>
      <h1 className="screen-title">設定</h1>

      {error && <div className="error-banner" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
      {message && (
        <div className="notice" role="status" style={{ marginBottom: 16 }}>
          {message}
        </div>
      )}

      <h2 className="section-heading">アカウント</h2>
      <AccountSection />

      <h2 className="section-heading">豆と器具</h2>
      <div className="stack">
        {groups.length === 0 && <p className="text-sub">まだ登録がありません。</p>}
        {groups.map((g) => {
          const bean = store.beanBatches.find((b) => b.id === g.beanBatchId);
          const archived = g.archivedAt !== null;
          return (
            <div key={g.id} className={`card ${archived ? 'card--sub' : ''}`}>
              <p style={{ margin: 0 }}>
                <strong>{bean?.name ?? '豆'}</strong> × {g.brewerName}
                {g.grinderName && <span className="text-sub">（{g.grinderName}）</span>}
                {archived && (
                  <span className="badge badge--muted" style={{ marginLeft: 8 }}>
                    アーカイブ済み
                  </span>
                )}
              </p>
              <div className="btn-row" style={{ marginTop: 8 }}>
                {!archived && (
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => navigate({ name: 'groupForm', groupId: g.id })}
                  >
                    編集
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() =>
                    void store
                      .setGroupArchived(g.id, !archived)
                      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                  }
                >
                  {archived ? 'アーカイブを解除' : 'アーカイブ'}
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => navigate({ name: 'groupForm', groupId: null })}
        >
          新しい豆・器具を登録する
        </button>
        <p className="text-sub" style={{ margin: 0 }}>
          グループは削除ではなくアーカイブで履歴を保ちます。記録の削除は「すべてのデータを削除」だけです。
        </p>
      </div>

      <h2 className="section-heading">データ</h2>
      <div className="stack">
        <div className="notice">
          {store.isCloud
            ? '記録はあなたのアカウント（クラウド）に保存されています。バックアップの書き出しはいつでもできます。'
            : 'データはこの端末・このブラウザの中（IndexedDB）に保存されます。他の端末へ自動同期されません。ブラウザのサイトデータ削除で消えることがあるため、ときどきバックアップの保存をおすすめします。'}
          {store.settings.lastBackupAt && (
            <>
              <br />
              最終バックアップ：{formatDateTime(store.settings.lastBackupAt)}
            </>
          )}
        </div>
        <button
          type="button"
          className="btn btn--secondary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            store
              .exportBackup()
              .then(() => setMessage('バックアップファイルを書き出しました。'))
              .catch((e) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
        >
          バックアップを書き出す（JSON）
        </button>
        <label className="btn btn--secondary" style={{ cursor: 'pointer' }}>
          バックアップから復元する
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>
        <button type="button" className="btn btn--danger-text" onClick={() => setConfirmDelete(true)}>
          すべてのデータを削除する
        </button>
      </div>

      <h2 className="section-heading">このアプリについて</h2>
      <p className="text-sub">
        Coffee Compare は、2杯の条件差と好みを比較して、次回の基準を選ぶためのツールです。味の記録は端末の外へ送信されません。比較の結果はあなた自身の感想であり、科学的な優劣を示すものではありません。
      </p>

      {restorePreview && (
        <Dialog title="バックアップから復元しますか？" onClose={() => setRestorePreview(null)}>
          <p>
            このファイルには グループ{restorePreview.counts.groups}件・一杯{restorePreview.counts.brews}
            件・比較{restorePreview.counts.comparisons}件 が含まれています。
          </p>
          <p>
            <strong>現在のデータはすべて置き換えられます。</strong>
            必要なら先に現在のデータのバックアップを書き出してください。
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => setRestorePreview(null)}>
              やめる
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                store
                  .applyRestore(restorePreview)
                  .then(() => {
                    setRestorePreview(null);
                    setMessage('復元しました。');
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                  .finally(() => setBusy(false));
              }}
            >
              置き換えて復元する
            </button>
          </div>
        </Dialog>
      )}

      {confirmDelete && (
        <Dialog title="すべてのデータを削除しますか？" onClose={() => setConfirmDelete(false)}>
          <p>
            すべての豆・一杯・比較・基準の履歴が削除されます。この操作は取り消せません。先にバックアップの書き出しをおすすめします。
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => setConfirmDelete(false)}>
              やめる
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: 'var(--color-danger)', color: '#fff' }}
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                store
                  .deleteAllData()
                  .then(() => {
                    setConfirmDelete(false);
                    setMessage('すべてのデータを削除しました。');
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                  .finally(() => setBusy(false));
              }}
            >
              削除する
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
