import { constants, promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Game } from '../shared/types.js';

export type ShortcutDestination = 'desktop' | 'applications';
const validId = (id: string) => /^[a-f0-9]{16}$/.test(id);
const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
const desktopValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
// Desktop Exec is NOT a shell command. Escape both the value and Exec layers.
export const desktopArgument = (value: string) => desktopValue(`"${value.replace(/%/g, '%%').replace(/["`$\\]/g, '\\$&')}"`);

export function shortcutArguments(argv: string[]): { gameId?: string; profile?: string } {
  const result: { gameId?: string; profile?: string } = {};
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag !== '--launch-game' && flag !== '--nexus-profile') continue;
    const value = argv[++index];
    if (flag === '--launch-game') {
      if (result.gameId || !value || !validId(value)) throw new Error('Invalid game shortcut ID.');
      result.gameId = value;
    } else {
      if (result.profile || !value || !path.isAbsolute(value) || /[\0\r\n]/.test(value)) throw new Error('Invalid Nexus profile path.');
      result.profile = value;
    }
  }
  return result;
}

interface Locations { userData: string; desktop: string; applications: string; launcher?: string; icon: string }
export class GameShortcuts {
  private entry?: string;
  private icon?: string;
  private readonly profileId: string;
  constructor(private locations: Locations) {
    this.profileId = createHash('sha256').update(path.resolve(locations.userData)).digest('hex').slice(0, 12);
  }
  get available(): boolean { return Boolean(this.entry); }
  get reason(): string | undefined { return this.available ? undefined : 'Shortcuts require an installed Linux launcher or AppImage with a persistent executable path.'; }
  private get marker(): string { return `X-Xodus-Nexus-Profile=${this.profileId}`; }

  private async directory(directory: string): Promise<void> {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o022))
      throw new Error('Shortcut directory must be owned by your user and not writable by others.');
  }
  private async write(file: string, bytes: string | Buffer, mode: number, marker?: string): Promise<void> {
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o022) ||
          (marker && !(await fs.readFile(file, 'utf8')).split('\n').includes(marker)))
        throw new Error('Refusing to replace an unrelated or unsafe shortcut file.');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const temporary = `${file}.${randomUUID()}`;
    try {
      await fs.writeFile(temporary, bytes, { flag: 'wx', mode });
      await fs.rename(temporary, file);
    } finally { await fs.rm(temporary, { force: true }); }
  }
  async initialize(): Promise<void> {
    if (!this.locations.launcher) return;
    const launcher = await fs.realpath(this.locations.launcher);
    if (/[\0\r\n]/.test(launcher) || !path.isAbsolute(launcher) || !(await fs.stat(launcher)).isFile()) throw new Error('Invalid launcher executable.');
    await fs.access(launcher, constants.X_OK);
    const directory = path.join(this.locations.userData, 'shortcuts');
    await this.directory(directory);
    const entry = path.join(directory, 'launch-game');
    // No tokens or runtime paths in shortcuts. Refresh after moving/updating the app.
    const body = `#!/bin/sh\n# ${this.marker}\nunset APPIMAGE APPDIR ARGV0 OWD ELECTRON_RUN_AS_NODE VITE_DEV_SERVER_URL XODUS_DEMO XODUS_DEMO_TOUR XODUS_DEMO_CAPTURE_DIR XODUS_SMOKE_SCREENSHOT\nexec ${shellQuote(launcher)} --nexus-profile ${shellQuote(this.locations.userData)} --launch-game "$@"\n`;
    await this.write(entry, body, 0o700, `# ${this.marker}`);
    const icon = path.join(directory, 'nexus.png');
    await this.write(icon, await fs.readFile(this.locations.icon), 0o600);
    this.entry = entry; this.icon = icon;
  }
  private filename(id: string): string {
    if (!validId(id)) throw new Error('Invalid game shortcut ID.');
    return `xodus-nexus-${this.profileId}-${id}.desktop`;
  }
  async create(game: Pick<Game, 'id' | 'title' | 'installState'>, destination: ShortcutDestination, png?: Buffer): Promise<string> {
    if (!this.entry || !this.icon) throw new Error(this.reason);
    if (destination !== 'desktop' && destination !== 'applications') throw new Error('Invalid shortcut destination.');
    if (game.installState !== 'ready') throw new Error('Only installed, ready games can have launch shortcuts.');
    const directory = this.locations[destination];
    await this.directory(directory);
    const target = path.join(directory, this.filename(game.id));
    const iconDirectory = path.join(this.locations.userData, 'shortcuts', 'icons');
    const gameIcon = path.join(iconDirectory, `${game.id}.png`);
    let icon = this.icon;
    if (png?.length && png.length <= 4 * 1024 * 1024 && png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
      await this.directory(iconDirectory);
      await this.write(gameIcon, png, 0o600);
      icon = gameIcon;
    } else {
      try {
        const stat = await fs.lstat(gameIcon);
        if (stat.isFile() && stat.uid === process.getuid?.() && !(stat.mode & 0o022) && stat.size <= 4 * 1024 * 1024 &&
            (await fs.readFile(gameIcon)).subarray(0, 8).toString('hex') === '89504e470d0a1a0a') icon = gameIcon;
      } catch { /* No cached artwork, keep the Nexus fallback. */ }
    }
    const title = game.title.replace(/[\0\r\n\t]/g, ' ').trim() || 'Xodus Nexus game';
    // Keep the executable field constant: desktop loaders may check it before
    // expanding %% in arguments. /bin/sh runs a file, never a shell -c string.
    const body = `[Desktop Entry]\nType=Application\nVersion=1.0\nName=${desktopValue(title)}\nComment=Play with Xodus Nexus\nExec=/bin/sh ${desktopArgument(this.entry)} ${desktopArgument(game.id)}\nIcon=${desktopValue(icon)}\nTerminal=false\nCategories=Game;\nStartupNotify=false\n${this.marker}\n`;
    await this.write(target, body, destination === 'desktop' ? 0o755 : 0o644, this.marker);
    return target;
  }
  async remove(id: string): Promise<void> {
    for (const directory of [this.locations.desktop, this.locations.applications]) {
      const target = path.join(directory, this.filename(id));
      try {
        const stat = await fs.lstat(target);
        if (stat.isFile() && stat.uid === process.getuid?.() && !(stat.mode & 0o022) &&
            (await fs.readFile(target, 'utf8')).split('\n').includes(this.marker)) await fs.unlink(target);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
}
