/**
 * @file Deployment orchestration script for provisioning, building, and packaging the CDD platform.
 * @module scripts/deploy
 */

import { existsSync, lstatSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  IS_WINDOWS,
  LIBSCRIPT,
  LIBSCRIPT_CMD,
  LIBSCRIPT_SH,
  MICROSERVICES,
  PARENT_DIR,
  PG_HOST,
  PG_PORT,
  PG_USER,
  REPO_ROOT,
  RUST_MICROSERVICES,
  VALKEY_HOST,
  VALKEY_PORT,
  resolveConfig,
} from './lib/constants';
import {
  ensureDependencies as ensureDepsShared,
  ensureWait4x as ensureWait4xShared,
  setupDatabases as setupDatabasesShared,
} from './lib/dependencies';
import { hasCommand, runSync } from './lib/exec';
import { getOrBuildRustService as getOrBuildRustServiceShared } from './lib/rust-service';
import {
  formatError,
  isPackageFormat,
  OpsConfig,
  PackageFormat,
  PackagingManifestSummary,
} from './lib/types';

export {
  IS_WINDOWS,
  LIBSCRIPT,
  LIBSCRIPT_CMD,
  LIBSCRIPT_SH,
  MICROSERVICES,
  PARENT_DIR,
  PG_HOST,
  PG_PORT,
  PG_USER,
  REPO_ROOT,
  RUST_MICROSERVICES,
  VALKEY_HOST,
  VALKEY_PORT,
  hasCommand,
  runSync,
};

/**
 * Default packaging formats generated when no `--target` CLI flags are provided.
 */
export const DEFAULT_PACKAGE_TARGETS: readonly PackageFormat[] = ['docker', 'docker_compose'];

/**
 * Default CDD packaging metadata aligned with `packaging.json` for `_common_installer_args`.
 */
export const DEFAULT_PACKAGING_METADATA: PackagingManifestSummary = {
  name: 'cdd',
  title: 'CDD Platform',
  version: '0.0.5',
  publisher: 'CDD Open Source Project',
  upgrade_code: 'A7D43B82-6E19-4F0C-9B25-3C8A1D7E4F90',
};

/**
 * Installer formats backed by `_common_installer_args` that accept `--out-file`.
 */
const OUT_FILE_INSTALLER_FORMATS: readonly PackageFormat[] = [
  'msi',
  'innosetup',
  'nsis',
  'pkg',
  'dmg',
];

/**
 * Package formats backed by `_common_installer_args` that use `OUT_DIR` environment routing.
 */
const COMMON_ARGS_PACKAGE_FORMATS: readonly PackageFormat[] = [
  'deb',
  'rpm',
  'apk',
  'txz',
  'tui',
];

/**
 * Parses CLI arguments passed to `deploy` to extract requested `--target` packaging formats.
 * @param args - Array of raw CLI argument strings.
 * @returns Array of validated {@link PackageFormat} targets (defaults to `['docker', 'docker_compose']`).
 * @throws {Error} If `--target` is missing its argument or specifies an unsupported format.
 */
export function parseDeployArgs(args: readonly string[] = []): readonly PackageFormat[] {
  const targets: PackageFormat[] = [];
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--target') {
      const nextArg = args[i + 1];
      if (nextArg === undefined || nextArg.startsWith('-')) {
        throw new Error('Missing value for --target flag.');
      }
      if (!isPackageFormat(nextArg)) {
        throw new Error(`Unsupported package target format: ${nextArg}`);
      }
      targets.push(nextArg);
      i += 2;
      continue;
    }
    if (arg !== undefined && arg.startsWith('--target=')) {
      const val = arg.slice('--target='.length);
      if (!isPackageFormat(val)) {
        throw new Error(`Unsupported package target format: ${val}`);
      }
      targets.push(val);
    }
    i += 1;
  }
  return targets.length > 0 ? targets : DEFAULT_PACKAGE_TARGETS;
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
 * Validates and provisions the required core dependencies (Rust, Node.js, PostgreSQL, Valkey).
 * @param config - Optional runtime configuration override.
 */
export function ensureDependencies(config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  ensureDepsShared({
    skipInCi: false,
    checkToolchainsFirst: false,
    checkRunningDatabasesFirst: false,
    config: cfg,
  });
}

/**
 * Waits for databases to start and initializes the PostgreSQL database if absent.
 * @param config - Optional runtime configuration override.
 */
export function setupDatabases(config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  setupDatabasesShared({
    waitForRedis: false,
    runMigrations: false,
    config: cfg,
  });
}

/**
 * Attempts to download a prebuilt release for a Rust microservice or builds from source via Cargo as a fallback.
 * @param repo - The GitHub repository name (e.g., `'cdd-gateway'`).
 * @param destDir - The destination directory for the downloaded or built executable.
 * @param config - Optional runtime configuration override.
 */
export function getOrBuildRustService(repo: string, destDir: string, config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  getOrBuildRustServiceShared(repo, destDir, {
    fallbackMode: 'skip-if-missing',
    config: cfg,
  });
}

/**
 * Downloads or builds all relevant UI and backend microservices.
 * @param config - Optional runtime configuration override.
 */
export function buildMicroservices(config?: OpsConfig): void {
  const cfg = config ?? resolveConfig();
  console.log('Building and downloading cdd-* repositories...');
  const binDir = join(cfg.parentDir, 'bin');
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  for (const repo of MICROSERVICES) {
    const isRustBinary = RUST_MICROSERVICES.includes(repo);
    if (isRustBinary) {
      getOrBuildRustService(repo, binDir, cfg);
    } else {
      const repoPath = join(cfg.parentDir, repo);
      if (existsSync(repoPath) && lstatSync(repoPath).isDirectory()) {
        console.log(`Building UI/Docs ${repo}...`);
        if (existsSync(join(repoPath, 'package.json'))) {
          runSync('npm install', repoPath);
          runSync('npm run build --if-present', repoPath);
        }
      } else {
        console.log(`Warning: Repository ${repoPath} not found, skipping.`);
      }
    }
  }
}

/**
 * Builds the `libscript package-as` CLI command string for a given target format.
 * @param target - The requested {@link PackageFormat} target.
 * @param cfg - Active {@link OpsConfig} runtime configuration.
 * @param outDir - Destination directory for generated package artifacts.
 * @param metadata - Installer metadata (defaults to {@link DEFAULT_PACKAGING_METADATA}).
 * @returns The formatted `libscript package-as` command string.
 */
export function buildPackageAsCommand(
  target: PackageFormat,
  cfg: OpsConfig,
  outDir: string,
  metadata: PackagingManifestSummary = DEFAULT_PACKAGING_METADATA,
): string {
  if (target === 'docker' || target === 'dockerfile') {
    const dockerfileOut = join(outDir, 'Dockerfile');
    return `"${cfg.libscript}" package-as ${target} --output "${dockerfileOut}"`;
  }
  if (target === 'docker_compose' || target === 'docker-compose') {
    const manifestPath = join(cfg.repoRoot, 'libscript.json');
    const composeOut = join(outDir, 'docker-compose.yml');
    return `"${cfg.libscript}" package-as ${target} "${manifestPath}" --output "${composeOut}"`;
  }
  const commonFlags = `--app-name "${metadata.title}" --app-version "${metadata.version}" --app-publisher "${metadata.publisher}" --upgrade-code "${metadata.upgrade_code}"`;
  if (OUT_FILE_INSTALLER_FORMATS.includes(target)) {
    const outFile = join(outDir, `${metadata.name}-installer`);
    return `"${cfg.libscript}" package-as ${target} ${commonFlags} --out-file "${outFile}"`;
  }
  if (COMMON_ARGS_PACKAGE_FORMATS.includes(target)) {
    return `"${cfg.libscript}" package-as ${target} ${commonFlags}`;
  }
  return `"${cfg.libscript}" package-as ${target}`;
}

/**
 * Generates external infrastructure packaging formats (`docker`, `docker_compose`, `.deb`, `.msi`, etc.).
 * @param config - Optional runtime configuration override.
 * @param targets - Optional list of packaging formats to export (defaults to `['docker', 'docker_compose']`).
 */
export function exportInfrastructure(
  config?: OpsConfig,
  targets: readonly PackageFormat[] = DEFAULT_PACKAGE_TARGETS,
): void {
  const cfg = config ?? resolveConfig();
  const outDir = join(cfg.parentDir, 'dist');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const envOpts = { OUT_DIR: outDir };
  console.log('Exporting infrastructure formats...');
  for (const target of targets) {
    const cmd = buildPackageAsCommand(target, cfg, outDir);
    runSync(cmd, cfg.repoRoot, false, envOpts);
  }
}

/**
 * Executes the full deployment workflow: dependencies, databases, microservices, and packaging.
 * @param config - Optional runtime configuration override.
 * @param args - Optional CLI arguments array (defaults to `process.argv.slice(2)`).
 */
export function main(config?: OpsConfig, args: readonly string[] = process.argv.slice(2)): void {
  try {
    const targets = parseDeployArgs(args);
    ensureDependencies(config);
    setupDatabases(config);
    buildMicroservices(config);
    exportInfrastructure(config, targets);
    console.log('Deployment script completed successfully.');
  } catch (error: unknown) {
    console.error('Deployment failed:', formatError(error));
    process.exit(1);
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
