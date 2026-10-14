import { expect, it } from 'vitest';
import { DownloadProgress } from './download-progress.js';
it('accepts spinner/decimal counters without letting per-file bars overwrite aggregate progress', () => {
  const progress = new DownloadProgress();
  expect(progress.update('⠙ Downloading 500 MB / 2 GB 10 MB/s')?.progress).toBe(25);
  expect(progress.update('game.bin 1 MiB/1 MiB 100%')).toBeUndefined();
  expect(progress.update('Downloading 1 MiB/2 MiB 50%')).toBeUndefined();
  expect(progress.update('100%')).toBeUndefined();
  expect(progress.update('Downloading 1 GB / 2 GB 10 MB/s')?.progress).toBe(50);
  expect(new DownloadProgress().update('Connecting…')).toBeUndefined();
  expect(new DownloadProgress().update('Downloading 42%')?.progress).toBe(42);
});
