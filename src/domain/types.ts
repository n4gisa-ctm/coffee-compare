/**
 * ドメイン型定義。React・ブラウザAPIに依存しない。
 * ルール：空欄（不明・未計測）は null。0 や既定値へ変換しない。
 */

export type Id = string;

/** 焙煎度（任意・選択式） */
export type RoastLevel = 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';

export interface BeanBatch {
  id: Id;
  name: string;
  roastLevel: RoastLevel | null;
  purchasedAt: string | null; // ISO date (YYYY-MM-DD)
  roastedAt: string | null;
}

export interface BrewGroup {
  id: Id;
  beanBatchId: Id;
  brewerName: string;
  grinderName: string | null;
  baselineBrewId: Id | null;
  archivedAt: string | null; // ISO datetime
  createdAt: string;
}

/**
 * 一杯の抽出条件。
 * doseG / waterMl は必須（正数）。それ以外は null = 不明・未計測。
 */
export interface BrewParameters {
  doseG: number;
  waterMl: number;
  grind: string | null; // 自由記述（例：C40 24クリック）
  tempC: number | null; // 0–100
  totalTimeSec: number | null; // 総抽出時間（秒）
  bloomTimeSec: number | null; // 蒸らし時間（秒）
  pourNote: string | null; // 注ぎ方メモ
}

export type ParamKey = keyof BrewParameters;

export const PARAM_KEYS: ParamKey[] = [
  'doseG',
  'waterMl',
  'grind',
  'tempC',
  'totalTimeSec',
  'bloomTimeSec',
  'pourNote',
];

export interface Brew {
  id: Id;
  groupId: Id;
  brewedAt: string; // ISO datetime
  params: BrewParameters;
  note: string | null; // 味のひとこと
  revisionOf: Id | null; // 訂正版のとき、元の一杯の id
}

/** 相対評価：基準に対する本人の好み */
export type Preference = 'baseline' | 'trial' | 'unsure';

/** 相対味評価（基準に対して弱い／同じくらい／強い／分からない） */
export type RelativeLevel = 'weaker' | 'same' | 'stronger' | 'unsure';

export interface RelativeTaste {
  acidity: RelativeLevel | null;
  bitterness: RelativeLevel | null;
  body: RelativeLevel | null;
}

export type ComparisonMode = 'remembered' | 'sideBySide';

export interface Comparison {
  id: Id;
  groupId: Id;
  baselineBrewId: Id;
  trialBrewId: Id;
  /** 意図して変えた項目 */
  plannedChanges: ParamKey[];
  preference: Preference | null; // null = 未評価
  relativeTaste: RelativeTaste;
  comparisonMode: ComparisonMode;
  evaluatedAt: string | null;
  createdAt: string;
}

export type DraftStage = 'plan' | 'brewing' | 'actual';

/**
 * 進行中の比較（全体で1件）。
 * 比較開始時に基準の条件をスナップショット固定する。
 */
export interface Draft {
  id: Id;
  groupId: Id;
  /** null = 初回の一杯（比較なし） */
  baselineBrewId: Id | null;
  baselineSnapshot: BrewParameters | null;
  plannedChanges: ParamKey[];
  plannedParams: BrewParameters;
  actualParams: BrewParameters | null; // 抽出後の実測確認で確定
  stage: DraftStage;
  updatedAt: string;
}

export interface BaselineChange {
  id: Id;
  groupId: Id;
  fromBrewId: Id | null;
  toBrewId: Id;
  changedAt: string;
}

export interface Settings {
  schemaVersion: number;
  lastBackupAt: string | null;
  activeGroupId: Id | null;
  storageNoticeAcknowledged: boolean;
}

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  lastBackupAt: null,
  activeGroupId: null,
  storageNoticeAcknowledged: false,
};

/** バックアップJSONの形 */
export interface BackupFile {
  app: 'coffee-compare';
  schemaVersion: number;
  exportedAt: string;
  beanBatches: BeanBatch[];
  groups: BrewGroup[];
  brews: Brew[];
  comparisons: Comparison[];
  baselineChanges: BaselineChange[];
  settings: Settings;
}
