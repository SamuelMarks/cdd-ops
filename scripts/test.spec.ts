/**
 * @file Comprehensive unit tests for `scripts/test.ts`, `scripts/lib/ports.ts`, and `scripts/lib/exec.ts`.
 * @module scripts/test.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as child_process from 'node:child_process';
import { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import { EOL } from 'node:os';
import * as testScript from './test';
import { resolveConfig } from './lib/constants';
import { parsePosixLsofPids, parseWindowsNetstatPids } from './lib/ports';
import { OpsConfig } from './lib/types';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  lstatSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  renameSync: vi.fn(),
  chmodSync: vi.fn(),
}));

/**
 * Creates a mocked {@link ChildProcess} backed by an {@link EventEmitter}.
 * @param pid - Process ID to assign to the mock child process.
 * @param killImpl - Optional custom implementation for `child.kill()`.
 * @returns A mocked {@link ChildProcess} instance.
 */
function createMockChildProcess(pid: number = 1234, killImpl?: () => boolean): ChildProcess {
  const emitter = new EventEmitter();
  const child = Object.assign(emitter, {
    pid,
    kill: vi.fn(killImpl ?? (() => true)),
  });
  return child as unknown as ChildProcess;
}

/**
 * Creates a test {@link OpsConfig} for the specified OS platform and environment.
 * @param osPlatform - Target OS platform (`linux`, `darwin`, `win32`).
 * @param env - Environment variable overrides.
 * @returns A resolved {@link OpsConfig} instance.
 */
function makeConfig(osPlatform: NodeJS.Platform = 'linux', env: NodeJS.ProcessEnv = {}): OpsConfig {
  return resolveConfig(env, osPlatform, 'x64');
}

/**
 * Asserts that `child_process.execSync` was invoked with a command containing `substring`.
 * @param substring - Expected command substring.
 */
function expectExec(substring: string): void {
  const calls = vi.mocked(child_process.execSync).mock.calls;
  const matched = calls.some((call) => typeof call[0] === 'string' && call[0].includes(substring));
  expect(matched).toBe(true);
}

describe('scripts/lib/ports.ts & scripts/test.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.mocked(child_process.spawn).mockImplementation(() => createMockChildProcess(4321));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses Windows netstat and POSIX lsof output accurately across LF and CRLF', () => {
    const crlf = String.fromCharCode(13, 10);
    const netstatOut = [
      '  TCP    0.0.0.0:8081           0.0.0.0:0              LISTENING       0',
      '  TCP    0.0.0.0:8081           0.0.0.0:0              LISTENING       5544',
      '  TCP    0.0.0.0:9999           0.0.0.0:0              LISTENING       7788',
      '  short line',
    ].join(crlf);
    expect(parseWindowsNetstatPids(netstatOut, 8081)).toEqual(['5544']);

    expect(parsePosixLsofPids('')).toEqual([]);
    expect(parsePosixLsofPids(`  ${EOL}  `)).toEqual([]);
    expect(parsePosixLsofPids(['1001', '1002', ''].join(EOL))).toEqual(['1001', '1002']);
  });

  it('killPorts terminates processes on both Windows and POSIX and ignores unused ports', () => {
    // POSIX with active PIDs and empty output
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('lsof -Pi :8081')) {
        return Buffer.from(['111', '222', ''].join(EOL));
      }
      if (cmd.includes('lsof -Pi :8082')) {
        return Buffer.from('');
      }
      if (cmd.includes('lsof')) {
        throw new Error('not listening');
      }
      return Buffer.from('');
    });
    testScript.killPorts(makeConfig('linux'));
    expectExec('kill -9 111 222');

    // Windows with netstat and taskkill
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('findstr :8081')) {
        return Buffer.from(`  TCP    0.0.0.0:8081    0.0.0.0:0    LISTENING    9876${EOL}`);
      }
      if (cmd.includes('findstr')) {
        throw new Error('no match');
      }
      return Buffer.from('');
    });
    testScript.killPorts(makeConfig('win32'));
    expectExec('taskkill /F /PID 9876');

    // Default config invocation
    testScript.killPorts();
  });

  it('runAsync spawns child processes on POSIX and Windows and logs spawn errors', () => {
    const mockChild = createMockChildProcess(1111);
    vi.mocked(child_process.spawn).mockReturnValueOnce(mockChild);
    const returned = testScript.runAsync('npm', ['run', 'serve'], undefined, {}, false);
    expect(returned).toBe(mockChild);
    expect(child_process.spawn).toHaveBeenCalledWith(
      'npm',
      ['run', 'serve'],
      expect.objectContaining({ shell: undefined }),
    );

    const spawnErr = new Error('ENOENT');
    mockChild.emit('error', spawnErr);
    expect(console.error).toHaveBeenCalledWith('Failed to start process npm:', spawnErr);

    vi.mocked(child_process.spawn).mockReturnValueOnce(mockChild);
    testScript.runAsync('npm', ['run', 'serve'], '/tmp', { FOO: 'bar' }, true);
    expect(child_process.spawn).toHaveBeenCalledWith(
      'npm',
      ['run', 'serve'],
      expect.objectContaining({ shell: true }),
    );
  });

  it('ensureWait4x delegates to shared implementation', () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    testScript.ensureWait4x();
    testScript.ensureWait4x(makeConfig('linux'));
    expectExec('command -v wait4x');
  });

  it('ensureDependencies handles CI skip, running DBs, installed DBs, and missing packages', () => {
    // Skip when GITHUB_ACTIONS is set
    testScript.ensureDependencies(makeConfig('linux', { GITHUB_ACTIONS: 'true' }));
    expect(child_process.execSync).not.toHaveBeenCalled();

    // Everything already installed and running
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    testScript.ensureDependencies(makeConfig('linux', {}));
    expect(console.log).toHaveBeenCalledWith('Rust is already installed.');
    expect(console.log).toHaveBeenCalledWith('Node.js is already installed.');
    expect(console.log).toHaveBeenCalledWith('PostgreSQL is already running on localhost:5432.');
    expect(console.log).toHaveBeenCalledWith('Redis/Valkey is already running on localhost:6379.');

    // Nothing running, nothing installed -> installs rust, nodejs, postgres, valkey
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('test ') || cmd.includes('wait4x tcp') || cmd.includes('command -v')) {
        throw new Error('not running/installed');
      }
      return Buffer.from('ok');
    });
    testScript.ensureDependencies(makeConfig('linux', {}));
    expectExec('install rust latest');
    expectExec('install nodejs latest');
    expectExec('install postgres latest');
    expectExec('install valkey latest');

    // DBs not running, but postgres & redis packages are installed
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('wait4x tcp')) {
        throw new Error('not running');
      }
      return Buffer.from('ok');
    });
    testScript.ensureDependencies();
    expect(console.log).toHaveBeenCalledWith('PostgreSQL is already installed.');
    expect(console.log).toHaveBeenCalledWith('Redis/Valkey is already installed.');
  });

  it('setupDatabases waits for Postgres/Redis, installs diesel_cli if missing, and runs migrations', () => {
    // When diesel is missing
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('command -v diesel')) {
        throw new Error('no diesel');
      }
      return Buffer.from('ok');
    });
    testScript.setupDatabases(makeConfig('linux'));
    expectExec('wait4x postgresql');
    expectExec('wait4x redis');
    expectExec('cargo install diesel_cli');
    expectExec('diesel migration run');

    // When diesel is already installed
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    testScript.setupDatabases();
    expectExec('diesel migration run');
  });

  it('getOrBuildRustService resolves binary or falls back to cargo build', () => {
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw new Error('offline');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const res = testScript.getOrBuildRustService('cdd-gateway', '/tmp/bin', { FOO: '1' });
    expect(res.cmd).toBe('cargo');
    expect(res.args).toEqual(['run', '--bin', 'cdd-gateway']);
  });

  it('patchWebUiWasmScript idempotently patches build-wasm.mjs when present', () => {
    // File does not exist
    vi.mocked(fs.existsSync).mockReturnValue(false);
    testScript.patchWebUiWasmScript('/missing/build-wasm.mjs');
    expect(fs.writeFileSync).not.toHaveBeenCalled();

    // File exists and contains unpatched header
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      "fetch(url, { headers: { 'User-Agent': 'node.js' } });",
    );
    testScript.patchWebUiWasmScript('/path/build-wasm.mjs');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/path/build-wasm.mjs',
      expect.stringContaining('process.env.GITHUB_TOKEN'),
    );

    // File already patched
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('already has process.env.GITHUB_TOKEN');
    testScript.patchWebUiWasmScript('/path/build-wasm.mjs');
    expect(fs.writeFileSync).not.toHaveBeenCalled();

    // File exists without matching pattern
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('console.log("no headers pattern");');
    testScript.patchWebUiWasmScript('/path/build-wasm.mjs');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('buildAndStartServices builds and spawns all 5 background services', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(
          JSON.stringify({
            assets: [
              {
                name: 'bin-x86_64-unknown-linux-gnu',
                browser_download_url: 'https://example.com/bin',
              },
            ],
          }),
        );
      }
      return Buffer.from('ok');
    });

    const procs = testScript.buildAndStartServices(makeConfig('linux'));
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(procs).toHaveLength(5);

    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('process.env.GITHUB_TOKEN');
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(
          JSON.stringify({
            assets: [
              {
                name: 'bin-x86_64-unknown-linux-gnu',
                browser_download_url: 'https://example.com/bin',
              },
            ],
          }),
        );
      }
      return Buffer.from('ok');
    });
    const procsExisting = testScript.buildAndStartServices();
    expect(procsExisting).toHaveLength(5);
  });

  it('runE2eTests runs wait4x and playwright and exits on test failure', () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    testScript.runE2eTests();
    expectExec('wait4x http');
    expectExec('npx playwright test');

    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'npx playwright test') {
        throw new Error('e2e failure');
      }
      return Buffer.from('ok');
    });
    testScript.runE2eTests(makeConfig('linux'));
    expect(console.error).toHaveBeenCalledWith('Command failed: npx playwright test');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('cleanupProcesses kills processes on POSIX and Windows and ignores dead processes', () => {
    const aliveProc = createMockChildProcess(101);
    const deadProc = createMockChildProcess(102, () => {
      throw new Error('ESRCH');
    });
    testScript.cleanupProcesses([aliveProc, deadProc], false);
    expect(aliveProc.kill).toHaveBeenCalledWith('SIGKILL');

    vi.clearAllMocks();
    testScript.cleanupProcesses([aliveProc], true);
    expectExec('taskkill /pid 101 /T /F');
  });

  it('main and runIfMain orchestrate full E2E run, signals, and error recovery', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('process.env.GITHUB_TOKEN');
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(
          JSON.stringify({
            assets: [
              {
                name: 'bin-x86_64-unknown-linux-gnu',
                browser_download_url: 'https://example.com/bin',
              },
            ],
          }),
        );
      }
      return Buffer.from('ok');
    });

    // Capture registered SIGINT handler and invoke it during runE2eTests to verify signal cleanup
    const onSpy = vi.spyOn(process, 'on');
    testScript.runIfMain(true);
    expect(console.log).toHaveBeenCalledWith('Tests completed successfully.');
    expect(process.exit).toHaveBeenCalledWith(0);

    const sigintCall = onSpy.mock.calls.find((call) => call[0] === 'SIGINT');
    expect(sigintCall).toBeDefined();
    const signalHandler = sigintCall?.[1] as (() => void) | undefined;
    if (signalHandler) {
      signalHandler();
      expect(process.exit).toHaveBeenCalledWith(1);
    }

    vi.clearAllMocks();
    testScript.runIfMain(false);
    expect(console.log).not.toHaveBeenCalled();

    // Error thrown inside main() logs formatted error and exits with 1
    vi.mocked(fs.existsSync).mockImplementation(() => {
      throw new Error('fatal setup error');
    });
    testScript.main(makeConfig('linux', { GITHUB_ACTIONS: 'true' }));
    expect(console.error).toHaveBeenCalledWith('Test execution failed:', 'fatal setup error');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
