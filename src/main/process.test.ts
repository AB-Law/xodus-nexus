import { describe, expect, it } from 'vitest';
import { resolveScriptCommand, spawnTracked, wrapForTerminal } from './process.js';

describe('tracked terminal output', () => {
  it('emits carriage-return updates from a pseudo-terminal', async () => {
    const lines: string[] = [];
    const tracked = spawnTracked('printf', ['Downloading 1 MiB/10 MiB 10%%\rDownloading 5 MiB/10 MiB 50%%\n'], {
      terminal: true,
      onLine: (line) => lines.push(line),
    });
    const result = await tracked.result;
    expect(result.code).toBe(0);
    expect(lines.some((line) => line.includes('1 MiB/10 MiB'))).toBe(true);
    expect(lines.some((line) => line.includes('5 MiB/10 MiB'))).toBe(true);
  });

  it('preserves paths with apostrophes without interpreting them as shell code', async () => {
    const tracked = spawnTracked('printf', ['%s\n', "a'b; echo UNSAFE"], { terminal: true });
    const result = await tracked.result;
    expect(result.code).toBe(0);
    expect(result.output).toContain("a'b; echo UNSAFE");
  });
});

describe('wrapForTerminal', () => {
  it('wraps the command for script(1) with quoted arguments', () => {
    const wrapped = wrapForTerminal('printf', ["a'b; echo UNSAFE"], '/usr/bin/script');
    expect(wrapped.command).toBe('/usr/bin/script');
    expect(wrapped.args).toEqual(['-q', '-f', '-e', '-c', "'printf' 'a'\\''b; echo UNSAFE'", '/dev/null']);
  });

  it('passes the command through unchanged when script(1) is unavailable', () => {
    const passthrough = wrapForTerminal('xodus-cli', ['streaming', 'a b'], null);
    expect(passthrough).toEqual({ command: 'xodus-cli', args: ['streaming', 'a b'] });
  });
});

describe('resolveScriptCommand', () => {
  it('returns an executable path or null, never a bare name', () => {
    const script = resolveScriptCommand();
    if (script !== null) expect(script).toContain('/');
  });
});
