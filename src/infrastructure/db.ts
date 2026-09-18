/**
 * IndexedDB 実装（ゲスト＝端末内保存）。
 * 注意：IndexedDB はサイトデータ削除などで失われる可能性がある。
 * 無期限保存を保証しない（UIで明示する）。
 */
import type { Settings } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';
import type { AllData, Repository, StoreName, WriteOp } from '../application/repository';
import { STORES } from '../application/repository';

const DB_NAME = 'coffee-compare';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: name === 'settings' ? 'key' : 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDBを開けませんでした'));
    req.onblocked = () => reject(new Error('別のタブがデータベースを使用中です'));
  });
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('保存に失敗しました'));
    tx.onabort = () => reject(tx.error ?? new Error('保存が中断されました'));
  });
}

function reqResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('読み込みに失敗しました'));
  });
}

/** 複数ストアへの書き込みを1トランザクションで行う */
export async function writeTx(ops: WriteOp[]): Promise<void> {
  if (ops.length === 0) return;
  const db = await openDb();
  const storeNames = [...new Set(ops.map((o) => o.store))];
  const tx = db.transaction(storeNames, 'readwrite');
  for (const op of ops) {
    const store = tx.objectStore(op.store);
    if (op.type === 'put') store.put(op.value);
    else if (op.type === 'delete') store.delete(op.key!);
    else store.clear();
  }
  await txDone(tx);
}

interface SettingsRecord extends Settings {
  key: 'settings';
}

export async function loadAllLocal(): Promise<AllData> {
  const db = await openDb();
  const tx = db.transaction([...STORES], 'readonly');
  const get = <T>(name: StoreName) => reqResult(tx.objectStore(name).getAll() as IDBRequest<T[]>);
  const [beanBatches, groups, brews, comparisons, drafts, baselineChanges, settingsArr] =
    await Promise.all([
      get<AllData['beanBatches'][number]>('beanBatches'),
      get<AllData['groups'][number]>('groups'),
      get<AllData['brews'][number]>('brews'),
      get<AllData['comparisons'][number]>('comparisons'),
      get<AllData['drafts'][number]>('drafts'),
      get<AllData['baselineChanges'][number]>('baselineChanges'),
      get<SettingsRecord>('settings'),
    ]);
  const settings: Settings = settingsArr[0] ?? { ...DEFAULT_SETTINGS };
  return { beanBatches, groups, brews, comparisons, drafts, baselineChanges, settings };
}

/** 端末内保存（ゲスト用）リポジトリ */
export const localRepository: Repository = {
  loadAll: loadAllLocal,
  commit: writeTx,
  async clearAll() {
    await writeTx(STORES.map((store) => ({ store, type: 'clear' as const })));
  },
};

export function newId(): string {
  return crypto.randomUUID();
}
