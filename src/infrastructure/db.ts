/**
 * IndexedDB 実装。
 * 注意：IndexedDB はサイトデータ削除などで失われる可能性がある。
 * 無期限保存を保証しない（UIで明示する）。
 */
import type {
  BeanBatch,
  BrewGroup,
  Brew,
  Comparison,
  Draft,
  BaselineChange,
  Settings,
} from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';

const DB_NAME = 'coffee-compare';
const DB_VERSION = 1;

export const STORES = [
  'beanBatches',
  'groups',
  'brews',
  'comparisons',
  'drafts',
  'baselineChanges',
  'settings',
] as const;
export type StoreName = (typeof STORES)[number];

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

/**
 * 複数ストアへの書き込みを1トランザクションで行う。
 * ops の実行中に1つでも失敗すれば全てロールバックされる。
 */
export interface WriteOp {
  store: StoreName;
  type: 'put' | 'delete' | 'clear';
  value?: unknown;
  key?: string;
}

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

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return reqResult(tx.objectStore(storeName).getAll() as IDBRequest<T[]>);
}

export interface AllData {
  beanBatches: BeanBatch[];
  groups: BrewGroup[];
  brews: Brew[];
  comparisons: Comparison[];
  drafts: Draft[];
  baselineChanges: BaselineChange[];
  settings: Settings;
}

interface SettingsRecord extends Settings {
  key: 'settings';
}

export async function loadAll(): Promise<AllData> {
  const db = await openDb();
  const tx = db.transaction([...STORES], 'readonly');
  const [beanBatches, groups, brews, comparisons, drafts, baselineChanges, settingsArr] =
    await Promise.all([
      reqResult(tx.objectStore('beanBatches').getAll() as IDBRequest<BeanBatch[]>),
      reqResult(tx.objectStore('groups').getAll() as IDBRequest<BrewGroup[]>),
      reqResult(tx.objectStore('brews').getAll() as IDBRequest<Brew[]>),
      reqResult(tx.objectStore('comparisons').getAll() as IDBRequest<Comparison[]>),
      reqResult(tx.objectStore('drafts').getAll() as IDBRequest<Draft[]>),
      reqResult(tx.objectStore('baselineChanges').getAll() as IDBRequest<BaselineChange[]>),
      reqResult(tx.objectStore('settings').getAll() as IDBRequest<SettingsRecord[]>),
    ]);
  const settings: Settings = settingsArr[0] ?? { ...DEFAULT_SETTINGS };
  return { beanBatches, groups, brews, comparisons, drafts, baselineChanges, settings };
}

export function settingsPutOp(settings: Settings): WriteOp {
  return { store: 'settings', type: 'put', value: { ...settings, key: 'settings' } };
}

/** 全データ削除（確認付きUIから呼ぶ） */
export async function clearAllData(): Promise<void> {
  await writeTx(STORES.map((store) => ({ store, type: 'clear' as const })));
}

export function newId(): string {
  return crypto.randomUUID();
}
