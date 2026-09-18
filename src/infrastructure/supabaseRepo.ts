/**
 * Supabase 実装（ログイン中＝アカウントのクラウド保存）。
 * すべてのデータを records テーブル（user_id, store, id, data）に保存する。
 * commit は Postgres 関数 apply_ops で1トランザクション適用する。
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Settings } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';
import type { AllData, Repository, StoreName, WriteOp } from '../application/repository';
import { STORES } from '../application/repository';

interface RecordRow {
  store: StoreName;
  id: string;
  data: unknown;
}

export function createSupabaseRepository(client: SupabaseClient): Repository {
  return {
    async loadAll(): Promise<AllData> {
      const { data, error } = await client.from('records').select('store,id,data');
      if (error) throw new Error(`クラウドからの読み込みに失敗しました：${error.message}`);
      const rows = (data ?? []) as RecordRow[];
      const byStore = new Map<StoreName, unknown[]>(STORES.map((s) => [s, []]));
      for (const row of rows) {
        byStore.get(row.store)?.push(row.data);
      }
      const settingsRows = byStore.get('settings') as (Settings & { key: string })[];
      return {
        beanBatches: byStore.get('beanBatches') as AllData['beanBatches'],
        groups: byStore.get('groups') as AllData['groups'],
        brews: byStore.get('brews') as AllData['brews'],
        comparisons: byStore.get('comparisons') as AllData['comparisons'],
        drafts: byStore.get('drafts') as AllData['drafts'],
        baselineChanges: byStore.get('baselineChanges') as AllData['baselineChanges'],
        settings: settingsRows[0] ?? { ...DEFAULT_SETTINGS },
      };
    },

    async commit(ops: WriteOp[]): Promise<void> {
      if (ops.length === 0) return;
      const { error } = await client.rpc('apply_ops', { ops });
      if (error) throw new Error(`クラウドへの保存に失敗しました：${error.message}`);
    },

    async clearAll(): Promise<void> {
      await this.commit(STORES.map((store) => ({ store, type: 'clear' as const })));
    },
  };
}
