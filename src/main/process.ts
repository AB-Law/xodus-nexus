import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { accessSync, constants as fsConstants } from 'node:fs';
import { stripAnsi } from '../shared/utils.js';

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onLine?: (line: string) => void;
  maxOutput?: number;
  terminal?: boolean;
  /** Give a game its own Linux process group; downloads retain their defaults. */
  detached?: boolean;
  /** Optional bounded drain after the child exits but inherited pipes stay open. */
  outputDrainMs?: number;
}

export interface RunResult {
  code: number;
  output: string;
}

// util-linux script(1) locations, tried before a PATH lookup. A process
// launched from the desktop can carry a minimal PATH, so resolving the PTY
// wrapper by absolute path keeps downloads working there.
const SCRIPT_PATHS = ['/usr/bin/script', '/bin/script', '/usr/local/bin/script'];

export function resolveScriptCommand(): string | null {
  const pathDirs = (process.env.PATH ?? '').split(':').filter(Boolean);
  const candidates = [...SCRIPT_PATHS, ...pathDirs.map((dir) => `${dir}/script`)];
  for (const candidate of candidates) {
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Try the next known location.
    }
  }
  return null;
}

// Wrap a command for script(1) so indicatif keeps rendering progress bars.
// When script(1) is unavailable the command runs directly: the progress bars
// disappear, but the download itself proceeds instead of failing outright.
export function wrapForTerminal(
  command: string,
  args: string[],
  scriptCommand: string | null,
): { command: string; args: string[] } {
  if (!scriptCommand) return { command, args };
  const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
  return {
    command: scriptCommand,
    args: ['-q', '-f', '-e', '-c', [command, ...args].map(shellQuote).join(' '), '/dev/null'],
  };
}

export function spawnTracked(command: string, args: string[], options: RunOptions = {}): {
  child: ChildProcessWithoutNullStreams;
  result: Promise<RunResult>;
} {
  // indicatif deliberately hides progress bars when stdout is a pipe. Give only
  // streaming downloads a PTY; other Xodus commands keep their direct spawn.
  const actual = options.terminal ? wrapForTerminal(command, args, resolveScriptCommand()) : { command, args };
  const child = spawn(actual.command, actual.args, {
    cwd: options.cwd,
    env: options.terminal ? { ...(options.env ?? process.env), TERM: 'xterm' } : options.env ?? process.env,
    shell: false,
    detached: options.detached ?? false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const chunks: string[] = [];
  const max = options.maxOutput ?? 2_000_000;
  let chunksLength = 0;
  let buffered = '';
  const consume = (chunk: Buffer) => {
    const clean = stripAnsi(chunk.toString('utf8'));
    buffered += clean;
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (line) options.onLine?.(line);
    }
    chunks.push(clean);
    chunksLength += clean.length;
    while (chunksLength > max && chunks.length > 1) chunksLength -= chunks.shift()!.length;
  };
  child.stdout.on('data', consume);
  child.stderr.on('data', consume);
  const result = new Promise<RunResult>((resolve, reject) => {
    let finished = false;
    let drain: ReturnType<typeof setTimeout> | undefined;
    const finish = (code: number | null) => {
      if (finished) return;
      finished = true;
      if (drain) clearTimeout(drain);
      if (buffered.trim()) options.onLine?.(buffered.trimEnd());
      buffered = '';
      resolve({ code: code ?? -1, output: chunks.join('') });
    };
    child.once('error', (error) => {
      finished = true;
      if (drain) clearTimeout(drain);
      reject(error);
    });
    child.once('exit', (code) => {
      if (options.outputDrainMs === undefined || finished) return;
      drain = setTimeout(() => {
        // Only selected callers opt in. An inherited pipe is not evidence that
        // its original process is still alive; retain the real exit status.
        child.stdout.destroy();
        child.stderr.destroy();
        child.stdin.destroy();
        finish(code);
      }, options.outputDrainMs);
    });
    child.once('close', (code) => {
      finish(code);
    });
  });
  return { child, result };
}

export async function run(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  return spawnTracked(command, args, options).result;
}
