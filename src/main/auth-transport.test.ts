import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { startAuthTransport, type AuthViewFactory } from './auth-transport.js';
const fixture = String.raw`#!/usr/bin/env node
const readline=require('node:readline');
const out=value=>process.stdout.write('NEXUS_AUTH_V1 '+JSON.stringify(value)+'\n');
const mode=process.env.FIXTURE_MODE;
if(mode==='no-handshake'){process.stdout.write('ordinary help\n');process.exit(0);}
out({type:'ready',version:1});
readline.createInterface({input:process.stdin}).on('line',line=>{
 const event=JSON.parse(line);
 if(event.type==='hello'){
  if(mode==='invalid'){out({type:'execute',session:1,code:'synthetic-secret'});return;}
  out({type:'open',session:1,url:'https://login.live.com/ppsecure/InlineLogin.srf',headers:{hostapp:'CloudExperienceHost'}});
 }
 if(event.type==='ipc'){
  process.stdout.write('synthetic-secret-must-not-be-logged\n');
  out({type:'close',session:1});setTimeout(()=>process.exit(0),20);
 }
});
`;
describe('private auth transport', () => {
  it.each(['success', 'invalid', 'no-handshake', 'cancel', 'load-failure'])('handles %s without exposing protocol output', async mode => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-auth-fixture-'));
    let disposed = false, opens = 0, closes = 0;
    try {
      const binary = path.join(root, 'cli'); await fs.writeFile(binary, fixture, { mode: 0o755 });
      const factory: AuthViewFactory = (send, cancel) => ({
        async open(frame) { opens++; if (mode === 'cancel') cancel(frame.session); else if (mode === 'load-failure') throw Error('synthetic-secret'); else send(frame.session, '{"synthetic":"not-a-real-token"}'); },
        close() { closes++; }, async context() {}, async dispose() { disposed = true; },
      });
      const tracked = startAuthTransport(binary, factory, { ...process.env, FIXTURE_MODE: mode }, 3000);
      if (mode === 'invalid' || mode === 'no-handshake' || mode === 'load-failure') await expect(tracked.result).rejects.toThrow(/sign-in/i);
      else { const result = await tracked.result; expect(result.code).toBe(mode === 'cancel' ? 1 : 0); expect(result.output).toBe(''); }
      expect(disposed).toBe(true);
      if (mode === 'success') { expect(opens).toBe(1); expect(closes).toBe(1); }
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});
