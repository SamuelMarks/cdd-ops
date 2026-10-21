/**
 * @file Dependency provisioning and database initialization routines via libscript.
 * @module scripts/lib/dependencies
 */

import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { resolveConfig } from './constants';
import { hasCommand, runSync } from './exec';
import { EnsureDependenciesOptions, SetupDatabasesOptions } from './types';

/**
 * Ensures the `wait4x` utility is installed via `libscript`.
 * @param libscript - Path to the platform `libscript` executable.
 * @param isWindows - Whether the current host is Windows.
 */
export function ensureWait4x(libscript?: string, isWindows?: boolean): void {
  const cfg = resolveConfig();
  const activeLibscript = libscript ?? cfg.libscript;
  const activeIsWindows = isWindows ?? cfg.isWindows;
  if (!hasCommand('wait4x', activeIsWindows)) {
    console.log('Installing wait4x...');
    runSync(`"${activeLibscript}" install wait4x latest`);
  }
}

/**
 * Validates and provisions required core dependencies (Rust, Node.js, PostgreSQL, Valkey/Redis).
 * @param options - Configuration options controlling toolchain and database checks.
 */
export function ensureDependencies(options: EnsureDependenciesOptions = {}): void {
  const cfg = options.config ?? resolveConfig();
  const skipInCi = options.skipInCi ?? false;
  const checkToolchainsFirst = options.checkToolchainsFirst ?? false;
  const checkRunningDatabasesFirst = options.checkRunningDatabasesFirst ?? false;

  if (skipInCi && cfg.isGithubActions) {
    return;
  }

  if (checkToolchainsFirst) {
    ensureWait4x(cfg.libscript, cfg.isWindows);

    console.log('Checking if rust is installed...');
    try {
      execSync(`"${cfg.libscript}" test rust`, { stdio: 'ignore' });
      console.log('Rust is already installed.');
    } catch {
      runSync(`"${cfg.libscript}" install rust latest`);
    }

    console.log('Checking if nodejs is installed...');
    try {
      execSync(`"${cfg.libscript}" test nodejs`, { stdio: 'ignore' });
      console.log('Node.js is already installed.');
    } catch {
      runSync(`"${cfg.libscript}" install nodejs latest`);
    }
  } else {
    console.log('Provisioning core dependencies...');
    runSync(`"${cfg.libscript}" install rust latest`);
    runSync(`"${cfg.libscript}" install nodejs latest`);
    console.log('Checking if databases are installed...');
    ensureWait4x(cfg.libscript, cfg.isWindows);
  }

  if (checkRunningDatabasesFirst) {
    console.log('Checking if databases are running or installed...');
    try {
      execSync(`wait4x tcp "${cfg.pgHost}:${cfg.pgPort}" -t 1s`, { stdio: 'ignore' });
      console.log(`PostgreSQL is already running on ${cfg.pgHost}:${cfg.pgPort}.`);
    } catch {
      provisionPostgresIfNeeded(cfg.libscript);
    }

    try {
      execSync(`wait4x tcp "${cfg.valkeyHost}:${cfg.valkeyPort}" -t 1s`, { stdio: 'ignore' });
      console.log(`Redis/Valkey is already running on ${cfg.valkeyHost}:${cfg.valkeyPort}.`);
    } catch {
      provisionValkeyOrRedis(cfg.libscript, true);
    }
  } else {
    provisionPostgresIfNeeded(cfg.libscript);
    provisionValkeyOrRedis(cfg.libscript, false);
  }
}

/**
 * Checks whether PostgreSQL is installed via `libscript` and installs it if absent.
 * @param libscript - Path to the `libscript` executable.
 */
export function provisionPostgresIfNeeded(libscript: string): void {
  try {
    execSync(`"${libscript}" test postgres`, { stdio: 'ignore' });
    console.log('PostgreSQL is already installed.');
  } catch {
    runSync(`"${libscript}" install postgres latest`);
  }
}

/**
 * Checks whether Valkey or Redis is installed via `libscript` and installs Valkey if both are absent.
 * @param libscript - Path to the `libscript` executable.
 * @param combinedLogMessage - If true, logs a unified `'Redis/Valkey is already installed.'` message.
 */
export function provisionValkeyOrRedis(libscript: string, combinedLogMessage: boolean): void {
  let hasValkey = false;
  let hasRedis = false;
  try {
    execSync(`"${libscript}" test valkey`, { stdio: 'ignore' });
    hasValkey = true;
  } catch {
    // Valkey not yet installed.
  }
  try {
    execSync(`"${libscript}" test redis`, { stdio: 'ignore' });
    hasRedis = true;
  } catch {
    // Redis not yet installed.
  }

  if (combinedLogMessage) {
    if (hasRedis || hasValkey) {
      console.log('Redis/Valkey is already installed.');
    } else {
      runSync(`"${libscript}" install valkey latest`);
    }
    return;
  }

  if (hasValkey) {
    console.log('Valkey is already installed.');
  } else if (hasRedis) {
    console.log('Redis is already installed.');
  } else {
    runSync(`"${libscript}" install valkey latest`);
  }
}

/**
 * Builds the platform-specific shell command to create the `cdd` PostgreSQL database if absent.
 * @param pgHost - PostgreSQL hostname.
 * @param pgUser - PostgreSQL username.
 * @param isWindows - Whether the target platform is Windows.
 * @returns The shell command string to check and create the `cdd` database.
 */
export function buildCreateDbCommand(pgHost: string, pgUser: string, isWindows: boolean): string {
  return isWindows
    ? `psql -h ${pgHost} -U ${pgUser} -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | findstr "1" >nul || psql -h ${pgHost} -U ${pgUser} -c "CREATE DATABASE cdd"`
    : `psql -h ${pgHost} -U ${pgUser} -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | grep -q 1 || psql -h ${pgHost} -U ${pgUser} -c "CREATE DATABASE cdd"`;
}

/**
 * Waits for databases to start, creates the `cdd` PostgreSQL database, and optionally runs migrations.
 * @param options - Options controlling Redis readiness checks and Diesel migrations.
 */
export function setupDatabases(options: SetupDatabasesOptions = {}): void {
  const cfg = options.config ?? resolveConfig();
  const waitForRedis = options.waitForRedis ?? false;
  const runMigrations = options.runMigrations ?? false;

  console.log('Ensuring PostgreSQL is ready...');
  runSync(`wait4x postgresql "postgres://${cfg.pgUser}@${cfg.pgHost}:${cfg.pgPort}/postgres?sslmode=disable" -t 60s`);

  if (waitForRedis) {
    console.log('Ensuring Redis/Valkey is ready...');
    runSync(`wait4x redis "redis://${cfg.valkeyHost}:${cfg.valkeyPort}" -t 60s`);
    console.log('Setting up Postgres Database for local tests...');
  } else {
    console.log('Setting up Postgres Database...');
  }

  const createDbCmd = buildCreateDbCommand(cfg.pgHost, cfg.pgUser, cfg.isWindows);
  runSync(createDbCmd);

  if (runMigrations) {
    console.log('Ensuring diesel_cli is installed...');
    if (!hasCommand('diesel', cfg.isWindows)) {
      runSync('cargo install diesel_cli --no-default-features --features postgres');
    }

    console.log('Running Diesel Migrations via diesel cli...');
    runSync('diesel migration run', join(cfg.parentDir, 'cdd-control-plane'), false, {
      DATABASE_URL: cfg.databaseUrl,
    });
  }
}
