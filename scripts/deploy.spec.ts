import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as deploy from './deploy';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  lstatSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  renameSync: vi.fn(),
  chmodSync: vi.fn(),
}));

const TARGET = deploy.IS_WINDOWS ? 'x86_64-pc-windows-msvc' : (process.platform === 'darwin' && process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-unknown-linux-gnu');

function expectExec(contains: string) {
  const calls = vi.mocked(child_process.execSync).mock.calls;
  const match = calls.some(call => typeof call[0] === 'string' && call[0].includes(contains));
  if (!match) throw new Error(`Expected execSync to be called with command containing: ${contains}`);
}

function expectNotExec(contains: string) {
  const calls = vi.mocked(child_process.execSync).mock.calls;
  const match = calls.some(call => typeof call[0] === 'string' && call[0].includes(contains));
  if (match) throw new Error(`Expected execSync NOT to be called with command containing: ${contains}`);
}

describe('deploy.ts coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runSync executes command and handles errors', () => {
    deploy.runSync('echo "test"');
    expectExec('echo "test"');

    vi.mocked(child_process.execSync).mockImplementationOnce(() => { throw new Error('fail'); });
    deploy.runSync('badcmd');
    expect(process.exit).toHaveBeenCalledWith(1);

    vi.mocked(child_process.execSync).mockImplementationOnce(() => { throw new Error('fail'); });
    deploy.runSync('badcmd', undefined, true);
    expect(process.exit).toHaveBeenCalledTimes(1);
  });

  it('hasCommand returns true if command exists', () => {
    vi.mocked(child_process.execSync).mockReturnValueOnce(Buffer.from('ok'));
    expect(deploy.hasCommand('exists')).toBe(true);

    vi.mocked(child_process.execSync).mockImplementationOnce(() => { throw new Error(); });
    expect(deploy.hasCommand('missing')).toBe(false);
  });

  it('ensureWait4x installs if missing', () => {
    vi.mocked(child_process.execSync).mockImplementationOnce(() => { throw new Error(); });
    deploy.ensureWait4x();
    expectExec('wait4x install wait4x');

    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockReturnValueOnce(Buffer.from('ok'));
    deploy.ensureWait4x();
    expectNotExec('wait4x install wait4x');
  });

  it('ensureDependencies provisions DBs', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('where') || cmd.includes('command -v')) throw new Error();
      if (cmd.includes('postgres test postgres')) throw new Error();
      if (cmd.includes('valkey test valkey')) throw new Error();
      if (cmd.includes('redis test redis')) throw new Error();
      return Buffer.from('');
    });
    deploy.ensureDependencies();
    expectExec('rust install rust');
    expectExec('postgres install postgres');
    expectExec('valkey install valkey');

    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    deploy.ensureDependencies();
    expect(console.log).toHaveBeenCalledWith('PostgreSQL is already installed.');
    expect(console.log).toHaveBeenCalledWith('Valkey is already installed.');
  });

  it('ensureDependencies falls back to Redis if Valkey missing', () => {
      vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
          if (cmd.includes('valkey test valkey')) throw new Error();
          return Buffer.from('ok');
      });
      deploy.ensureDependencies();
      expect(console.log).toHaveBeenCalledWith('Redis is already installed.');
  });

  it('setupDatabases executes wait4x and creates DB', () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    deploy.setupDatabases();
    expectExec('wait4x postgresql');
    expectExec('psql');
  });

  it('getOrBuildRustService downloads tar.gz', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('curl -sL https')) {
        return Buffer.from(JSON.stringify({
          assets: [{ name: `app-${TARGET}.tar.gz`, browser_download_url: 'http://url' }]
        }));
      }
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue(['extracted_bin'] as any);
    vi.mocked(fs.lstatSync).mockReturnValue({ isDirectory: () => false } as any);

    deploy.getOrBuildRustService('test-repo', '/tmp');
    expectExec('tar -xf');
  });

  it('getOrBuildRustService downloads zip', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('curl -sL https')) {
        return Buffer.from(JSON.stringify({
          assets: [{ name: `app-${TARGET}.zip`, browser_download_url: 'http://url' }]
        }));
      }
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue(['extracted_bin.exe'] as any);

    deploy.getOrBuildRustService('test-repo', '/tmp');
    expectExec('tar -xf');
  });

  it('getOrBuildRustService downloads plain binary', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('curl -sL https')) {
        return Buffer.from(JSON.stringify({
          assets: [{ name: `app-${TARGET}`, browser_download_url: 'http://url' }]
        }));
      }
      return Buffer.from('');
    });

    deploy.getOrBuildRustService('test-repo', '/tmp');
    expect(fs.renameSync).toHaveBeenCalled();
  });

  it('getOrBuildRustService fallback to cargo build', () => {
    vi.mocked(child_process.execSync).mockImplementation(() => { throw new Error('curl failed'); });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    deploy.getOrBuildRustService('test-repo', '/tmp');
    expectExec('cargo build');

    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation(() => { throw new Error('curl failed'); });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    deploy.getOrBuildRustService('test-repo', '/tmp');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping build.'));
  });

  it('getOrBuildRustService handles 404 missing asset', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('curl -sL https')) return Buffer.from(JSON.stringify({ assets: [] }));
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    deploy.getOrBuildRustService('test-repo', '/tmp');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Asset for triplet'));
  });

  it('buildMicroservices processes all services', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.lstatSync).mockReturnValue({ isDirectory: () => true } as any);

    deploy.buildMicroservices();
    expectExec('npm install');

    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockImplementation((path) => path.toString().includes('binDir') ? true : false);
    deploy.buildMicroservices();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('not found, skipping'));
  });

  it('exportInfrastructure runs package_as', () => {
    deploy.exportInfrastructure();
    expectExec('package-as docker');
  });

  it('main handles success and errors', () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    deploy.main();
    expect(console.log).toHaveBeenCalledWith('Deployment script completed successfully.');

    vi.mocked(child_process.execSync).mockImplementation(() => { throw new Error('fail'); });
    deploy.main();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
