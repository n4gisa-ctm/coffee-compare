/**
 * アプリケーション層：ユースケースと状態管理。
 * 保存成功後のみ状態を更新する（失敗時は入力を保持し再試行可能）。
 * 保存先はログイン状態で切替わる：ゲスト＝端末内（IndexedDB）／ログイン中＝クラウド（Supabase）。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  BeanBatch,
  BrewGroup,
  Brew,
  BrewParameters,
  Comparison,
  Draft,
  Id,
  ParamKey,
  Preference,
  RelativeTaste,
  ComparisonMode,
  RoastLevel,
  Settings,
} from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';
import type { AllData, Repository, WriteOp } from './repository';
import { settingsPutOp } from './repository';
import { localRepository, newId } from '../infrastructure/db';
import { supabase } from '../infrastructure/supabase';
import { createSupabaseRepository } from '../infrastructure/supabaseRepo';
import {
  buildBackup,
  downloadBackup,
  validateBackup,
  restoreBackup,
  backupPutOps,
} from '../infrastructure/backup';
import type { RestorePreview } from '../infrastructure/backup';
import { useAuth } from './auth';

/** 進行中の比較は全体で1件（固定ID） */
const DRAFT_ID = 'current-draft';

export interface CreateGroupInput {
  beanName: string;
  roastLevel: RoastLevel | null;
  purchasedAt: string | null;
  roastedAt: string | null;
  brewerName: string;
  grinderName: string | null;
}

export interface MigrationCandidate {
  groups: number;
  brews: number;
  comparisons: number;
}

interface StoreState extends AllData {
  loaded: boolean;
  loadError: string | null;
}

interface StoreApi extends StoreState {
  draft: Draft | null;
  activeGroup: BrewGroup | null;
  /** true = クラウド（アカウント）保存、false = この端末に保存 */
  isCloud: boolean;
  /** ログイン直後、端末内にゲストデータが残っている場合の移行候補 */
  migrationCandidate: MigrationCandidate | null;
  migrateLocalToCloud: () => Promise<void>;
  dismissMigration: () => void;
  reload: () => Promise<void>;
  acknowledgeStorageNotice: () => Promise<void>;
  setActiveGroup: (id: Id) => Promise<void>;
  createGroup: (input: CreateGroupInput) => Promise<Id>;
  updateGroup: (group: BrewGroup, bean: BeanBatch) => Promise<void>;
  setGroupArchived: (groupId: Id, archived: boolean) => Promise<void>;
  startFirstBrew: (groupId: Id, params: BrewParameters) => Promise<void>;
  startComparison: (groupId: Id, plannedChanges: ParamKey[]) => Promise<void>;
  saveDraft: (draft: Draft) => Promise<void>;
  discardDraft: () => Promise<void>;
  completeFirstBrew: (note: string | null) => Promise<Id>;
  completeComparison: (note: string | null) => Promise<Id>;
  evaluateComparison: (
    comparisonId: Id,
    preference: Preference | null,
    relativeTaste: RelativeTaste,
    mode: ComparisonMode,
  ) => Promise<void>;
  setBaseline: (groupId: Id, brewId: Id) => Promise<void>;
  correctBrew: (originalId: Id, params: BrewParameters, note: string | null) => Promise<Id>;
  exportBackup: () => Promise<void>;
  previewRestore: (text: string) => RestorePreview;
  applyRestore: (preview: RestorePreview) => Promise<void>;
  deleteAllData: () => Promise<void>;
}

const StoreContext = createContext<StoreApi | null>(null);

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('StoreProvider の外で useStore が呼ばれました');
  return ctx;
}

const EMPTY_STATE: StoreState = {
  beanBatches: [],
  groups: [],
  brews: [],
  comparisons: [],
  drafts: [],
  baselineChanges: [],
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
  loadError: null,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.session?.user.id ?? null;

  // ログイン状態に応じて保存先リポジトリを切替える
  const repo: Repository = useMemo(
    () => (userId && supabase ? createSupabaseRepository(supabase) : localRepository),
    [userId],
  );
  const isCloud = userId !== null && supabase !== null;

  const [state, setState] = useState<StoreState>(EMPTY_STATE);
  const [migrationCandidate, setMigrationCandidate] = useState<MigrationCandidate | null>(null);
  // 保存連打防止：進行中の書き込みを直列化する
  const writeLock = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      const data = await repo.loadAll();
      setState({ ...data, loaded: true, loadError: null });
    } catch (e) {
      setState((s) => ({ ...s, loaded: true, loadError: e instanceof Error ? e.message : String(e) }));
    }
  }, [repo]);

  // 認証状態の初期化後、リポジトリが切替わるたびに読み直す
  useEffect(() => {
    if (!auth.ready) return;
    setState(EMPTY_STATE);
    void reload();
  }, [auth.ready, reload]);

  // ログイン直後：クラウドが空で、端末内にゲストデータが残っていれば移行を提案する
  useEffect(() => {
    if (!state.loaded || !isCloud || !userId) return;
    if (state.groups.length > 0 || state.brews.length > 0) return;
    if (localStorage.getItem(`cc-migration-dismissed-${userId}`)) return;
    let cancelled = false;
    void localRepository.loadAll().then((local) => {
      if (cancelled) return;
      if (local.groups.length > 0 || local.brews.length > 0) {
        setMigrationCandidate({
          groups: local.groups.length,
          brews: local.brews.length,
          comparisons: local.comparisons.length,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.loaded, state.groups.length, state.brews.length, isCloud, userId]);

  /** 書き込み→成功時のみ状態反映。直列化して競合と連打を防ぐ */
  const commit = useCallback(
    async (ops: WriteOp[], apply: (s: StoreState) => StoreState): Promise<void> => {
      const run = writeLock.current.then(async () => {
        await repo.commit(ops);
        setState((s) => apply(s));
      });
      writeLock.current = run.catch(() => undefined);
      return run;
    },
    [repo],
  );

  const saveSettings = useCallback(
    async (settings: Settings) => {
      await commit([settingsPutOp(settings)], (s) => ({ ...s, settings }));
    },
    [commit],
  );

  const api = useMemo<StoreApi>(() => {
    const draft = state.drafts.find((d) => d.id === DRAFT_ID) ?? null;
    const activeGroup =
      state.groups.find((g) => g.id === state.settings.activeGroupId && g.archivedAt === null) ??
      state.groups.find((g) => g.archivedAt === null) ??
      null;

    return {
      ...state,
      draft,
      activeGroup,
      isCloud,
      migrationCandidate,
      reload,

      async migrateLocalToCloud() {
        if (!isCloud) throw new Error('ログイン中のみ移行できます');
        const local = await localRepository.loadAll();
        const ops = backupPutOps(buildBackup(local));
        await repo.commit(ops);
        setMigrationCandidate(null);
        await reload();
      },

      dismissMigration() {
        if (userId) localStorage.setItem(`cc-migration-dismissed-${userId}`, '1');
        setMigrationCandidate(null);
      },

      async acknowledgeStorageNotice() {
        await saveSettings({ ...state.settings, storageNoticeAcknowledged: true });
      },

      async setActiveGroup(id) {
        await saveSettings({ ...state.settings, activeGroupId: id });
      },

      async createGroup(input) {
        const now = new Date().toISOString();
        const bean: BeanBatch = {
          id: newId(),
          name: input.beanName.trim(),
          roastLevel: input.roastLevel,
          purchasedAt: input.purchasedAt,
          roastedAt: input.roastedAt,
        };
        const group: BrewGroup = {
          id: newId(),
          beanBatchId: bean.id,
          brewerName: input.brewerName.trim(),
          grinderName: input.grinderName?.trim() || null,
          baselineBrewId: null,
          archivedAt: null,
          createdAt: now,
        };
        const settings = { ...state.settings, activeGroupId: group.id };
        await commit(
          [
            { store: 'beanBatches', type: 'put', value: bean },
            { store: 'groups', type: 'put', value: group },
            settingsPutOp(settings),
          ],
          (s) => ({
            ...s,
            beanBatches: [...s.beanBatches, bean],
            groups: [...s.groups, group],
            settings,
          }),
        );
        return group.id;
      },

      async updateGroup(group, bean) {
        await commit(
          [
            { store: 'groups', type: 'put', value: group },
            { store: 'beanBatches', type: 'put', value: bean },
          ],
          (s) => ({
            ...s,
            groups: s.groups.map((g) => (g.id === group.id ? group : g)),
            beanBatches: s.beanBatches.map((b) => (b.id === bean.id ? bean : b)),
          }),
        );
      },

      async setGroupArchived(groupId, archived) {
        const group = state.groups.find((g) => g.id === groupId);
        if (!group) throw new Error('グループが見つかりません');
        const updated: BrewGroup = {
          ...group,
          archivedAt: archived ? new Date().toISOString() : null,
        };
        await commit([{ store: 'groups', type: 'put', value: updated }], (s) => ({
          ...s,
          groups: s.groups.map((g) => (g.id === groupId ? updated : g)),
        }));
      },

      async startFirstBrew(groupId, params) {
        const d: Draft = {
          id: DRAFT_ID,
          groupId,
          baselineBrewId: null,
          baselineSnapshot: null,
          plannedChanges: [],
          plannedParams: params,
          actualParams: null,
          stage: 'plan',
          updatedAt: new Date().toISOString(),
        };
        await commit([{ store: 'drafts', type: 'put', value: d }], (s) => ({
          ...s,
          drafts: [d],
        }));
      },

      async startComparison(groupId, plannedChanges) {
        const group = state.groups.find((g) => g.id === groupId);
        if (!group?.baselineBrewId) throw new Error('このグループにはまだ基準の一杯がありません');
        const baseline = state.brews.find((b) => b.id === group.baselineBrewId);
        if (!baseline) throw new Error('基準の一杯が見つかりません');
        // 比較開始時に基準の条件をスナップショット固定する
        const d: Draft = {
          id: DRAFT_ID,
          groupId,
          baselineBrewId: baseline.id,
          baselineSnapshot: { ...baseline.params },
          plannedChanges,
          plannedParams: { ...baseline.params },
          actualParams: null,
          stage: 'plan',
          updatedAt: new Date().toISOString(),
        };
        await commit([{ store: 'drafts', type: 'put', value: d }], (s) => ({
          ...s,
          drafts: [d],
        }));
      },

      async saveDraft(d) {
        const updated = { ...d, updatedAt: new Date().toISOString() };
        await commit([{ store: 'drafts', type: 'put', value: updated }], (s) => ({
          ...s,
          drafts: [updated],
        }));
      },

      async discardDraft() {
        await commit([{ store: 'drafts', type: 'delete', key: DRAFT_ID }], (s) => ({
          ...s,
          drafts: [],
        }));
      },

      async completeFirstBrew(note) {
        const d = state.drafts.find((x) => x.id === DRAFT_ID);
        if (!d) throw new Error('進行中の一杯がありません');
        const brew: Brew = {
          id: newId(),
          groupId: d.groupId,
          brewedAt: new Date().toISOString(),
          params: d.actualParams ?? d.plannedParams,
          note: note?.trim() || null,
          revisionOf: null,
        };
        await commit(
          [
            { store: 'brews', type: 'put', value: brew },
            { store: 'drafts', type: 'delete', key: DRAFT_ID },
          ],
          (s) => ({ ...s, brews: [...s.brews, brew], drafts: [] }),
        );
        return brew.id;
      },

      async completeComparison(note) {
        const d = state.drafts.find((x) => x.id === DRAFT_ID);
        if (!d?.baselineBrewId) throw new Error('進行中の比較がありません');
        const now = new Date().toISOString();
        const brew: Brew = {
          id: newId(),
          groupId: d.groupId,
          brewedAt: now,
          params: d.actualParams ?? d.plannedParams,
          note: note?.trim() || null,
          revisionOf: null,
        };
        const comparison: Comparison = {
          id: newId(),
          groupId: d.groupId,
          baselineBrewId: d.baselineBrewId,
          trialBrewId: brew.id,
          plannedChanges: d.plannedChanges,
          preference: null,
          relativeTaste: { acidity: null, bitterness: null, body: null },
          comparisonMode: 'remembered',
          evaluatedAt: null,
          createdAt: now,
        };
        // Brew・Comparison・Draft削除を1トランザクションで（重複・参照切れ防止）
        await commit(
          [
            { store: 'brews', type: 'put', value: brew },
            { store: 'comparisons', type: 'put', value: comparison },
            { store: 'drafts', type: 'delete', key: DRAFT_ID },
          ],
          (s) => ({
            ...s,
            brews: [...s.brews, brew],
            comparisons: [...s.comparisons, comparison],
            drafts: [],
          }),
        );
        return comparison.id;
      },

      async evaluateComparison(comparisonId, preference, relativeTaste, mode) {
        const c = state.comparisons.find((x) => x.id === comparisonId);
        if (!c) throw new Error('比較が見つかりません');
        const updated: Comparison = {
          ...c,
          preference,
          relativeTaste,
          comparisonMode: mode,
          evaluatedAt: preference !== null ? new Date().toISOString() : null,
        };
        await commit([{ store: 'comparisons', type: 'put', value: updated }], (s) => ({
          ...s,
          comparisons: s.comparisons.map((x) => (x.id === comparisonId ? updated : x)),
        }));
      },

      async setBaseline(groupId, brewId) {
        const group = state.groups.find((g) => g.id === groupId);
        if (!group) throw new Error('グループが見つかりません');
        const brew = state.brews.find((b) => b.id === brewId);
        if (!brew || brew.groupId !== groupId) throw new Error('一杯が見つかりません');
        const updated: BrewGroup = { ...group, baselineBrewId: brewId };
        const change = {
          id: newId(),
          groupId,
          fromBrewId: group.baselineBrewId,
          toBrewId: brewId,
          changedAt: new Date().toISOString(),
        };
        // 基準更新と履歴を1トランザクションで
        await commit(
          [
            { store: 'groups', type: 'put', value: updated },
            { store: 'baselineChanges', type: 'put', value: change },
          ],
          (s) => ({
            ...s,
            groups: s.groups.map((g) => (g.id === groupId ? updated : g)),
            baselineChanges: [...s.baselineChanges, change],
          }),
        );
      },

      async correctBrew(originalId, params, note) {
        const original = state.brews.find((b) => b.id === originalId);
        if (!original) throw new Error('一杯が見つかりません');
        // 上書きせず訂正版レコードを作成。既存比較は当時の値を維持する。
        const revision: Brew = {
          id: newId(),
          groupId: original.groupId,
          brewedAt: original.brewedAt,
          params,
          note: note?.trim() || null,
          revisionOf: originalId,
        };
        await commit([{ store: 'brews', type: 'put', value: revision }], (s) => ({
          ...s,
          brews: [...s.brews, revision],
        }));
        return revision.id;
      },

      async exportBackup() {
        const data = await repo.loadAll();
        const backup = buildBackup(data);
        downloadBackup(backup);
        const settings = { ...data.settings, lastBackupAt: backup.exportedAt };
        await commit([settingsPutOp(settings)], (s) => ({ ...s, settings }));
      },

      previewRestore(text) {
        return validateBackup(text);
      },

      async applyRestore(preview) {
        await restoreBackup(preview.backup, repo);
        await reload();
      },

      async deleteAllData() {
        await repo.clearAll();
        await reload();
      },
    };
  }, [state, commit, reload, saveSettings, repo, isCloud, migrationCandidate, userId]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}
