import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { expect, it } from 'vitest';
import { AccountProfile } from './account-profile.js';

const avatar = 'data:image/png;base64,iVBORw0KGgo=';
const result = (account = 'one@example.test') => JSON.stringify({ schema: 1, account, gamertag: 'ExampleGamer', gamerpicDataUrl: avatar });
it('loads a genuine profile result, reuses only its account cache offline, and clears on logout', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-profile-'));
  try {
    const profile = new AccountProfile(root, () => {}, value => value, async () => result());
    await profile.select('one@example.test', '/fake/backend'); await profile.settled();
    expect(profile.value).toEqual({ gamertag: 'ExampleGamer', avatarDataUrl: avatar });
    const file = path.join(root, 'xbox-profile.json');
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    expect(await fs.readFile(file, 'utf8')).not.toContain('one@example.test');
    const offline = new AccountProfile(root, () => {}, value => value, async () => { throw Error('offline'); });
    await offline.select('one@example.test', '/fake/backend'); await offline.settled();
    expect(offline.value?.gamertag).toBe('ExampleGamer');
    await offline.select(undefined); expect(offline.value).toBeUndefined();
    await expect(fs.stat(file)).rejects.toThrow();
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

it('discards late requests after account changes and never shows another account cache', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-profile-race-'));
  try {
    let finish!: (value: string) => void;
    const profile = new AccountProfile(root, () => {}, value => value, async () => new Promise(resolve => { finish = resolve; }));
    await profile.select('one@example.test', '/fake/backend');
    const old = profile.settled();
    await profile.select('two@example.test');
    finish(result()); await old;
    expect(profile.value).toBeUndefined();
    const wrong = new AccountProfile(root, () => {}, value => value, async () => result());
    await wrong.select('two@example.test', '/fake/backend'); await wrong.settled();
    expect(wrong.value).toBeUndefined();
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

it('keeps email/default fallback with old backends or malformed profile responses', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-profile-fallback-'));
  try {
    let called = false;
    const old = new AccountProfile(root, () => {}, value => value, async () => { called = true; return result(); });
    await old.select('one@example.test'); expect(called).toBe(false);
    for (const output of ['bad json', JSON.stringify({ schema: 1, account: 'one@example.test', gamertag: '\nbad' })]) {
      const profile = new AccountProfile(root, () => {}, value => value, async () => output);
      await profile.select('one@example.test', '/fake/backend'); await profile.settled();
      expect(profile.value).toBeUndefined();
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
