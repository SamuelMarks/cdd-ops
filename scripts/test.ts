/**
 * @file End-to-End (E2E) test runner orchestration script for the CDD platform.
 * @module scripts/test
 */

import { execSync, ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DATABASE_URL,
  IS_WINDOWS,
  LIBSCRIPT,
  LIBSCRIPT_CMD,
  LIBSCRIPT_SH,
  PARENT_DIR,
  PG_HOST,
  PG_PORT,
  PG_USER,
  PORTS,
  REDIS_URL,
  REPO_ROOT,
  VALKEY_HOST,
  VALKEY_PORT,
  resolveConfig,
} from './lib/constants';
import {
  ensureDependencies as ensureDepsShared,
  ensureWait4x as ensureWait4xShared,
  setupDatabases as setupDatabasesShared,
} from './lib/dependencies';
import { hasCommand, runAsync, runSync } from './lib/exec';
import { killPorts as killPortsShared } from './lib/ports';
import { getOrBuildRustService as getOrBuildRustServiceShared } from './lib/rust-service';
import { formatError, OpsConfig, RustServiceCommand } from './lib/types';

export {
  DATABASE_URL,
  IS_WINDOWS,
  LIBSCRIPT,
  LIBSCRIPT_CMD,
  LIBSCRIPT_SH,
  PARENT_DIR,
  PG_HOST,
  PG_PORT,
  PG_USER,
  PORTS,
  REDIS_URL,
  REPO_ROOT,
  VALKEY_HOST,
  VALKEY_PORT,
  hasCommand,
  runAsync,
  runSync,
};

/**
 * Terminates any processes listening on the CDD platform service ports.
 * @param config - Optional runtime configuration override.
 */
export function killPorts(config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  killPortsShared(PORTS, cfg.isWindows);
}

/**
 * Ensures the `wait4x` utility is installed via `libscript`.
 * @param config - Optional runtime configuration override.
 */
export function ensureWait4x(config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  ensureWait4xShared(cfg.libscript, cfg.isWindows);
}

/**
 * Ensures all core dependencies (Rust, Node.js, PostgreSQL, Valkey/Redis) are installed or running.
 * @param config - Optional runtime configuration override.
 */
export function ensureDependencies(config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  ensureDepsShared({
    skipInCi: true,
    checkToolchainsFirst: true,
    checkRunningDatabasesFirst: true,
    config: cfg,
  });
}

/**
 * Waits for PostgreSQL and Valkey/Redis, creates the `cdd` database, and runs Diesel migrations.
 * @param config - Optional runtime configuration override.
 */
export function setupDatabases(config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  setupDatabasesShared({
    waitForRedis: true,
    runMigrations: true,
    config: cfg,
  });
}

/**
 * Downloads a prebuilt release for a Rust microservice or builds from source via Cargo as a fallback.
 * @param repo - Repository name (e.g., `'cdd-gateway'`).
 * @param destDir - Destination directory for the binary.
 * @param cargoEnv - Environment variables passed to Cargo when building from source.
 * @param config - Optional runtime configuration override.
 * @returns A {@link RustServiceCommand} describing how to launch the service.
 */
export function getOrBuildRustService(
  repo: string,
  destDir: string,
  cargoEnv: Record<string, string>,
  config?: OpsConfig,
): RustServiceCommand {
  const cfg = config ?? resolveConfig();
  return getOrBuildRustServiceShared(repo, destDir, {
    cargoEnv,
    fallbackMode: 'exit-if-missing',
    config: cfg,
  });
}

/**
 * Idempotently patches `cdd-web-ui/scripts/build-wasm.mjs` to forward `GITHUB_TOKEN` when present.
 * @param wasmScriptPath - Path to the `build-wasm.mjs` script.
 */
export function patchWebUiWasmScript(wasmScriptPath: string): void {
  if (!existsSync(wasmScriptPath)) {
    return;
  }
  const originalContent = readFileSync(wasmScriptPath, 'utf8');
  if (originalContent.includes('process.env.GITHUB_TOKEN')) {
    return;
  }
  const patchedContent = originalContent.replace(
    /\{ headers: \{ 'User-Agent': 'node\.js' \} \}/g,
    "{ headers: { 'User-Agent': 'node.js', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } }",
  );
  if (patchedContent !== originalContent) {
    writeFileSync(wasmScriptPath, patchedContent);
  }
}

/**
 * Builds or resolves all platform microservices and starts them in the background.
 * @param config - Optional runtime configuration override.
 * @returns Array of spawned background {@link ChildProcess} instances.
 */
export function buildAndStartServices(config?: OpsConfig): ChildProcess[] {
  const cfg = config ?? resolveConfig();
  console.log('Resolving pre-built Rust services (or building from source fallback)...');
  const binDir = join(cfg.parentDir, 'bin');
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  const sharedTargetDir = join(cfg.parentDir, 'shared-cargo-target');
  const cargoEnv: Record<string, string> = {
    CARGO_TARGET_DIR: sharedTargetDir,
    CARGO_PROFILE_DEV_DEBUG: '0',
  };

  const cpSvc = getOrBuildRustService('cdd-control-plane', binDir, cargoEnv, cfg);
  const storageSvc = getOrBuildRustService('cdd-storage', binDir, cargoEnv, cfg);
  const gatewaySvc = getOrBuildRustService('cdd-gateway', binDir, cargoEnv, cfg);

  const processes: ChildProcess[] = [];
  const envConfig: Record<string, string> = {
    CDD__DATABASE_URL: cfg.databaseUrl,
    CDD__REDIS_URL: cfg.redisUrl,
    ...cargoEnv,
  };

  console.log('Starting cdd-control-plane...');
  processes.push(
    runAsync(
      cpSvc.cmd,
      cpSvc.args,
      cpSvc.cwd,
      {
        ...envConfig,
        CDD__SERVER_BIND: '0.0.0.0:8081',
      },
      cfg.isWindows,
    ),
  );

  console.log('Starting cdd-storage...');
  processes.push(
    runAsync(
      storageSvc.cmd,
      storageSvc.args,
      storageSvc.cwd,
      {
        ...envConfig,
        PORT: '8085',
      },
      cfg.isWindows,
    ),
  );

  console.log('Starting cdd-docs-ui...');
  const docsUiPath = join(cfg.parentDir, 'cdd-docs-ui');
  runSync('npm install', docsUiPath);
  runSync('npm run build', docsUiPath);
  processes.push(runAsync('npm', ['run', 'serve'], docsUiPath, envConfig, cfg.isWindows));

  console.log('Patching cdd-web-ui to use GITHUB_TOKEN...');
  const wasmScriptPath = join(cfg.parentDir, 'cdd-web-ui', 'scripts', 'build-wasm.mjs');
  patchWebUiWasmScript(wasmScriptPath);

  console.log('Starting cdd-web-ui...');
  const webUiPath = join(cfg.parentDir, 'cdd-web-ui');
  runSync('npm install', webUiPath);
  runSync('npm run build', webUiPath);
  processes.push(
    runAsync(
      'npx',
      ['--yes', 'serve', '-s', join('dist', 'cdd-web-ui', 'browser'), '-l', '8083'],
      webUiPath,
      envConfig,
      cfg.isWindows,
    ),
  );

  console.log('Starting cdd-gateway...');
  processes.push(
    runAsync(
      gatewaySvc.cmd,
      gatewaySvc.args,
      gatewaySvc.cwd,
      {
        ...envConfig,
        CDD__SERVER_BIND: '0.0.0.0:8086',
      },
      cfg.isWindows,
    ),
  );

  return processes;
}

/**
 * Waits for the gateway health endpoints and executes the Playwright E2E test suite.
 * @param config - Optional runtime configuration override.
 */
export function runE2eTests(config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  console.log('Waiting for Gateway to be healthy on port 8086...');
  runSync(
    'wait4x http http://localhost:8086/version http://localhost:8086/api/v1/health http://localhost:8086/ --expect-status-code 200 -t 900s',
  );
  console.log('Gateway and downstream services are up!');

  console.log('Running E2E tests locally...');
  const e2ePath = join(cfg.repoRoot, 'e2e');
  runSync('npm install', e2ePath);
  runSync('npx playwright install --with-deps', e2ePath);

  try {
    console.log('> npx playwright test');
    execSync('npx playwright test', {
      cwd: e2ePath,
      stdio: 'inherit',
      env: { ...process.env, BASE_URL: 'http://localhost:8086' },
    });
  } catch {
    console.error('Command failed: npx playwright test');
    process.exit(1);
  }
}

/**
 * Terminates a list of background child processes across Windows and POSIX platforms.
 * @param processes - The list of spawned {@link ChildProcess} instances to terminate.
 * @param isWindows - Whether to use `taskkill` (Windows) or `p.kill('SIGKILL')` (POSIX).
 */
export function cleanupProcesses(processes: readonly ChildProcess[], isWindows: boolean = IS_WINDOWS): void {
  console.log('Shutting down background processes...');
  for (const proc of processes) {
    try {
      if (isWindows) {
        execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
      } else {
        proc.kill('SIGKILL');
      }
    } catch {
      // Process may have already exited; ignore cleanup error.
    }
  }
}

/**
 * Validates requirements, starts background services, runs E2E tests, and cleans up child processes.
 * @param config - Optional runtime configuration override.
 */
export function main(config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  let bgProcesses: ChildProcess[] = [];

  /**
   * Invokes {@link cleanupProcesses} for all active background processes.
   */
  const cleanup = (): void => {
    cleanupProcesses(bgProcesses, cfg.isWindows);
  };

  /**
   * Signal handler that cleans up background processes and exits with status code 1.
   */
  const handleSignal = (): void => {
    cleanup();
    process.exit(1);
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
  process.on('exit', cleanup);

  try {
    killPorts(cfg);
    ensureDependencies(cfg);
    setupDatabases(cfg);
    bgProcesses = buildAndStartServices(cfg);
    runE2eTests(cfg);
    console.log('Tests completed successfully.');
    cleanup();
    process.exit(0);
  } catch (error: unknown) {
    console.error('Test execution failed:', formatError(error));
    cleanup();
    process.exit(1);
  } finally {
    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
    process.off('exit', cleanup);
  }
}

/**
 * Runs {@link main} when invoked directly as the Node.js entrypoint module.
 * @param isMain - Whether the current module is the main entrypoint.
 */
export function runIfMain(isMain: boolean = require.main === module): void {
  if (isMain) {
    main();
  }
}

runIfMain();
