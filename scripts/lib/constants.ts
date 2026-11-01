/**
 * @file Shared constants and pure runtime configuration resolution for CDD operations.
 * @module scripts/lib/constants
 */

import { platform } from 'node:os';
import { resolve } from 'node:path';
import {
  CDD_COMPILER_REPOS,
  CDD_DOC_HOSTING_TARGETS,
  CDD_REGISTRY_TYPES,
  CDD_SPEC_FORMATS,
  CDD_TARGET_LANGUAGES,
  CDD_WASM_ARTIFACTS,
  CddTargetLanguage,
  OpsConfig,
} from './types';

export {
  CDD_COMPILER_REPOS,
  CDD_DOC_HOSTING_TARGETS,
  CDD_REGISTRY_TYPES,
  CDD_SPEC_FORMATS,
  CDD_TARGET_LANGUAGES,
  CDD_WASM_ARTIFACTS,
};

/**
 * Root directory of the `cdd-ops` repository.
 */
export const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * Parent directory containing `cdd-ops` and sibling `cdd-*` repositories.
 */
export const PARENT_DIR = resolve(REPO_ROOT, '..');

/**
 * Default directory containing compiled `.wasm` compiler artifacts (`cdd-cpp.wasm` and all 13 `cdd-<lang>.wasm`).
 */
export const DEFAULT_WASM_DIR = resolve(PARENT_DIR, 'cdd-web-ui', 'public', 'wasm');

/**
 * Absolute path to the POSIX `libscript.sh` entrypoint.
 */
export const LIBSCRIPT_SH = resolve(PARENT_DIR, 'libscript', 'libscript.sh');

/**
 * Absolute path to the Windows `libscript.cmd` entrypoint.
 */
export const LIBSCRIPT_CMD = resolve(PARENT_DIR, 'libscript', 'libscript.cmd');

/**
 * Selects the platform-appropriate `libscript` executable path.
 * @param isWindows - True if the target platform is Windows (`win32`).
 * @returns Path to `libscript.cmd` on Windows or `libscript.sh` on POSIX.
 */
export function selectLibscript(isWindows: boolean): string {
  return isWindows ? LIBSCRIPT_CMD : LIBSCRIPT_SH;
}

/**
 * Resolves the expected monorepo name (`${orgName}-sdk`) for a given GitHub organization.
 * @param orgName - The GitHub organization name.
 * @returns The formatted monorepo name.
 */
export function formatSdkMonorepoName(orgName: string): string {
  return `${orgName}-sdk`;
}

/**
 * Resolves the expected polyrepo name (`${orgName}-sdk-${language}`) for a given GitHub organization and target language.
 * @param orgName - The GitHub organization name.
 * @param language - The target CDD language identifier.
 * @returns The formatted language-specific repository name.
 */
export function formatSdkPolyrepoName(orgName: string, language: CddTargetLanguage): string {
  return `${orgName}-sdk-${language}`;
}

/**
 * Resolves all 13 expected polyrepo names (`${orgName}-sdk-${language}`) for a given GitHub organization.
 * @param orgName - The GitHub organization name.
 * @returns Immutable array of 13 language-specific repository names.
 */
export function formatAllSdkPolyrepoNames(orgName: string): readonly string[] {
  return CDD_TARGET_LANGUAGES.map((lang) => formatSdkPolyrepoName(orgName, lang));
}

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
  const googleClientId = env['CDD__GOOGLE_CLIENT_ID'] || 'dev-google-client-id';
  const googleClientSecret = env['CDD__GOOGLE_CLIENT_SECRET'] || 'dev-google-client-secret';
  const googleOauthUrl =
    env['CDD__GOOGLE_OAUTH_URL'] || 'https://oauth2.googleapis.com/token';
  const googleUserinfoUrl =
    env['CDD__GOOGLE_USERINFO_URL'] || 'https://www.googleapis.com/oauth2/v3/userinfo';
  const githubClientId = env['CDD__GITHUB_CLIENT_ID'] || 'dev-github-client-id';
  const githubClientSecret = env['CDD__GITHUB_CLIENT_SECRET'] || 'dev-github-client-secret';
  const githubOrgName = env['GITHUB_ORG_NAME'] || 'offscale';
  const storageSecretKey = env['CDD__STORAGE_SECRET_KEY'] || 'dev-secret-key';
  const pgpKeyId = env['CDD__PGP_KEY_ID'] || 'CDD-DEV-PGP-KEY';
  const wasmDir = env['CDD__WASM_DIR'] || DEFAULT_WASM_DIR;
  const githubToken = env['GITHUB_TOKEN'];

  return {
    libscriptSh: LIBSCRIPT_SH,
    libscriptCmd: LIBSCRIPT_CMD,
    isWindows,
    libscript: selectLibscript(isWindows),
    repoRoot: REPO_ROOT,
    parentDir: PARENT_DIR,
    pgHost,
    pgPort,
    pgUser,
    valkeyHost,
    valkeyPort,
    databaseUrl: `postgres://${pgUser}@${pgHost}:${pgPort}/cdd`,
    redisUrl: `redis://${valkeyHost}:${valkeyPort}`,
    googleClientId,
    googleClientSecret,
    googleOauthUrl,
    googleUserinfoUrl,
    githubClientId,
    githubClientSecret,
    githubOrgName,
    storageSecretKey,
    pgpKeyId,
    wasmDir,
    ...(githubToken !== undefined ? { githubToken } : {}),
    isGithubActions: Boolean(env['GITHUB_ACTIONS']),
    osPlatform,
    arch,
  };
}

/**
 * Builds the shared service environment variable dictionary forwarded to CDD backend microservices.
 * @param cfg - Active {@link OpsConfig} runtime configuration.
 * @returns Record of environment variable key-value pairs.
 */
export function buildServiceEnv(cfg: OpsConfig): Record<string, string> {
  return {
    CDD__DATABASE_URL: cfg.databaseUrl,
    CDD__REDIS_URL: cfg.redisUrl,
    CDD__GOOGLE_CLIENT_ID: cfg.googleClientId,
    CDD__GOOGLE_CLIENT_SECRET: cfg.googleClientSecret,
    CDD__GOOGLE_OAUTH_URL: cfg.googleOauthUrl,
    CDD__GOOGLE_USERINFO_URL: cfg.googleUserinfoUrl,
    CDD__GITHUB_CLIENT_ID: cfg.githubClientId,
    CDD__GITHUB_CLIENT_SECRET: cfg.githubClientSecret,
    GITHUB_ORG_NAME: cfg.githubOrgName,
    CDD__STORAGE_SECRET_KEY: cfg.storageSecretKey,
    CDD__PGP_KEY_ID: cfg.pgpKeyId,
    CDD__WASM_DIR: cfg.wasmDir,
  };
}

/**
 * Default runtime configuration resolved from the current process environment at module load time.
 */
export const DEFAULT_CONFIG: OpsConfig = resolveConfig();

/**
 * Indicates whether the current host operating system is Windows (`win32`).
 */
export const IS_WINDOWS: boolean = DEFAULT_CONFIG.isWindows;

/**
 * Platform-appropriate `libscript` executable path for the current host.
 */
export const LIBSCRIPT: string = DEFAULT_CONFIG.libscript;

/**
 * PostgreSQL hostname resolved from `POSTGRES_HOST` or defaulting to `'localhost'`.
 */
export const PG_HOST: string = DEFAULT_CONFIG.pgHost;

/**
 * PostgreSQL port resolved from `POSTGRES_PORT` or defaulting to `'5432'`.
 */
export const PG_PORT: string = DEFAULT_CONFIG.pgPort;

/**
 * PostgreSQL user resolved from `POSTGRES_USER` or defaulting to `'postgres'`.
 */
export const PG_USER: string = DEFAULT_CONFIG.pgUser;

/**
 * Valkey/Redis hostname resolved from `VALKEY_HOST` or defaulting to `'localhost'`.
 */
export const VALKEY_HOST: string = DEFAULT_CONFIG.valkeyHost;

/**
 * Valkey/Redis port resolved from `VALKEY_PORT` or defaulting to `'6379'`.
 */
export const VALKEY_PORT: string = DEFAULT_CONFIG.valkeyPort;

/**
 * PostgreSQL connection URL for the `cdd` database.
 */
export const DATABASE_URL: string = DEFAULT_CONFIG.databaseUrl;

/**
 * Redis/Valkey connection URL.
 */
export const REDIS_URL: string = DEFAULT_CONFIG.redisUrl;

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
