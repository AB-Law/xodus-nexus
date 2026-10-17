import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { demoSnapshot } from '../shared/demo-data.js';
import { StateStore } from './store.js';

// Run the real IPC/admission/download lifecycle with synthetic child processes.
// No account, executable, network, installed game or production profile is used.
const h = vi.hoisted(() => ({
  root: '', wine: '', backend: {} as any, runtime: {} as any,
  handlers: new Map<string, (...args: any[]) => any>(),
  events: new Map<string, (...args: any[]) => any>(),
  downloads: [] as { args: string[]; progress: (paused?: boolean, phase?: string) => void; finish: (code: number) => void }[],
  game: undefined as undefined | { finish: () => void },
  quit: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { requestSingleInstanceLock: () => true, getPath: (name: string) => path.join(h.root, name),
    setPath: vi.fn(), on: (name: string, callback: (...args: any[]) => any) => h.events.set(name, callback), once: vi.fn(),
    whenReady: () => Promise.resolve(), getVersion: () => '0.0.0', isPackaged: false, quit: h.quit },
  ipcMain: { handle: (name: string, callback: (...args: any[]) => any) => h.handlers.set(name, callback) },
  BrowserWindow: class { webContents = { on: vi.fn(), send: vi.fn(), setWindowOpenHandler: vi.fn() };
    on() {} once() {} show() {} focus() {} isDestroyed() { return false; } async loadFile() {} },
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } }) },
  dialog: {}, nativeImage: {}, shell: {},
}));
vi.mock('./backend.js', () => ({ LINUX_RUN_PATCH: 'test-patch', BackendManager: class {
  get current() { return h.backend; } async refresh() {} async checkUpdate() {} async externalDownloadRunning() { return false; }
  setExternalRoot() {} } }));
vi.mock('./runtime.js', () => ({ RuntimeManager: class { get current() { return h.runtime; } async refresh() {} async checkNexus() {} setRoot() {} } }));
vi.mock('./catalog.js', () => ({ CatalogService: class { async artwork() { return new Map(); } async posters() { return new Map(); } } }));
vi.mock('./account-profile.js', () => ({ AccountProfile: class { async select() {} cancel() {} } }));
vi.mock('./launcher-update.js', () => ({ LauncherUpdater: class { state = {}; async initialize() {} async check() {} cancel() {} } }));
vi.mock('./launcher-fonts.js', () => ({ adoptLauncherFonts: () => undefined, externalFontEnvironment: (env: unknown) => env }));
vi.mock('./session-environment.js', () => ({ prepareGameModeKeyring: async () => 'skipped' }));
vi.mock('./game-shortcuts.js', () => ({ shortcutArguments: () => ({}), shortcutInstanceData: () => ({}), shortcutInstanceRequest: () => ({}),
  GameShortcuts: class { async initialize() {} } }));
vi.mock('./install-plan.js', () => ({ readInstallPlan: async () => ({}), installSelection: () => '11111111-1111-4111-8111-111111111111' }));
vi.mock('./xodus-service.js', () => ({ cloudSaveRuntime: async () => false, unbridgedCloudSaveRuntime: async () => false,
  selectedWinePath: () => h.wine, storeContentRuntime: async () => false, startXodusService: vi.fn() }));
vi.mock('./proton.js', () => ({ prepareProtonRunner: async () => undefined, syncPrefixUserLocale: async () => {}, syncUnrealCultureGameIni: async () => {} }));
vi.mock('./game-wrapper.js', () => ({ prepareGameWrapper: async () => ({ command: h.wine, cleanup: async () => {} }) }));
vi.mock('./process.js', () => ({
  run: async (_command: string, args: string[]) => ({ code: 0, output: args[0] === 'account' ? JSON.stringify({ stored: true, username: 'sample@example.test' }) : '' }),
  spawnTracked: (_command: string, args: string[], options: any) => {
    let resolve!: (result: { code: number; output: string }) => void, sequence = 0;
    const result = new Promise<{ code: number; output: string }>(done => { resolve = done; });
    const progress = (paused = false, phase = 'downloading') => options.onLine('NEXUS_PROGRESS ' + JSON.stringify({ schema: 1, event: 'progress', sequence: sequence++, phase,
      completedBytes: phase === 'complete' ? 100 : 20, totalBytes: 100, bytesPerSecond: 10, paused, canPause: phase === 'downloading' }));
    h.downloads.push({ args, progress, finish: code => resolve({ code, output: '' }) });
    return { child: { stdin: { on() {}, write: (line: string) => progress(JSON.parse(line).command === 'pause') }, kill: () => resolve({ code: 130, output: '' }) }, result };
  },
}));
vi.mock('./game-process.js', () => ({ spawnGameProcess: async () => {
  let resolve!: (result: { code: number; output: string }) => void;
  const result = new Promise<{ code: number; output: string }>(done => { resolve = done; });
  h.game = { finish: () => resolve({ code: 0, output: '' }) };
  return { child: {}, result, cleanup: async () => {}, stop: async () => resolve({ code: 0, output: '' }), forceStop: async () => {} };
} }));

const ipc = (name: string, ...args: any[]) => h.handlers.get(name)!(undefined, ...args);
const snapshot = () => ipc('get-snapshot');
const install = (letter: string, destination = path.join(h.root, `download-${letter}`)) => ipc('start-install', { productId: `9${letter.repeat(11)}`, title: `Sample ${letter}`, destination });

beforeAll(async () => {
  h.root = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-install-integration-'));
  h.wine = path.join(h.root, 'runtime', 'wine'); await fs.mkdir(path.dirname(h.wine)); await fs.writeFile(h.wine, 'fixture', { mode: 0o700 });
  const data = demoSnapshot(); h.backend = { ...data.backend, capabilities: { ...data.backend.capabilities, packageSelection: true }, binaryPath: path.join(h.root, 'synthetic-cli'), linuxRunPatch: 'test-patch' }; h.runtime = data.runtime;
  const store = new StateStore(path.join(h.root, 'userData'));
  await store.setSettings({ firstRunCompleted: true, market: 'US', runtimeRoot: path.join(h.root, 'runtime'), winePath: h.wine });
  const gamePath = path.join(h.root, 'installed-game'); await fs.mkdir(gamePath);
  await fs.writeFile(path.join(gamePath, 'MicrosoftGame.config'), '<Game><ShellVisuals DefaultDisplayName="Sample game"/><ExecutableList><Executable Name="Game.exe"/></ExecutableList><StoreId>9ZZZZZZZZZZZ</StoreId></Game>');
  await fs.writeFile(path.join(gamePath, 'Game.exe'), 'MZ fixture');
  await fs.writeFile(path.join(gamePath, '.xodus-streaming.msixvc'), 'synthetic container');
  await store.upsertGame({ ...data.games[0], id: 'sample', path: gamePath, storeId: '9ZZZZZZZZZZZ', executable: 'Game.exe', installState: 'ready' });
  await import('./index.js');
  await vi.waitFor(() => expect(h.handlers.has('start-install')).toBe(true));
});
afterAll(async () => {
  h.game?.finish(); for (const job of h.downloads) job.finish(130);
  await new Promise(resolve => setTimeout(resolve, 50));
  await fs.rm(h.root, { recursive: true, force: true });
});

it('runs real queue IPC, pause/cancel/failure/restart and simultaneous play/download safely', async () => {
  const first = await install('A'); await vi.waitFor(() => expect(h.downloads).toHaveLength(1));
  await ipc('launch-game', 'sample'); expect(snapshot().gameOperation.status).toBe('running');
  const cancel = await install('B'), next = await install('C');
  expect(h.downloads).toHaveLength(1); expect(snapshot().downloads.find((task: any) => task.id === next).status).toBe('queued');
  await expect(install('C')).rejects.toThrow('already in');
  await expect(install('D', path.join(h.root, 'installed-game', 'nested'))).rejects.toThrow('overlaps');
  await expect(ipc('update-installed-game', 'sample')).rejects.toThrow('Another Xodus');
  await expect(ipc('update-settings', { market: 'GB' })).rejects.toThrow('Another Xodus');
  await ipc('cancel-download', cancel); h.downloads[0].finish(1);
  await vi.waitFor(() => expect(h.downloads).toHaveLength(2));
  expect(h.downloads[1].args[1]).toBe('9CCCCCCCCCCC');
  expect(snapshot().downloads.find((task: any) => task.id === first).status).toBe('failed');
  h.downloads[1].progress(); await ipc('pause-download', next);
  expect(snapshot().downloads.find((task: any) => task.id === next).status).toBe('paused');
  const fourth = await install('D'); expect(h.downloads).toHaveLength(2);
  await ipc('resume-download', next); h.downloads[1].progress(false, 'complete'); h.downloads[1].finish(0);
  await vi.waitFor(() => expect(h.downloads).toHaveLength(3));
  expect(h.downloads[2].args[1]).toBe('9DDDDDDDDDDD'); expect(snapshot().gameOperation.status).toBe('running');
  await install('E');
  const restarted = new StateStore(path.join(h.root, 'userData')); await restarted.load();
  expect(restarted.downloads.filter(task => task.status === 'paused')).toHaveLength(2);
  await ipc('cancel-download', fourth); await vi.waitFor(() => expect(h.downloads).toHaveLength(4));
  // Closing stops advancement, even when process termination finishes later.
  await install('F'); const preventDefault = vi.fn(); h.events.get('before-quit')!({ preventDefault });
  await vi.waitFor(() => expect(h.quit).toHaveBeenCalled()); expect(preventDefault).toHaveBeenCalled();
  expect(h.downloads).toHaveLength(4);
});
