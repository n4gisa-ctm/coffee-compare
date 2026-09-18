/**
 * 保存先のインターフェース。
 * ゲスト＝IndexedDB（端末内）、ログイン中＝Supabase（アカウントのクラウド保存）を
 * 同じ操作モデル（WriteOp）で扱う。commit は必ず全体で1トランザクション。
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

export interface WriteOp {
  store: StoreName;
  type: 'put' | 'delete' | 'clear';
  value?: unknown;
  key?: string;
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

export interface Repository {
  loadAll(): Promise<AllData>;
  /** ops を1トランザクションで適用する（部分適用しない） */
  commit(ops: WriteOp[]): Promise<void>;
  clearAll(): Promise<void>;
}

export function settingsPutOp(settings: Settings): WriteOp {
  return { store: 'settings', type: 'put', value: { ...settings, key: 'settings' } };
}
