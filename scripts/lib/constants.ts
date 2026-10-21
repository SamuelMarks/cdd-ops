/**
 * @file Shared constants and pure runtime configuration resolution for CDD operations.
 * @module scripts/lib/constants
 */

import { platform } from 'node:os';
import { resolve } from 'node:path';
import { OpsConfig } from './types';

/**
 * Root directory of the `cdd-ops` repository.
 */
export const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * Parent directory containing `cdd-ops` and sibling `cdd-*` repositories.
 */
export const PARENT_DIR = resolve(REPO_ROOT, '..');

/**
 * Absolute path to the POSIX `libscript.sh` entrypoint.
 */
export const LIBSCRIPT_SH = resolve(PARENT_DIR, 'libscript', 'libscript.sh');

/**
 * Absolute path to the Windows `libscript.cmd` entrypoint.
 */
export const LIBSCRIPT_CMD = resolve(PARENT_DIR, 'libscript', 'libscript.cmd');

/**
 * Indicates whether the current host operating system is Windows (`win32`).
 */
export const IS_WINDOWS = platform() === 'win32';

/**
 * Selects the platform-appropriate `libscript` executable path.
 * @param isWindows - True if the target platform is Windows (`win32`).
 * @returns Path to `libscript.cmd` on Windows or `libscript.sh` on POSIX.
 */
export function selectLibscript(isWindows: boolean): string {
  return isWindows ? LIBSCRIPT_CMD : LIBSCRIPT_SH;
}

/**
 * Platform-appropriate `libscript` executable path for the current host.
 */
export const LIBSCRIPT = selectLibscript(IS_WINDOWS);

/**
 * PostgreSQL hostname resolved from `POSTGRES_HOST` or defaulting to `'localhost'`.
 */
export const PG_HOST = process.env['POSTGRES_HOST'] || 'localhost';

/**
 * PostgreSQL port resolved from `POSTGRES_PORT` or defaulting to `'5432'`.
 */
export const PG_PORT = process.env['POSTGRES_PORT'] || '5432';

/**
 * PostgreSQL user resolved from `POSTGRES_USER` or defaulting to `'postgres'`.
 */
export const PG_USER = process.env['POSTGRES_USER'] || 'postgres';

/**
 * Valkey/Redis hostname resolved from `VALKEY_HOST` or defaulting to `'localhost'`.
 */
export const VALKEY_HOST = process.env['VALKEY_HOST'] || 'localhost';

/**
 * Valkey/Redis port resolved from `VALKEY_PORT` or defaulting to `'6379'`.
 */
export const VALKEY_PORT = process.env['VALKEY_PORT'] || '6379';

/**
 * PostgreSQL connection URL for the `cdd` database.
 */
export const DATABASE_URL = `postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/cdd`;

/**
 * Redis/Valkey connection URL.
 */
export const REDIS_URL = `redis://${VALKEY_HOST}:${VALKEY_PORT}`;

/**
 * Local TCP ports used by the CDD platform microservices during local testing.
 */
export const PORTS: readonly number[] = [8081, 8082, 8083, 8084, 8085, 8086];

/**
 * All CDD platform microservice repository names.
 */
export const MICROSERVICES: readonly string[] = [
  'cdd-gateway',
  'cdd-web-ui',
  'cdd-control-plane',
  'cdd-engine',
  'cdd-storage',
  'cdd-publisher',
  'cdd-docs-ui',
];

/**
 * Subset of CDD platform microservices that compile as Rust binaries.
 */
export const RUST_MICROSERVICES: readonly string[] = [
  'cdd-control-plane',
  'cdd-engine',
  'cdd-storage',
  'cdd-gateway',
  'cdd-publisher',
];

/**
 * Resolves a complete, immutable {@link OpsConfig} from environment variables and OS metadata.
 * @param env - Environment variables map (defaults to `process.env`).
 * @param osPlatform - Operating system platform (defaults to `platform()`).
 * @param arch - CPU architecture string (defaults to `process.arch`).
 * @returns The resolved {@link OpsConfig} object.
 */
export function resolveConfig(
  env: NodeJS.ProcessEnv = process.env,
  osPlatform: NodeJS.Platform = platform(),
  arch: string = process.arch,
): OpsConfig {
  const isWindows = osPlatform === 'win32';
  const pgHost = env['POSTGRES_HOST'] || 'localhost';
  const pgPort = env['POSTGRES_PORT'] || '5432';
  const pgUser = env['POSTGRES_USER'] || 'postgres';
  const valkeyHost = env['VALKEY_HOST'] || 'localhost';
  const valkeyPort = env['VALKEY_PORT'] || '6379';
  const githubToken = env['GITHUB_TOKEN'];

  return {
    libscriptSh: LIBSCRIPT_SH,
    libscriptCmd: LIBSCRIPT_CMD,
    isWindows,
    libscript: isWindows ? LIBSCRIPT_CMD : LIBSCRIPT_SH,
    repoRoot: REPO_ROOT,
    parentDir: PARENT_DIR,
    pgHost,
    pgPort,
    pgUser,
    valkeyHost,
    valkeyPort,
    databaseUrl: `postgres://${pgUser}@${pgHost}:${pgPort}/cdd`,
    redisUrl: `redis://${valkeyHost}:${valkeyPort}`,
    ...(githubToken !== undefined ? { githubToken } : {}),
    isGithubActions: Boolean(env['GITHUB_ACTIONS']),
    osPlatform,
    arch,
  };
}
