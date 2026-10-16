import type { AccountLibraryPage } from '../shared/types';

export interface LibraryFilters {
  kind: AccountLibraryPage['kind'];
  playState: 'all' | 'installed' | 'installable';
  query: string;
}
export const defaultLibraryFilters: LibraryFilters = { kind: 'all', playState: 'all', query: '' };
const key = 'xodus-nexus.library-filters.v1';
type Preferences = Pick<Storage, 'getItem' | 'setItem'>;

function normalize(value: unknown): LibraryFilters {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    kind: record.kind === 'owned' || record.kind === 'gamepass' ? record.kind : 'all',
    playState: record.playState === 'installed' || record.playState === 'installable' ? record.playState : 'all',
    query: typeof record.query === 'string' ? record.query.slice(0, 512) : '',
  };
}

/** Electron's local storage is scoped to the launcher profile, not an account. */
export function loadLibraryFilters(storage?: Preferences): LibraryFilters {
  try { return normalize(JSON.parse((storage ?? window.localStorage).getItem(key) ?? 'null')); }
  catch { return { ...defaultLibraryFilters }; }
}

export function saveLibraryFilters(filters: LibraryFilters, storage?: Preferences): boolean {
  try { (storage ?? window.localStorage).setItem(key, JSON.stringify(normalize(filters))); return true; }
  catch { return false; }
}
