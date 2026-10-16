import { expect, it } from 'vitest';
import { defaultLibraryFilters, loadLibraryFilters, saveLibraryFilters } from './library-preferences';

it('restores all filters from persistent storage after recreating the UI', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  expect(loadLibraryFilters(storage)).toEqual(defaultLibraryFilters);
  const filters = { kind: 'gamepass' as const, playState: 'installed' as const, query: 'Fallout' };
  expect(saveLibraryFilters(filters, storage)).toBe(true);
  expect(loadLibraryFilters({ ...storage })).toEqual(filters);
});

it('recovers from corrupt or unavailable storage without preventing startup', () => {
  for (const raw of ['{broken', '[]', 'null', '{"kind":"wrong","playState":"wrong","query":42}']) {
    expect(loadLibraryFilters({ getItem: () => raw, setItem: () => {} })).toEqual(defaultLibraryFilters);
  }
  const unavailable = { getItem: (): string => { throw Error('Unavailable'); }, setItem: () => { throw Error('Unavailable'); } };
  expect(loadLibraryFilters(unavailable)).toEqual(defaultLibraryFilters);
  expect(saveLibraryFilters(defaultLibraryFilters, unavailable)).toBe(false);
  expect(loadLibraryFilters({ getItem: () => JSON.stringify({ query: 'x'.repeat(1000) }), setItem: () => {} }).query).toHaveLength(512);
});
