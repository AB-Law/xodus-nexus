import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const h = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: h.execute }));
import { moveGameToTrash } from './game-trash.js';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-trash-fallback-')); h.execute.mockReset(); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
async function folder() {
  const target = path.join(root, 'Game with spaces; literal');
  await fs.mkdir(target); await fs.writeFile(path.join(target, 'keep.txt'), 'fixture');
  return target;
}

it('keeps working native Trash unchanged without a second move', async () => {
  const target = await folder(), native = vi.fn(async () => fs.rename(target, path.join(root, 'trash'))), gio = vi.fn();
  await moveGameToTrash(target, native, { platform: 'linux', gio });
  expect(native).toHaveBeenCalledWith(target); expect(gio).not.toHaveBeenCalled();
  expect(await fs.readFile(path.join(root, 'trash/keep.txt'), 'utf8')).toBe('fixture');
});

it('retries the same unchanged directory using alternative recoverable Trash', async () => {
  const target = await folder(), gio = vi.fn(async entry => fs.rename(entry, path.join(root, 'trash')));
  await moveGameToTrash(target, async () => { throw Error('Failed to move item to trash'); }, { platform: 'linux', gio });
  expect(gio).toHaveBeenCalledOnce(); expect(gio).toHaveBeenCalledWith(target);
  expect(await fs.readFile(path.join(root, 'trash/keep.txt'), 'utf8')).toBe('fixture');
});

it.each(['darwin', 'win32'] as const)('does not change %s behavior', async platform => {
  const target = await folder(), gio = vi.fn();
  await expect(moveGameToTrash(target, async () => { throw Error('native failure'); }, { platform, gio })).rejects.toThrow('native failure');
  expect(gio).not.toHaveBeenCalled();
});

it.each(['missing', 'replaced', 'symlink'])('does not retry a %s source after a failed or partial native move', async kind => {
  const target = await folder(), gio = vi.fn();
  await expect(moveGameToTrash(target, async () => {
    await fs.rename(target, path.join(root, 'already-moved'));
    if (kind === 'replaced') await fs.mkdir(target);
    if (kind === 'symlink') await fs.symlink(path.join(root, 'already-moved'), target);
    throw Error('partial move');
  }, { platform: 'linux', gio })).rejects.toThrow('folder changed');
  expect(gio).not.toHaveBeenCalled();
  expect(await fs.readFile(path.join(root, 'already-moved/keep.txt'), 'utf8')).toBe('fixture');
});

it('reports a detailed failure and preserves files when both helpers fail', async () => {
  const target = await folder();
  await expect(moveGameToTrash(target, async () => { throw Error('native failure'); }, { platform: 'linux', gio: async () => {
    throw Object.assign(Error('generic'), { stderr: 'Trash permission denied' });
  } })).rejects.toThrow('Trash permission denied');
  expect(await fs.readFile(path.join(target, 'keep.txt'), 'utf8')).toBe('fixture');
});

it('invokes gio without a shell or force-delete option and diagnoses a missing helper', async () => {
  const target = await folder();
  h.execute.mockImplementation((_command, _args, _options, callback) => callback(Object.assign(Error('missing'), { code: 'ENOENT' })));
  await expect(moveGameToTrash(target, async () => { throw Error('native failure'); }, { platform: 'linux' })).rejects.toThrow('not installed');
  expect(h.execute).toHaveBeenCalledWith('/usr/bin/gio', ['trash', '--', target], expect.objectContaining({ timeout: 60_000, maxBuffer: 16_384 }), expect.any(Function));
  expect(await fs.readFile(path.join(target, 'keep.txt'), 'utf8')).toBe('fixture');
});
