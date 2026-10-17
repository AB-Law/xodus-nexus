import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { activeSteamAccount, addLiveSteamShortcut, recentSteamUser, requestSteamImport } from './steam-live.js';
import { findSteamLaunch, planSteamShortcut, type SteamLaunch } from './steam-shortcuts.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('node:child_process', async original => ({ ...await original<typeof import('node:child_process')>(), execFile: execute }));
let root: string;
const launch: SteamLaunch = { title: 'Live title', executable: '"/bin/sh"', options: '"/home/test/launch-game" "0123456789abcdef"',
  directory: '/home/test', identity: 'profile:game', icon: '/home/test/icon.png' };
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-steam-live-')); execute.mockReset(); });
afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
function assigned(bytes = planSteamShortcut(undefined, launch).bytes) {
  const result = Buffer.from(bytes); result.writeUInt32LE(0xf1234567, result.indexOf(Buffer.from('appid\0')) + 6); return result;
}
const uri = `steam://rungameid/${(0xf1234567n << 32n) | 0x02000000n}`;

describe('live Steam confirmation', () => {
  it('waits for Steam to write its real assigned ID, never modifying its VDF itself', async () => {
    const request = vi.fn(async () => { await fs.writeFile(path.join(root, 'shortcuts.vdf'), assigned(), { mode: 0o600 }); });
    expect(await addLiveSteamShortcut(root, launch, '/private/game.desktop', {}, request)).toBe(uri);
    expect(request).toHaveBeenCalledWith('/private/game.desktop');
    expect(await fs.readFile(path.join(root, 'shortcuts.vdf'))).toEqual(assigned());
    expect((await fs.readdir(root)).some(file => file.includes('backup') || file.includes('lock'))).toBe(false);
  });
  it('recognizes equivalent quoted arguments and avoids duplicate live imports', async () => {
    const bytes = planSteamShortcut(undefined, { ...launch, executable: '/bin/sh', options: '/home/test/launch-game 0123456789abcdef' }).bytes;
    const actual = assigned(bytes);
    expect(findSteamLaunch(actual, launch)).toBe(0xf1234567);
    await fs.writeFile(path.join(root, 'shortcuts.vdf'), actual, { mode: 0o600 });
    const request = vi.fn();
    expect(await addLiveSteamShortcut(root, launch, '/private/game.desktop', {}, request)).toBe(uri);
    expect(request).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(root, 'shortcuts.vdf'))).toEqual(actual);
  });
  it('does not pretend an accepted URI alone means the game was added', async () => {
    const request = vi.fn(async () => {});
    await expect(addLiveSteamShortcut(root, launch, '/private/game.desktop', {}, request, 0)).rejects.toThrow('has not confirmed');
    expect(request).toHaveBeenCalled();
    expect(await fs.readdir(root)).toEqual([]);
  });
  it('releases its import guard after a request failure', async () => {
    await expect(addLiveSteamShortcut(root, launch, '/private/game.desktop', {}, async () => { throw Error('request failed'); })).rejects.toThrow('request failed');
    expect(await addLiveSteamShortcut(root, launch, '/private/game.desktop', {}, async () => {
      await fs.writeFile(path.join(root, 'shortcuts.vdf'), assigned(), { mode: 0o600 });
    })).toBe(uri);
  });
  it('rejects overlapping imports rather than racing the shared client handshake', async () => {
    let release: () => void = () => {};
    const request = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const first = addLiveSteamShortcut(root, launch, '/private/game.desktop', {}, request);
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    await expect(addLiveSteamShortcut(root, launch, '/other.desktop', {}, request)).rejects.toThrow('in progress');
    await fs.writeFile(path.join(root, 'shortcuts.vdf'), assigned(), { mode: 0o600 });
    release(); expect(await first).toBe(uri);
  });
});

describe('active Steam profile', () => {
  const metadata = (recent = '1') => `"users" { "76561197960265851" { "AccountName" "not logged" "PersonaName" "Name with {braces} and \\\"quotes\\\"" "MostRecent" "${recent}" } }`;
  it('reads the recent account ID without exposing names and handles quoted braces/comments', () => {
    expect(recentSteamUser('// comment\n' + metadata())).toBe('123');
    expect(recentSteamUser(metadata('0'))).toBeUndefined();
  });
  it.each(['', 'not a VDF', '"users" {', '"users" {} trailing', '"users" {} "users" {}'])('rejects malformed metadata or has no active profile: %j', value => {
    if (value === '') expect(recentSteamUser(value)).toBeUndefined();
    else expect(() => recentSteamUser(value)).toThrow();
  });
  it('selects only the currently used profile from several existing accounts', async () => {
    const steam = path.join(root, 'Steam');
    const accounts = ['123', '456'].map(id => path.join(steam, 'userdata', id, 'config'));
    for (const account of accounts) await fs.mkdir(account, { recursive: true, mode: 0o700 });
    await fs.mkdir(path.join(steam, 'config'), { mode: 0o700 });
    await fs.writeFile(path.join(steam, 'config/loginusers.vdf'), metadata(), { mode: 0o600 });
    expect(await activeSteamAccount(accounts)).toBe(accounts[0]);
  });
  it('does not silently choose an ambiguous profile', async () => {
    await expect(activeSteamAccount([path.join(root, 'one'), path.join(root, 'two')])).rejects.toThrow('identify');
  });
});

describe('native Steam URI request', () => {
  async function setup() {
    const file = path.join(root, 'Game with spaces and é.desktop'); await fs.writeFile(file, '[Desktop Entry]', { mode: 0o600 });
    const handle = { stat: vi.fn(async () => ({ isFile: () => true, uid: process.getuid?.(), nlink: 1, size: 0, mode: 0o600 })),
      utimes: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    vi.spyOn(fs, 'open').mockResolvedValue(handle as any);
    execute.mockImplementation((_binary, _args, _options, done) => done(null));
    return { file, handle };
  }
  it('sends a single encoded path without a shell and uses a safe nonblocking sentinel', async () => {
    const { file, handle } = await setup();
    await requestSteamImport(file);
    expect(fs.open).toHaveBeenCalledWith('/tmp/addnonsteamgamefile', expect.any(Number), 0o600);
    const flags = vi.mocked(fs.open).mock.calls[0][1] as number;
    expect(flags & constants.O_NOFOLLOW).not.toBe(0);
    expect(flags & constants.O_NONBLOCK).not.toBe(0);
    expect(flags & constants.O_TRUNC).toBe(0);
    expect(execute).toHaveBeenCalledWith('/usr/bin/steam', ['steam://addnonsteamgame/' + encodeURIComponent(file)],
      expect.objectContaining({ timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 8192 }), expect.any(Function));
    expect(handle.close).toHaveBeenCalledOnce();
  });
  it('never touches an unsafe existing handshake file', async () => {
    const { file, handle } = await setup();
    handle.stat.mockResolvedValue({ isFile: () => true, uid: -1, nlink: 1, size: 0, mode: 0o600 });
    await expect(requestSteamImport(file)).rejects.toThrow('Unsafe');
    expect(handle.utimes).not.toHaveBeenCalled(); expect(handle.close).toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled();
  });
  it('rejects symlink launchers and reports missing/broken Steam without raw output', async () => {
    const { file } = await setup(); const alias = path.join(root, 'link.desktop'); await fs.symlink(file, alias);
    await expect(requestSteamImport(alias)).rejects.toThrow('Unsafe');
    execute.mockImplementation((_binary, _args, _options, done) => done(Error('secret raw output')));
    await expect(requestSteamImport(file)).rejects.toThrow('Could not send');
  });
});
