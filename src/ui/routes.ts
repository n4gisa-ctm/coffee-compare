import type { Id } from '../domain/types';

export type Route =
  | { name: 'home' }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'startCompare' }
  | { name: 'flow' }
  | { name: 'evaluate'; comparisonId: Id }
  | { name: 'brewDetail'; brewId: Id }
  | { name: 'pastCompare'; baseId: Id | null; trialId: Id | null }
  | { name: 'groupForm'; groupId: Id | null };

export type Navigate = (r: Route) => void;
