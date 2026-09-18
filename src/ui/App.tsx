import { useState } from 'react';
import { useStore } from '../application/store';
import type { Route } from './routes';
import { HomeScreen } from './screens/HomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StartCompareScreen } from './screens/StartCompareScreen';
import { FlowScreen } from './screens/FlowScreen';
import { EvaluationScreen } from './screens/EvaluationScreen';
import { BrewDetailScreen } from './screens/BrewDetailScreen';
import { PastCompareScreen } from './screens/PastCompareScreen';
import { GroupFormScreen } from './screens/GroupFormScreen';
import { Dialog } from './components';

const TABS = [
  { route: 'home', label: '淹れる', icon: '☕' },
  { route: 'history', label: 'くらべる', icon: '⇄' },
  { route: 'settings', label: '設定', icon: '⚙' },
] as const;

export function App() {
  const store = useStore();
  const [route, setRoute] = useState<Route>({ name: 'home' });

  if (!store.loaded) {
    return (
      <div className="app">
        <main className="app__main">
          <p className="text-sub">読み込んでいます…</p>
        </main>
      </div>
    );
  }

  if (store.loadError) {
    return (
      <div className="app">
        <main className="app__main">
          <div className="error-banner" role="alert">
            データを読み込めませんでした：{store.loadError}
          </div>
          <button type="button" className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => void store.reload()}>
            再読み込み
          </button>
        </main>
      </div>
    );
  }

  const screen = (() => {
    switch (route.name) {
      case 'home':
        return <HomeScreen navigate={setRoute} />;
      case 'history':
        return <HistoryScreen navigate={setRoute} />;
      case 'settings':
        return <SettingsScreen navigate={setRoute} />;
      case 'startCompare':
        return <StartCompareScreen navigate={setRoute} />;
      case 'flow':
        return <FlowScreen navigate={setRoute} />;
      case 'evaluate':
        return <EvaluationScreen comparisonId={route.comparisonId} navigate={setRoute} />;
      case 'brewDetail':
        return <BrewDetailScreen key={route.brewId} brewId={route.brewId} navigate={setRoute} />;
      case 'pastCompare':
        return <PastCompareScreen baseId={route.baseId} trialId={route.trialId} navigate={setRoute} />;
      case 'groupForm':
        return <GroupFormScreen key={route.groupId ?? 'new'} groupId={route.groupId} navigate={setRoute} />;
    }
  })();

  const activeTab = route.name === 'history' || route.name === 'pastCompare'
    ? 'history'
    : route.name === 'settings'
      ? 'settings'
      : 'home';

  return (
    <div className="app">
      <main className="app__main">{screen}</main>
      <nav className="tabbar" aria-label="メインナビゲーション">
        <div className="tabbar__inner">
          {TABS.map((t) => (
            <button
              key={t.route}
              type="button"
              className="tabbar__item"
              aria-current={activeTab === t.route ? 'page' : undefined}
              onClick={() => setRoute({ name: t.route } as Route)}
            >
              <span className="tabbar__icon" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 初回の保存先説明（要件 §8） */}
      {!store.settings.storageNoticeAcknowledged && !store.migrationCandidate && (
        <Dialog title="データの保存先について" onClose={() => void store.acknowledgeStorageNotice()}>
          {store.isCloud ? (
            <p>記録はあなたのアカウントに保存され、ログインすればどの端末からでも見られます。</p>
          ) : (
            <p>
              記録はこの端末・このブラウザの中に保存されます。他の端末へ自動同期されません。ブラウザのサイトデータ削除で消えることがあるため、大切な記録は「設定」からバックアップを書き出せます。
            </p>
          )}
          <button type="button" className="btn btn--primary" onClick={() => void store.acknowledgeStorageNotice()}>
            わかりました
          </button>
        </Dialog>
      )}

      {/* ログイン直後：端末内のゲストデータの移行提案 */}
      {store.migrationCandidate && (
        <Dialog title="この端末のデータをアカウントへコピーしますか？" onClose={() => store.dismissMigration()}>
          <p>
            ログイン前にこの端末で記録したデータ（グループ{store.migrationCandidate.groups}件・一杯
            {store.migrationCandidate.brews}件・比較{store.migrationCandidate.comparisons}件）が見つかりました。
            アカウントへコピーすると、他の端末からも見られるようになります。
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={() => store.dismissMigration()}>
              今はしない
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void store.migrateLocalToCloud().catch(() => undefined)}
            >
              コピーする
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
