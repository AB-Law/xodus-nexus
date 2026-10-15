import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { GameShortcuts, desktopArgument, shortcutArguments } from './game-shortcuts.js';
import { ShortcutLaunch } from './shortcut-launch.js';

const execute = promisify(execFile);
const id = '0123456789abcdef';
const game = { id, title: 'A game\nExec=unwanted', installState: 'ready' as const };
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-shortcuts-'));
  const launcher = path.join(root, 'Launcher $`%\' name.AppImage');
  await fs.copyFile('/bin/echo', launcher); await fs.chmod(launcher, 0o700);
  const icon = path.join(root, 'icon.png'); await fs.writeFile(icon, 'fixture icon');
  const locations = { userData: path.join(root, 'profile'), desktop: path.join(root, 'Desktop'),
    applications: path.join(root, 'applications'), launcher, icon };
  return { root, locations, shortcuts: new GameShortcuts(locations) };
}

it('creates profile-scoped desktop/menu entries and starts the launcher, not the game', async () => {
  const f = await fixture();
  try {
    await f.shortcuts.initialize();
    const target = await f.shortcuts.create(game, 'desktop');
    const menu = await f.shortcuts.create(game, 'applications');
    expect(await fs.readFile(target, 'utf8')).toContain('Name=A game Exec=unwanted\n');
    expect((await fs.readFile(target, 'utf8')).match(/^Exec=/gm)).toHaveLength(1);
    expect(await fs.readFile(target, 'utf8')).toContain('Exec=/bin/sh ');
    expect((await fs.stat(target)).mode & 0o777).toBe(0o755);
    expect((await fs.stat(menu)).mode & 0o777).toBe(0o644);
    const entry = path.join(f.locations.userData, 'shortcuts/launch-game');
    const result = await execute(entry, [id]);
    expect(result.stdout.trim()).toBe(`--nexus-profile ${f.locations.userData} --launch-game ${id}`);
    const before = await fs.readFile(target, 'utf8');
    // AppImage update replaces the file at the same path; shortcut stays valid.
    await fs.rename(f.locations.launcher, `${f.locations.launcher}.old`);
    await fs.copyFile(`${f.locations.launcher}.old`, f.locations.launcher);
    expect((await execute(entry, [id])).stdout).toBe(result.stdout);
    // Opening a manually moved launcher refreshes only the stable entry point.
    const moved = path.join(f.root, 'Moved launcher.AppImage');
    await fs.rename(f.locations.launcher, moved);
    await new GameShortcuts({ ...f.locations, launcher: moved }).initialize();
    expect((await execute(entry, [id])).stdout).toBe(result.stdout);
    expect(await fs.readFile(target, 'utf8')).toBe(before);
    expect(await fs.readFile(entry, 'utf8')).not.toContain(f.locations.launcher);
    await f.shortcuts.remove(id);
    await expect(fs.stat(target)).rejects.toThrow(); await expect(fs.stat(menu)).rejects.toThrow();
  } finally { await fs.rm(f.root, { recursive: true, force: true }); }
});

it('rejects invalid IDs, unsupported installs, unsafe directories and unrelated output files', async () => {
  const f = await fixture();
  try {
    const unsupported = new GameShortcuts({ ...f.locations, launcher: undefined });
    await unsupported.initialize(); expect(unsupported.available).toBe(false);
    await expect(unsupported.create(game, 'desktop')).rejects.toThrow('installed Linux launcher');
    await f.shortcuts.initialize();
    await expect(f.shortcuts.create({ ...game, id: '../bad' }, 'desktop')).rejects.toThrow('Invalid game');
    await expect(f.shortcuts.create({ ...game, installState: 'imported' }, 'desktop')).rejects.toThrow('ready');
    await expect(f.shortcuts.create(game, '../elsewhere' as 'desktop')).rejects.toThrow('destination');
    const target = await f.shortcuts.create(game, 'desktop');
    await fs.writeFile(target, 'unrelated user file');
    await expect(f.shortcuts.create(game, 'desktop')).rejects.toThrow('unrelated');
    await f.shortcuts.remove(id);
    expect(await fs.readFile(target, 'utf8')).toBe('unrelated user file');
    await fs.unlink(target); await fs.symlink(f.locations.icon, target);
    await expect(f.shortcuts.create(game, 'desktop')).rejects.toThrow('unsafe');
    expect(await fs.readFile(f.locations.icon, 'utf8')).toBe('fixture icon');
    await fs.chmod(f.locations.applications, 0o777).catch(() => {});
    await fs.mkdir(f.locations.applications, { recursive: true }); await fs.chmod(f.locations.applications, 0o777);
    await expect(f.shortcuts.create(game, 'applications')).rejects.toThrow('directory');
  } finally { await fs.rm(f.root, { recursive: true, force: true }); }
});

it('parses only validated shortcut requests and escapes desktop Exec separately from shell quoting', () => {
  expect(shortcutArguments(['launcher', '--nexus-profile', '/a profile', '--launch-game', id])).toEqual({ profile: '/a profile', gameId: id });
  expect(shortcutArguments(['launcher', '--unrelated'])).toEqual({});
  for (const argv of [['--launch-game'], ['--launch-game', '../game'], ['--launch-game', id, '--launch-game', id],
    ['--nexus-profile', 'relative'], ['--nexus-profile', '/x\nExec=evil']]) expect(() => shortcutArguments(argv)).toThrow();
  expect(desktopArgument('/a b/100%/"$`\\')).toBe('"/a b/100%%/\\\\"\\\\$\\\\`\\\\\\\\"');
});

it('writes a persistent per-game PNG, reuses it offline and keeps Nexus as the fallback', async () => {
  const f = await fixture();
  try {
    await f.shortcuts.initialize();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
    const target = await f.shortcuts.create(game, 'desktop', png);
    const icon = path.join(f.locations.userData, 'shortcuts/icons', `${id}.png`);
    expect(await fs.readFile(target, 'utf8')).toContain(`Icon=${icon}\n`);
    expect(await fs.readFile(icon)).toEqual(png);
    expect((await fs.stat(icon)).mode & 0o777).toBe(0o600);
    const menu = await f.shortcuts.create(game, 'applications');
    expect(await fs.readFile(menu, 'utf8')).toContain(`Icon=${icon}\n`);
    const other = await f.shortcuts.create({ ...game, id: 'fedcba9876543210' }, 'desktop', Buffer.from('not an image'));
    expect(await fs.readFile(other, 'utf8')).toContain(`Icon=${path.join(f.locations.userData, 'shortcuts/nexus.png')}\n`);
  } finally { await fs.rm(f.root, { recursive: true, force: true }); }
});

it('coalesces duplicate requests, refuses concurrent games, and recovers after startup failure', async () => {
  let finish!: () => void;
  let active: string | undefined;
  const calls: string[] = [];
  const router = new ShortcutLaunch(() => active, async value => {
    calls.push(value); await new Promise<void>(resolve => { finish = resolve; });
    active = value;
  });
  const pending = router.request(id);
  await router.request(id);
  await expect(router.request('fedcba9876543210')).rejects.toThrow('Another game');
  expect(calls).toEqual([id]); finish(); await pending;
  await router.request(id); expect(calls).toEqual([id]);
  await expect(router.request('fedcba9876543210')).rejects.toThrow('Another game');
  const failure = new ShortcutLaunch(() => undefined, async () => { throw Error('missing runtime'); });
  await expect(failure.request(id)).rejects.toThrow('missing runtime');
  expect(failure.preparing).toBe(false);
});
