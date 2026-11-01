/**
 * @file Comprehensive unit tests for `scripts/deploy.ts` and shared `scripts/lib/*` modules.
 * @module scripts/deploy.spec
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import { Stats } from 'node:fs';
import { join } from 'node:path';
import * as deploy from './deploy';
import {
  buildServiceEnv,
  CDD_COMPILER_REPOS,
  CDD_DOC_HOSTING_TARGETS,
  CDD_REGISTRY_TYPES,
  CDD_SPEC_FORMATS,
  CDD_TARGET_LANGUAGES,
  CDD_WASM_ARTIFACTS,
  DEFAULT_WASM_DIR,
  formatAllSdkPolyrepoNames,
  formatSdkMonorepoName,
  formatSdkPolyrepoName,
  LIBSCRIPT_CMD,
  LIBSCRIPT_SH,
  PARENT_DIR,
  REPO_ROOT,
  resolveConfig,
  selectLibscript,
} from './lib/constants';
import { resolveTargetTriplet, findExtractedBinary, getOrBuildRustService } from './lib/rust-service';
import {
  formatError,
  isCddDocHostingTarget,
  isCddRegistryType,
  isCddSpecFormat,
  isCddTargetLanguage,
  isGitHubRelease,
  isGitHubReleaseAsset,
  isPackageFormat,
  OpsConfig,
  PACKAGE_FORMATS,
} from './lib/types';
import {
  provisionValkeyOrRedis,
  ensureWait4x as ensureWait4xDirect,
  ensureDependencies as ensureDependenciesDirect,
  setupDatabases as setupDatabasesDirect,
  runLibscriptDbAction,
} from './lib/dependencies';
import libscriptManifest from '../libscript.json';
import packagingManifest from '../packaging.json';

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

/**
 * Creates a strongly-typed mock `fs.Stats` instance returning the specified `isDirectory` value.
 * @param isDir - Whether the mocked filesystem entry is a directory.
 * @returns A mocked {@link Stats} object.
 */
function createMockStats(isDir: boolean): Stats {
  return {
    isDirectory: () => isDir,
  } as unknown as Stats;
}

/**
 * Creates a test {@link OpsConfig} for the specified OS platform and architecture.
 * @param osPlatform - Target OS platform (`linux`, `darwin`, `win32`).
 * @param arch - Target CPU architecture (`x64`, `arm64`).
 * @param env - Optional environment variable overrides.
 * @returns A resolved {@link OpsConfig} instance.
 */
function makeConfig(
  osPlatform: NodeJS.Platform = 'linux',
  arch: string = 'x64',
  env: NodeJS.ProcessEnv = {},
): OpsConfig {
  return resolveConfig(env, osPlatform, arch);
}

/**
 * Asserts that `child_process.execSync` was invoked with a command string containing `substring`.
 * @param substring - Expected command substring.
 */
function expectExec(substring: string): void {
  const calls = vi.mocked(child_process.execSync).mock.calls;
  const matched = calls.some((call) => typeof call[0] === 'string' && call[0].includes(substring));
  expect(matched).toBe(true);
}

/**
 * Asserts that `child_process.execSync` was never invoked with a command string containing `substring`.
 * @param substring - Forbidden command substring.
 */
function expectNotExec(substring: string): void {
  const calls = vi.mocked(child_process.execSync).mock.calls;
  const matched = calls.some((call) => typeof call[0] === 'string' && call[0].includes(substring));
  expect(matched).toBe(false);
}

describe('scripts/lib/types.ts & scripts/lib/constants.ts', () => {
  it('validates GitHubReleaseAsset, GitHubRelease, and PackageFormat type guards', () => {
    expect(isGitHubReleaseAsset(null)).toBe(false);
    expect(isGitHubReleaseAsset('invalid')).toBe(false);
    expect(isGitHubReleaseAsset({ name: 'bin' })).toBe(false);
    expect(isGitHubReleaseAsset({ name: 'bin', browser_download_url: 'https://example.com/bin' })).toBe(true);

    expect(isGitHubRelease(null)).toBe(false);
    expect(isGitHubRelease(42)).toBe(false);
    expect(isGitHubRelease({})).toBe(true);
    expect(isGitHubRelease({ assets: [{ name: 'a', browser_download_url: 'https://x' }] })).toBe(true);
    expect(isGitHubRelease({ assets: [{ name: 123 }] })).toBe(false);
    expect(isGitHubRelease({ assets: 'not-an-array' })).toBe(false);

    for (const fmt of PACKAGE_FORMATS) {
      expect(isPackageFormat(fmt)).toBe(true);
    }
    expect(isPackageFormat('unknown_format')).toBe(false);
    expect(isPackageFormat('exe')).toBe(false);
    expect(isPackageFormat('appimage')).toBe(false);
    expect(isPackageFormat('ips')).toBe(false);
    expect(isPackageFormat(123)).toBe(false);
    expect(isPackageFormat(null)).toBe(false);

    expect(CDD_TARGET_LANGUAGES).toHaveLength(13);
    expect(CDD_COMPILER_REPOS).toHaveLength(13);
    expect(CDD_WASM_ARTIFACTS).toHaveLength(13);
    for (const lang of CDD_TARGET_LANGUAGES) {
      expect(isCddTargetLanguage(lang)).toBe(true);
    }
    expect(isCddTargetLanguage('fortran')).toBe(false);
    expect(isCddTargetLanguage(42)).toBe(false);

    for (const spec of CDD_SPEC_FORMATS) {
      expect(isCddSpecFormat(spec)).toBe(true);
    }
    expect(isCddSpecFormat('wsdl')).toBe(false);
    expect(isCddSpecFormat(null)).toBe(false);

    for (const reg of CDD_REGISTRY_TYPES) {
      expect(isCddRegistryType(reg)).toBe(true);
    }
    expect(isCddRegistryType('unknown-reg')).toBe(false);
    expect(isCddRegistryType(undefined)).toBe(false);

    for (const docHost of CDD_DOC_HOSTING_TARGETS) {
      expect(isCddDocHostingTarget(docHost)).toBe(true);
    }
    expect(isCddDocHostingTarget('confluence')).toBe(false);
    expect(isCddDocHostingTarget(false)).toBe(false);

    expect(formatSdkMonorepoName('my-org')).toBe('my-org-sdk');
    expect(formatSdkPolyrepoName('my-org', 'rust')).toBe('my-org-sdk-rust');
    const polyrepos = formatAllSdkPolyrepoNames('my-org');
    expect(polyrepos).toHaveLength(13);
    expect(polyrepos).toContain('my-org-sdk-ts');
    expect(polyrepos).toContain('my-org-sdk-sh');
  });

  it('validates libscript.json and packaging.json structural contracts', () => {
    expect(libscriptManifest.$schema).toBe('../libscript/libscript.schema.json');
    expect(libscriptManifest.name).toBe('cdd');
    expect(libscriptManifest.deps).toHaveProperty('rust', 'latest');
    expect(libscriptManifest.deps).toHaveProperty('wait4x', 'latest');
    expect(libscriptManifest.vars).toHaveProperty('GITHUB_ORG_NAME', 'offscale');
    expect(libscriptManifest.frontends).toHaveLength(2);
    expect(libscriptManifest.databases).toHaveLength(2);
    expect(libscriptManifest.services).toHaveLength(7);

    const cpService = libscriptManifest.services.find((s) => s.name === 'cdd-control-plane');
    expect(cpService?.env).toHaveProperty('CDD__GOOGLE_CLIENT_ID');
    expect(cpService?.env).toHaveProperty('CDD__GITHUB_CLIENT_ID');
    const engineService = libscriptManifest.services.find((s) => s.name === 'cdd-engine');
    expect(engineService?.env).toHaveProperty('CDD__WASM_DIR');
    const publisherService = libscriptManifest.services.find((s) => s.name === 'cdd-publisher');
    expect(publisherService?.env).toHaveProperty('CDD__PGP_KEY_ID');

    expect(packagingManifest.$schema).toBe('../libscript/packaging/packaging.schema.json');
    expect(packagingManifest.name).toBe('cdd');
    expect(packagingManifest.upgrade_code).toMatch(
      /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/,
    );
    expect(packagingManifest.database_contracts).toHaveLength(2);
    expect(packagingManifest.services).toHaveLength(7);
    expect(packagingManifest.ingress.routes).toHaveLength(4);
  });

  it('parses deploy CLI arguments with parseDeployArgs', () => {
    expect(deploy.parseDeployArgs()).toEqual(['docker', 'docker_compose']);
    expect(deploy.parseDeployArgs([])).toEqual(['docker', 'docker_compose']);
    expect(deploy.parseDeployArgs(['--verbose'])).toEqual(['docker', 'docker_compose']);
    expect(deploy.parseDeployArgs(['--target', 'deb'])).toEqual(['deb']);
    expect(deploy.parseDeployArgs(['--target=msi', '--target', 'rpm', '--target=iso'])).toEqual([
      'msi',
      'rpm',
      'iso',
    ]);

    expect(() => deploy.parseDeployArgs(['--target'])).toThrow('Missing value for --target flag.');
    expect(() => deploy.parseDeployArgs(['--target', '--other'])).toThrow(
      'Missing value for --target flag.',
    );
    expect(() => deploy.parseDeployArgs(['--target', 'invalid'])).toThrow(
      'Unsupported package target format: invalid',
    );
    expect(() => deploy.parseDeployArgs(['--target=invalid'])).toThrow(
      'Unsupported package target format: invalid',
    );
  });

  it('formats Error instances and arbitrary unknown values', () => {
    expect(formatError(new Error('boom'))).toBe('boom');
    expect(formatError('plain string error')).toBe('plain string error');
    expect(formatError(500)).toBe('500');
  });

  it('resolves configuration across Windows, macOS, and Linux with custom and default env vars', () => {
    const defaultCfg = resolveConfig({}, 'linux', 'x64');
    expect(defaultCfg.isWindows).toBe(false);
    expect(defaultCfg.libscript).toBe(LIBSCRIPT_SH);
    expect(defaultCfg.pgHost).toBe('localhost');
    expect(defaultCfg.pgPort).toBe('5432');
    expect(defaultCfg.pgUser).toBe('postgres');
    expect(defaultCfg.valkeyHost).toBe('localhost');
    expect(defaultCfg.valkeyPort).toBe('6379');
    expect(defaultCfg.githubToken).toBeUndefined();
    expect(defaultCfg.isGithubActions).toBe(false);
    expect(defaultCfg.repoRoot).toBe(REPO_ROOT);
    expect(defaultCfg.parentDir).toBe(PARENT_DIR);
    expect(defaultCfg.googleClientId).toBe('dev-google-client-id');
    expect(defaultCfg.googleClientSecret).toBe('dev-google-client-secret');
    expect(defaultCfg.googleOauthUrl).toBe('https://oauth2.googleapis.com/token');
    expect(defaultCfg.googleUserinfoUrl).toBe('https://www.googleapis.com/oauth2/v3/userinfo');
    expect(defaultCfg.githubClientId).toBe('dev-github-client-id');
    expect(defaultCfg.githubClientSecret).toBe('dev-github-client-secret');
    expect(defaultCfg.githubOrgName).toBe('offscale');
    expect(defaultCfg.storageSecretKey).toBe('dev-secret-key');
    expect(defaultCfg.pgpKeyId).toBe('CDD-DEV-PGP-KEY');
    expect(defaultCfg.wasmDir).toBe(DEFAULT_WASM_DIR);

    const winCfg = resolveConfig(
      {
        POSTGRES_HOST: 'db.internal',
        POSTGRES_PORT: '5433',
        POSTGRES_USER: 'admin',
        VALKEY_HOST: 'cache.internal',
        VALKEY_PORT: '6380',
        CDD__GOOGLE_CLIENT_ID: 'goog_id',
        CDD__GOOGLE_CLIENT_SECRET: 'goog_sec',
        CDD__GOOGLE_OAUTH_URL: 'https://auth.internal/token',
        CDD__GOOGLE_USERINFO_URL: 'https://auth.internal/userinfo',
        CDD__GITHUB_CLIENT_ID: 'gh_id',
        CDD__GITHUB_CLIENT_SECRET: 'gh_sec',
        GITHUB_ORG_NAME: 'custom-org',
        CDD__STORAGE_SECRET_KEY: 's3_secret',
        CDD__PGP_KEY_ID: 'PGP-999',
        CDD__WASM_DIR: '/custom/wasm',
        GITHUB_TOKEN: 'ghp_secret',
        GITHUB_ACTIONS: 'true',
      },
      'win32',
      'x64',
    );
    expect(winCfg.isWindows).toBe(true);
    expect(winCfg.libscript).toBe(LIBSCRIPT_CMD);
    expect(winCfg.pgHost).toBe('db.internal');
    expect(winCfg.pgPort).toBe('5433');
    expect(winCfg.pgUser).toBe('admin');
    expect(winCfg.valkeyHost).toBe('cache.internal');
    expect(winCfg.valkeyPort).toBe('6380');
    expect(winCfg.databaseUrl).toBe('postgres://admin@db.internal:5433/cdd');
    expect(winCfg.redisUrl).toBe('redis://cache.internal:6380');
    expect(winCfg.googleClientId).toBe('goog_id');
    expect(winCfg.googleClientSecret).toBe('goog_sec');
    expect(winCfg.googleOauthUrl).toBe('https://auth.internal/token');
    expect(winCfg.googleUserinfoUrl).toBe('https://auth.internal/userinfo');
    expect(winCfg.githubClientId).toBe('gh_id');
    expect(winCfg.githubClientSecret).toBe('gh_sec');
    expect(winCfg.githubOrgName).toBe('custom-org');
    expect(winCfg.storageSecretKey).toBe('s3_secret');
    expect(winCfg.pgpKeyId).toBe('PGP-999');
    expect(winCfg.wasmDir).toBe('/custom/wasm');
    expect(winCfg.githubToken).toBe('ghp_secret');
    expect(winCfg.isGithubActions).toBe(true);

    const svcEnv = buildServiceEnv(winCfg);
    expect(svcEnv['CDD__GOOGLE_CLIENT_ID']).toBe('goog_id');
    expect(svcEnv['CDD__GITHUB_CLIENT_ID']).toBe('gh_id');
    expect(svcEnv['GITHUB_ORG_NAME']).toBe('custom-org');
    expect(svcEnv['CDD__STORAGE_SECRET_KEY']).toBe('s3_secret');
    expect(svcEnv['CDD__PGP_KEY_ID']).toBe('PGP-999');
    expect(svcEnv['CDD__WASM_DIR']).toBe('/custom/wasm');
  });

  it('resolves all 4 target triplets deterministically', () => {
    expect(selectLibscript(true)).toBe(LIBSCRIPT_CMD);
    expect(selectLibscript(false)).toBe(LIBSCRIPT_SH);
    expect(resolveTargetTriplet('win32', 'x64')).toBe('x86_64-pc-windows-msvc');
    expect(resolveTargetTriplet('darwin', 'arm64')).toBe('aarch64-apple-darwin');
    expect(resolveTargetTriplet('darwin', 'x64')).toBe('x86_64-apple-darwin');
    expect(resolveTargetTriplet('linux', 'x64')).toBe('x86_64-unknown-linux-gnu');
  });
});

describe('scripts/deploy.ts', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env['GITHUB_ACTIONS'];
    delete process.env['GITHUB_TOKEN'];
    delete process.env['POSTGRES_HOST'];
    delete process.env['POSTGRES_PORT'];
    delete process.env['POSTGRES_USER'];
    delete process.env['VALKEY_HOST'];
    delete process.env['VALKEY_PORT'];
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('runSync executes command and handles errors with and without ignoreError', () => {
    deploy.runSync('echo "test"');
    expectExec('echo "test"');

    vi.mocked(child_process.execSync).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    deploy.runSync('badcmd');
    expect(process.exit).toHaveBeenCalledWith(1);

    vi.mocked(child_process.execSync).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    deploy.runSync('badcmd', undefined, true);
    expect(process.exit).toHaveBeenCalledTimes(1);
  });

  it('hasCommand checks both POSIX (command -v) and Windows (where) paths', () => {
    vi.mocked(child_process.execSync).mockReturnValueOnce(Buffer.from('ok'));
    expect(deploy.hasCommand('exists', false)).toBe(true);
    expectExec('command -v exists');

    vi.mocked(child_process.execSync).mockReturnValueOnce(Buffer.from('ok'));
    expect(deploy.hasCommand('exists', true)).toBe(true);
    expectExec('where exists');

    vi.mocked(child_process.execSync).mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(deploy.hasCommand('missing', false)).toBe(false);
  });

  it('ensureWait4x installs wait4x when missing and skips when present', () => {
    const posixCfg = makeConfig('linux', 'x64');
    vi.mocked(child_process.execSync).mockImplementationOnce(() => {
      throw new Error('missing');
    });
    deploy.ensureWait4x(posixCfg);
    expectExec('install wait4x latest');

    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockReturnValueOnce(Buffer.from('ok'));
    deploy.ensureWait4x();
    vi.mocked(child_process.execSync).mockReturnValueOnce(Buffer.from('ok'));
    ensureWait4xDirect();
    expectNotExec('install wait4x latest');
  });

  it('ensureDependencies provisions toolchains and databases when missing or present', () => {
    const cfg = makeConfig('linux', 'x64');
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('where') || cmd.includes('command -v')) {
        throw new Error('no wait4x');
      }
      if (cmd.includes('test postgres')) {
        throw new Error('no postgres');
      }
      if (cmd.includes('test valkey')) {
        throw new Error('no valkey');
      }
      if (cmd.includes('test redis')) {
        throw new Error('no redis');
      }
      return Buffer.from('');
    });
    deploy.ensureDependencies(cfg);
    expectExec('install rust latest');
    expectExec('install nodejs latest');
    expectExec('install postgres latest');
    expectExec('install valkey latest');

    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    deploy.ensureDependencies();
    ensureDependenciesDirect();
    expect(console.log).toHaveBeenCalledWith('PostgreSQL is already installed.');
    expect(console.log).toHaveBeenCalledWith('Valkey is already installed.');
  });

  it('ensureDependencies falls back to Redis when Valkey is missing', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('test valkey')) {
        throw new Error('no valkey');
      }
      return Buffer.from('ok');
    });
    deploy.ensureDependencies();
    expect(console.log).toHaveBeenCalledWith('Redis is already installed.');

    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw new Error('neither installed');
    });
    provisionValkeyOrRedis('libscript.sh', true);
    expectExec('install valkey latest');
  });

  it('setupDatabases executes wait4x and creates DB on both POSIX and Windows', () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    deploy.setupDatabases(makeConfig('linux', 'x64'));
    expectExec('wait4x postgresql');
    expectExec('grep -q 1');

    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    deploy.setupDatabases(makeConfig('win32', 'x64'));
    setupDatabasesDirect();
    expectExec('findstr "1" >nul');
  });

  it('runLibscriptDbAction executes provision-db, deprovision-db, export-state, and import-state', () => {
    const cfg = makeConfig('linux', 'x64');
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));

    runLibscriptDbAction('provision-db');
    expectExec('provision-db');

    runLibscriptDbAction('deprovision-db', '/custom/libscript.json', undefined, cfg);
    expectExec('deprovision-db "/custom/libscript.json"');

    runLibscriptDbAction('export-state', '/custom/libscript.json', '/tmp/state', cfg);
    expectExec('export-state "/custom/libscript.json" "/tmp/state"');

    runLibscriptDbAction('import-state', undefined, '/tmp/state', cfg);
    expectExec(`import-state "${join(cfg.repoRoot, 'libscript.json')}" "/tmp/state"`);
  });

  it('findExtractedBinary filters archives, directories, and matching binaries', () => {
    vi.mocked(fs.lstatSync).mockImplementation((p) => {
      return createMockStats(String(p).endsWith('subdir'));
    });

    expect(
      findExtractedBinary('/tmp/ext', ['archive.tar.gz', 'archive.zip', 'subdir', 'my-repo'], 'tar.gz'),
    ).toBe('my-repo');

    expect(findExtractedBinary('/tmp/ext', ['archive.tar.gz', 'subdir'], 'tar.gz')).toBeUndefined();

    expect(
      findExtractedBinary('/tmp/ext', ['readme.txt', 'subdir', 'my-repo.exe'], 'zip'),
    ).toBe('my-repo.exe');

    expect(findExtractedBinary('/tmp/ext', ['readme.txt', 'subdir', 'unix_bin'], 'zip')).toBe(
      'unix_bin',
    );

    expect(findExtractedBinary('/tmp/ext', ['readme.txt', 'subdir'], 'zip')).toBeUndefined();
  });

  it('getOrBuildRustService downloads tar.gz, zip, and plain binary across platforms', () => {
    const linuxCfg = makeConfig('linux', 'x64', { GITHUB_TOKEN: 'tok_123' });
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(
          JSON.stringify({
            assets: [
              {
                name: 'app-x86_64-unknown-linux-gnu.tar.gz',
                browser_download_url: 'https://example.com/app.tar.gz',
              },
            ],
          }),
        );
      }
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === '/tmp/test-repo');
    vi.mocked(fs.readdirSync).mockReturnValue(['extracted_bin'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.lstatSync).mockReturnValue(createMockStats(false));

    deploy.getOrBuildRustService('test-repo', '/tmp', linuxCfg);
    expectExec('Authorization: token tok_123');
    expectExec('tar -xf');
    expect(fs.chmodSync).toHaveBeenCalledWith('/tmp/test-repo', 0o755);

    // When finalBinPath does not exist initially, it renames the extracted binary
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(
          JSON.stringify({
            assets: [
              {
                name: 'app-aarch64-apple-darwin.tar.gz',
                browser_download_url: 'https://example.com/app.tar.gz',
              },
            ],
          }),
        );
      }
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue(['extracted_bin'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.lstatSync).mockReturnValue(createMockStats(false));

    deploy.getOrBuildRustService('test-repo', '/tmp', makeConfig('darwin', 'arm64'));
    expect(fs.renameSync).toHaveBeenCalled();

    // When tar.gz has no matching files inside tempDir
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(
          JSON.stringify({
            assets: [
              {
                name: 'app-x86_64-apple-darwin.tar.gz',
                browser_download_url: 'https://example.com/app.tar.gz',
              },
            ],
          }),
        );
      }
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
    deploy.getOrBuildRustService('test-repo', '/tmp', makeConfig('darwin', 'x64'));
    expect(fs.renameSync).not.toHaveBeenCalled();

    // Windows .zip extraction
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(
          JSON.stringify({
            assets: [
              {
                name: 'app-x86_64-pc-windows-msvc.zip',
                browser_download_url: 'https://example.com/app.zip',
              },
            ],
          }),
        );
      }
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue(['extracted_bin.exe'] as unknown as ReturnType<typeof fs.readdirSync>);
    deploy.getOrBuildRustService('test-repo', '/tmp', makeConfig('win32', 'x64'));
    expectExec('tar -xf');
    expect(fs.chmodSync).not.toHaveBeenCalled();

    // Plain binary download
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(
          JSON.stringify({
            assets: [
              {
                name: 'app-x86_64-unknown-linux-gnu',
                browser_download_url: 'https://example.com/app',
              },
            ],
          }),
        );
      }
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    deploy.getOrBuildRustService('test-repo', '/tmp', makeConfig('linux', 'x64'));
    expect(fs.renameSync).toHaveBeenCalled();
    expect(fs.chmodSync).toHaveBeenCalled();
  });

  it('getOrBuildRustService handles invalid JSON payload, 404 asset, and fallback modes', () => {
    // Invalid release payload
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(JSON.stringify('not-an-object'));
      }
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    deploy.getOrBuildRustService('test-repo', '/tmp');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid GitHub release payload'),
    );
    expectExec('cargo build');

    // Missing asset (404) with skip-if-missing when source dir is absent
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('api.github.com')) {
        return Buffer.from(JSON.stringify({ assets: [] }));
      }
      return Buffer.from('');
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    getOrBuildRustService('test-repo', '/tmp');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping build.'));

    // Missing source dir with exit-if-missing
    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw new Error('network error');
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    getOrBuildRustService('test-repo', '/tmp', { fallbackMode: 'exit-if-missing' });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Cannot build from source.'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('buildMicroservices handles existing/missing binDir, UI repos with/without package.json, and missing repos', () => {
    // binDir missing, UI repo exists with package.json
    vi.mocked(fs.existsSync).mockImplementation((p) => !String(p).endsWith('bin'));
    vi.mocked(fs.lstatSync).mockReturnValue(createMockStats(true));
    deploy.buildMicroservices();
    expect(fs.mkdirSync).toHaveBeenCalled();
    expectExec('npm install');
    expectExec('npm run build --if-present');

    // binDir exists, UI repo exists WITHOUT package.json
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockImplementation((p) => !String(p).endsWith('package.json'));
    vi.mocked(fs.lstatSync).mockReturnValue(createMockStats(true));
    deploy.buildMicroservices();
    expectNotExec('npm install');

    // binDir exists, UI repo is missing
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('bin'));
    deploy.buildMicroservices();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('not found, skipping'));
  });

  it('buildPackageAsCommand and exportInfrastructure handle docker, compose, installers, packages, and VM images', () => {
    const cfg = makeConfig('linux', 'x64');
    const outDir = '/tmp/dist';

    expect(deploy.buildPackageAsCommand('docker', cfg, outDir)).toContain(
      `package-as docker --output "${join(outDir, 'Dockerfile')}"`,
    );
    expect(deploy.buildPackageAsCommand('dockerfile', cfg, outDir)).toContain(
      `package-as dockerfile --output "${join(outDir, 'Dockerfile')}"`,
    );
    expect(deploy.buildPackageAsCommand('docker_compose', cfg, outDir)).toContain(
      `package-as docker_compose "${join(cfg.repoRoot, 'libscript.json')}" --output "${join(outDir, 'docker-compose.yml')}"`,
    );
    expect(deploy.buildPackageAsCommand('docker-compose', cfg, outDir)).toContain(
      `package-as docker-compose "${join(cfg.repoRoot, 'libscript.json')}" --output "${join(outDir, 'docker-compose.yml')}"`,
    );
    expect(deploy.buildPackageAsCommand('msi', cfg, outDir)).toContain(
      `package-as msi --app-name "CDD Platform" --app-version "0.0.5" --app-publisher "CDD Open Source Project" --upgrade-code "A7D43B82-6E19-4F0C-9B25-3C8A1D7E4F90" --out-file "${join(outDir, 'cdd-installer')}"`,
    );
    expect(deploy.buildPackageAsCommand('deb', cfg, outDir)).toContain(
      'package-as deb --app-name "CDD Platform" --app-version "0.0.5" --app-publisher "CDD Open Source Project" --upgrade-code "A7D43B82-6E19-4F0C-9B25-3C8A1D7E4F90"',
    );
    expect(deploy.buildPackageAsCommand('iso', cfg, outDir)).toBe(`"${cfg.libscript}" package-as iso`);

    vi.mocked(fs.existsSync).mockReturnValue(false);
    deploy.exportInfrastructure();
    expect(fs.mkdirSync).toHaveBeenCalled();
    expectExec('package-as docker --output');
    expectExec('package-as docker_compose');

    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    deploy.exportInfrastructure(cfg, ['deb', 'msi', 'iso']);
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expectExec('package-as deb --app-name "CDD Platform"');
    expectExec('package-as msi --app-name "CDD Platform"');
    expectExec('package-as iso');
  });

  it('main and runIfMain handle success, custom targets, errors, and entrypoint check', () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.lstatSync).mockReturnValue(createMockStats(true));
    deploy.runIfMain(true);
    expect(console.log).toHaveBeenCalledWith('Deployment script completed successfully.');

    vi.clearAllMocks();
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('ok'));
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.lstatSync).mockReturnValue(createMockStats(true));
    deploy.main(makeConfig('linux', 'x64'), ['--target', 'deb']);
    expectExec('package-as deb --app-name "CDD Platform"');

    vi.clearAllMocks();
    deploy.runIfMain(false);
    expect(console.log).not.toHaveBeenCalled();

    // Error thrown inside main() is caught and formatted without ReferenceError
    vi.mocked(fs.existsSync).mockImplementation(() => {
      throw new Error('disk full');
    });
    deploy.main();
    expect(console.error).toHaveBeenCalledWith('Deployment failed:', 'disk full');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
