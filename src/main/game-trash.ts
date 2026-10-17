import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import { externalLauncherEnvironment } from './launcher-environment.js';

const execute = promisify(execFile);
type TrashOptions = {
  platform?: NodeJS.Platform;
  gio?: (target: string) => Promise<void>;
};

async function gioTrash(target: string): Promise<void> {
  await execute('/usr/bin/gio', ['trash', '--', target], {
    env: externalLauncherEnvironment(), timeout: 60_000, maxBuffer: 16_384,
  });
}

/** The caller validates the game directory and holds the removal lock. Never
 * substitute permanent deletion for Trash or retry a changed/partly moved path. */
export async function moveGameToTrash(target: string, nativeTrash: (target: string) => Promise<void>, options: TrashOptions = {}): Promise<void> {
  const before = await fs.lstat(target);
  try { await nativeTrash(target); return; }
  catch (original) {
    if ((options.platform ?? process.platform) !== 'linux') throw original;
    const after = await fs.lstat(target).catch(() => undefined);
    if (!after || !after.isDirectory() || after.isSymbolicLink() || before.dev !== after.dev || before.ino !== after.ino) {
      throw Error('Trash reported an error and the game folder changed. The library entry was kept. Check the folder and Trash before retrying.');
    }
    try { await (options.gio ?? gioTrash)(target); }
    catch (error) {
      const detail = error as { stderr?: string; message?: string; code?: string };
      const reason = detail.code === 'ENOENT' ? 'The alternative system Trash helper (gio) is not installed.'
        : (detail.stderr?.trim() || detail.message || 'The system Trash service rejected the move.').slice(0, 700);
      throw Error(`Could not move the game folder to Trash. ${reason} The library entry was kept. You can use Keep files or try moving the folder with your file manager.`);
    }
  }
}
