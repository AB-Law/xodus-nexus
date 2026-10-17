import { execFile } from 'node:child_process';
import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { externalFontEnvironment } from './launcher-fonts.js';
import { findSteamLaunch, readSteamShortcuts, writeSteamArtwork, type SteamLaunch } from './steam-shortcuts.js';

let importing = false;
const sentinel = '/tmp/addnonsteamgamefile';
const runUri = (appid: number) => `steam://rungameid/${(BigInt(appid) << 32n) | 0x02000000n}`;

/** A small strict KeyValues reader for loginusers.vdf, never account tokens. */
export function recentSteamUser(text: string): string | undefined {
  if (text.length > 1024 * 1024) throw Error('Steam profile metadata is too large.');
  let offset = 0;
  const space = () => { for (;;) {
    while (/\s/.test(text[offset] ?? '') && offset < text.length) offset++;
    if (text.slice(offset, offset + 2) !== '//') return;
    const end = text.indexOf('\n', offset); offset = end < 0 ? text.length : end + 1;
  } };
  const string = () => {
    space(); if (text[offset++] !== '"') throw Error('Invalid Steam profile metadata.');
    let value = '';
    while (offset < text.length) {
      const char = text[offset++];
      if (char === '"') return value;
      if (char === '\\') { if (offset >= text.length) break; value += text[offset++]; }
      else value += char;
    }
    throw Error('Truncated Steam profile metadata.');
  };
  type KV = Map<string, string | KV>;
  const object = (nested: boolean, depth: number): KV => {
    if (depth > 5) throw Error('Invalid Steam profile nesting.');
    const result: KV = new Map();
    for (;;) {
      space();
      if (nested && text[offset] === '}') { offset++; return result; }
      if (offset === text.length && !nested) return result;
      const key = string(); space();
      if (result.has(key)) throw Error('Duplicate Steam profile field.');
      if (text[offset] === '{') { offset++; result.set(key, object(true, depth + 1)); }
      else result.set(key, string());
    }
  };
  const users = object(false, 0).get('users');
  if (!(users instanceof Map)) return;
  const recent = [...users].filter(([id, value]) => /^\d{17}$/.test(id) && value instanceof Map && value.get('MostRecent') === '1');
  if (recent.length !== 1) return;
  const id = BigInt(recent[0][0]) - 76561197960265728n;
  return id > 0n && id <= 0xffffffffn ? String(id) : undefined;
}

export async function activeSteamAccount(accounts: string[]): Promise<string> {
  const selected: string[] = [];
  for (const account of accounts) {
    const root = path.resolve(account, '../../..');
    try {
      const file = path.join(root, 'config', 'loginusers.vdf');
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.uid !== process.getuid?.() || stat.size > 1024 * 1024) continue;
      if (recentSteamUser(await fs.readFile(file, 'utf8')) === path.basename(path.dirname(account))) selected.push(account);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  if (selected.length === 1) return selected[0];
  if (accounts.length === 1) return accounts[0];
  throw Error('Could not identify the active Steam profile. Sign in to native Steam and try again.');
}

export async function requestSteamImport(file: string): Promise<void> {
  if (!path.isAbsolute(file) || /[\0\r\n]/.test(file) || !file.endsWith('.desktop')) throw Error('Invalid Steam import launcher.');
  const source = await fs.lstat(file);
  if (!source.isFile() || source.uid !== process.getuid?.() || (source.mode & 0o022)) throw Error('Unsafe Steam import launcher.');
  // Match SteamOS's native add-to-steam handshake. Never truncate/follow an
  // unrelated file at the fixed sentinel path, and let Steam consume it.
  const handle = await fs.open(sentinel, constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== process.getuid?.() || stat.nlink !== 1 || stat.size !== 0 || (stat.mode & 0o022)) throw Error('Unsafe Steam import handshake file.');
    const now = new Date(); await handle.utimes(now, now);
  } finally { await handle.close(); }
  await new Promise<void>((resolve, reject) => {
    execFile('/usr/bin/steam', ['steam://addnonsteamgame/' + encodeURIComponent(file)], {
      env: externalFontEnvironment(), timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 8192,
    }, error => error ? reject(Error('Could not send the shortcut to the running Steam client.')) : resolve());
  });
}

/** Steam owns its live shortcut database. Read back its actual assigned ID
 * before writing optional artwork, never manufacture a successful import. */
export async function addLiveSteamShortcut(config: string, launch: SteamLaunch, desktop: string,
  artwork: { cover?: Buffer; wide?: Buffer }, request = requestSteamImport, confirmationMs = 15000): Promise<string> {
  if (importing) throw Error('Another Steam import is in progress. Please wait.');
  importing = true;
  try {
    const file = path.join(config, 'shortcuts.vdf');
    const lookup = async () => {
      const bytes = await readSteamShortcuts(file);
      return bytes ? findSteamLaunch(bytes, launch) : undefined;
    };
    let appid = await lookup();
    if (appid === undefined) {
      await request(desktop);
      const deadline = performance.now() + Math.min(15000, Math.max(0, confirmationMs));
      while (performance.now() < deadline) {
        try { appid = await lookup(); } catch { /* Steam may be mid-write. Retry only reads. */ }
        if (appid !== undefined) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    if (appid === undefined) throw Error('Steam has not confirmed the shortcut yet. Check Steam, then try Add to Steam again.');
    await writeSteamArtwork(config, appid, artwork);
    return runUri(appid);
  } finally { importing = false; }
}
