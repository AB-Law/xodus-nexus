import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { prepareGameWrapper } from './game-wrapper.js';
import { defaultLaunchTools } from '../shared/launch-tools.js';
import { run } from './process.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, {recursive:true,force:true}))); });
async function setup() {
  const root=await mkdtemp(path.join(tmpdir(), 'nexus-launch-tools-')); roots.push(root);
  const bin=path.join(root, "tool's bin"); await mkdir(bin);
  const tool=async(name:string,body:string)=>{const file=path.join(bin,name);await writeFile(file,`#!/bin/sh\n${body}\n`);await chmod(file,0o700);return file;};
  const wine=await tool('wine',`printf '%s\\n' "$DXVK_HUD" "$WINEDLLOVERRIDES" "$XODUS_SOCKET"; printf '<%s>\\n' "$@"; exit 7`);
  return {root,bin,tool,wine,env:{...process.env,PATH:`${bin}:/usr/bin:/bin`,XODUS_SOCKET:'/private-synthetic-socket'}};
}
it('leaves the default launch command unchanged without creating files',async()=>{
  const {root,wine}=await setup(); const dir=path.join(root,'wrappers');
  expect((await prepareGameWrapper(wine,undefined,dir)).command).toBe(wine);
  await expect(stat(dir)).rejects.toThrow();
});
it('applies the DualSense HIDRAW workaround per game without changing inherited Steam Input or other controllers', async () => {
  const { root, wine, env } = await setup();
  await writeFile(wine, '#!/bin/sh\nprintf "%s\\n" "$PROTON_DISABLE_HIDRAW" "$SteamGameId" "$SDL_GAMECONTROLLERCONFIG"\n');
  const source = { ...env, PROTON_DISABLE_HIDRAW: '1', SteamGameId: '16968485195965530112', SDL_GAMECONTROLLERCONFIG: 'mapping with spaces' };
  const wrapper = await prepareGameWrapper(wine, { ...defaultLaunchTools, launchOptions: 'PROTON_DISABLE_HIDRAW=0x054c/0x0ce6 %command%' }, path.join(root, 'wrappers'), source);
  const changed = await run(wrapper.command, [], { env: source });
  expect(changed.code).toBe(0);
  expect(changed.output.trimEnd()).toBe('0x054c/0x0ce6\n16968485195965530112\nmapping with spaces');
  const unmodified = await prepareGameWrapper(wine, undefined, path.join(root, 'other'), source);
  expect((await run(unmodified.command, [], { env: source })).output.trimEnd()).toBe('1\n16968485195965530112\nmapping with spaces');
  expect(source.PROTON_DISABLE_HIDRAW).toBe('1');
});
it('preserves quoted environment, literal arguments, original identity and actual exit status',async()=>{
  const {root,wine,env}=await setup();
  const wrapper=await prepareGameWrapper(wine,{...defaultLaunchTools,launchOptions:'DXVK_HUD="fps,frametimes" WINEDLLOVERRIDES="dxgi=n,b;winhttp=b" %command% --launcher-skip "two words" "literal $HOME"'},path.join(root,'wrappers'),env);
  const result=await run(wrapper.command,['original game.exe'],{env});
  expect(result.code).toBe(7); expect(result.output).toContain('fps,frametimes\ndxgi=n,b;winhttp=b\n/private-synthetic-socket');
  expect(result.output).toContain('<original game.exe>\n<--launcher-skip>\n<two words>\n<literal $HOME>');
  await wrapper.cleanup(); await expect(stat(wrapper.command)).rejects.toThrow();
});
it('supports MangoHud directly and gamescope with mangoapp, never wrapping a launcher process',async()=>{
  const {root,bin,wine,env:baseEnv,tool}=await setup();
  const env={...baseEnv,PATH:bin};
  await tool('mangohud',`echo MANGO; exec "$@"`);
  await tool('gamemoderun',`echo GAMEMODE; exec "$@"`);
  await tool('gamescope',`echo GAMESCOPE; while [ "$1" != -- ]; do printf '%s\\n' "$1"; shift; done; shift; exec "$@"`);
  const dir=path.join(root,'wrappers');
  const mango=await prepareGameWrapper(wine,{...defaultLaunchTools,mangoHud:true},dir,env);
  expect((await run(mango.command,['game.exe'],{env})).output).toContain('MANGO');
  await expect(prepareGameWrapper(wine,{...defaultLaunchTools,mangoHud:true,gamescope:true},dir,env)).rejects.toThrow('mangoapp');
  await tool('mangoapp','exit 99'); // Presence check only, gamescope owns its launch.
  const scope=await prepareGameWrapper(wine,{...defaultLaunchTools,mangoHud:true,gamescope:true,gamescopeArgs:'-W 1920 -f',launchOptions:'gamemoderun %command%'},dir,env);
  const result=await run(scope.command,['game.exe'],{env});
  expect(result.output).toContain('GAMEMODE\nGAMESCOPE\n-W\n1920\n-f\n--mangoapp');
  expect(result.output).not.toContain('\nMANGO\n'); expect(result.code).toBe(7);
  expect(await readFile(scope.command,'utf8')).not.toContain('xodus-cli');
});
it('fails clearly before starting a configured missing tool',async()=>{
  const {root,wine}=await setup();
  await expect(prepareGameWrapper(wine,{...defaultLaunchTools,mangoHud:true},path.join(root,'wrappers'),{PATH:root})).rejects.toThrow('mangohud');
});
