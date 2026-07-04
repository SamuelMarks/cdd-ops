import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { resolve, join } from 'node:path';
import { existsSync, readdirSync, lstatSync, mkdirSync, rmSync, renameSync, chmodSync } from 'node:fs';

// Constants
export const LIBSCRIPT_SH = resolve(__dirname, '..', '..', 'libscript', 'libscript.sh');
export const LIBSCRIPT_CMD = resolve(__dirname, '..', '..', 'libscript', 'libscript.cmd');
export const IS_WINDOWS = platform() === 'win32';
export const LIBSCRIPT = IS_WINDOWS ? LIBSCRIPT_CMD : LIBSCRIPT_SH;
export const REPO_ROOT = resolve(__dirname, '..');
export const PARENT_DIR = resolve(REPO_ROOT, '..');

export const PG_HOST = process.env.POSTGRES_HOST || 'localhost';
export const PG_PORT = process.env.POSTGRES_PORT || '5432';
export const PG_USER = process.env.POSTGRES_USER || 'postgres';
export const VALKEY_HOST = process.env.VALKEY_HOST || 'localhost';
export const VALKEY_PORT = process.env.VALKEY_PORT || '6379';

export const MICROSERVICES = [
  'cdd-gateway',
  'cdd-web-ui',
  'cdd-control-plane',
  'cdd-engine',
  'cdd-storage',
  'cdd-publisher',
  'cdd-docs-ui',
];

// Ensure libscript uses mise to avoid fnm concurrency bugs
process.env.NODEJS_INSTALL_METHOD = 'mise';

/**
 * Runs a shell command synchronously and pipes output to standard streams.
 * @param command - The command to run.
 * @param cwd - The working directory to execute in. Defaults to REPO_ROOT.
 * @param ignoreError - If true, avoids exiting the process on error.
 */
export function runSync(command: string, cwd = REPO_ROOT, ignoreError = false, envVars: Record<string, string> = {}): void {
  try {
    console.log(`> ${command}`);
    execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, ...envVars } });
  } catch (_error) {
    if (!ignoreError) {
      console.error(`Command failed: ${command}`);
      process.exit(1);
    }
  }
}

/**
 * Checks whether a given CLI command is available on the host system.
 * @param command - The CLI command to check.
 * @returns True if the command is available in PATH, false otherwise.
 */
export function hasCommand(command: string): boolean {
  try {
    const cmd = IS_WINDOWS ? `where ${command}` : `command -v ${command}`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures the `wait4x` utility is installed via libscript.
 */
export function ensureWait4x(): void {
  if (!hasCommand('wait4x')) {
    console.log('Installing wait4x...');
    runSync(`"${LIBSCRIPT}" wait4x install wait4x`);
  }
}

/**
 * Validates and provisions the required core dependencies (Rust, Node, Postgres, Valkey).
 */
export function ensureDependencies(): void {
  console.log('Provisioning core dependencies...');
  runSync(`"${LIBSCRIPT}" rust install rust`);
  runSync(`"${LIBSCRIPT}" nodejs install nodejs`);

  console.log('Checking if databases are installed...');
  ensureWait4x();

  try {
    execSync(`"${LIBSCRIPT}" postgres test postgres`, { stdio: 'ignore' });
    console.log('PostgreSQL is already installed.');
  } catch {
    runSync(`"${LIBSCRIPT}" postgres install postgres`);
  }

  let hasValkey = false;
  let hasRedis = false;
  try {
    execSync(`"${LIBSCRIPT}" valkey test valkey`, { stdio: 'ignore' });
    hasValkey = true;
  } catch {}
  try {
    execSync(`"${LIBSCRIPT}" redis test redis`, { stdio: 'ignore' });
    hasRedis = true;
  } catch {}

  if (hasValkey) {
    console.log('Valkey is already installed.');
  } else if (hasRedis) {
    console.log('Redis is already installed.');
  } else {
    runSync(`"${LIBSCRIPT}" valkey install valkey`);
  }
}

/**
 * Waits for databases to start and initializes the PostgreSQL database if absent.
 */
export function setupDatabases(): void {
  console.log('Ensuring PostgreSQL is ready...');
  runSync(`wait4x postgresql "postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/postgres?sslmode=disable" -t 60s`);

  console.log('Setting up Postgres Database...');
  const createDbCmd = IS_WINDOWS
    ? `psql -h ${PG_HOST} -U ${PG_USER} -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | findstr "1" >nul || psql -h ${PG_HOST} -U ${PG_USER} -c "CREATE DATABASE cdd"`
    : `psql -h ${PG_HOST} -U ${PG_USER} -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | grep -q 1 || psql -h ${PG_HOST} -U ${PG_USER} -c "CREATE DATABASE cdd"`;
  runSync(createDbCmd);
}

/**
 * Attempts to download a prebuilt release for a rust microservice or builds from source via Cargo as a fallback.
 * @param repo - The GitHub repository name (e.g., 'cdd-gateway').
 * @param destDir - The destination directory for the downloaded or built executable.
 */
export function getOrBuildRustService(repo: string, destDir: string): void {
  console.log(`Resolving ${repo}...`);
  const repoPath = join(PARENT_DIR, repo);
  const finalBinPath = join(destDir, IS_WINDOWS ? `${repo}.exe` : repo);

  try {
    const releaseUrl = `https://api.github.com/repos/SamuelMarks/${repo}/releases/latest`;
    const res = execSync(`curl -sL ${releaseUrl}`).toString();
    const release = JSON.parse(res);

    let target = 'x86_64-unknown-linux-gnu';
    if (IS_WINDOWS) target = 'x86_64-pc-windows-msvc';
    else if (platform() === 'darwin' && process.arch === 'arm64') target = 'aarch64-apple-darwin';
    else if (platform() === 'darwin' && process.arch === 'x64') target = 'x86_64-apple-darwin';

    const asset = release.assets?.find((a: any) => a.name.includes(target));

    if (!asset) {
      throw new Error(`Asset for triplet ${target} not found (404).`);
    }

    const downloadUrl = asset.browser_download_url;
    const dlPath = join(destDir, asset.name);
    console.log(`Downloading ${downloadUrl} to ${dlPath}...`);
    execSync(`curl -sL -o "${dlPath}" "${downloadUrl}"`);

    if (asset.name.endsWith('.tar.gz')) {
      execSync(`tar -xf "${dlPath}" -C "${destDir}"`);
      rmSync(dlPath, { force: true });
      if (!existsSync(finalBinPath)) {
        const files = readdirSync(destDir);
        for (const f of files) {
          if (!f.endsWith('.tar.gz') && !f.endsWith('.zip') && f !== repo && !lstatSync(join(destDir, f)).isDirectory()) {
             renameSync(join(destDir, f), finalBinPath);
             break;
          }
        }
      }
    } else if (asset.name.endsWith('.zip')) {
      execSync(`tar -xf "${dlPath}" -C "${destDir}"`);
      rmSync(dlPath, { force: true });
      if (!existsSync(finalBinPath)) {
        const files = readdirSync(destDir);
        for (const f of files) {
          if (f.endsWith('.exe') && f !== `${repo}.exe`) {
             renameSync(join(destDir, f), finalBinPath);
             break;
          }
        }
      }
    } else {
      renameSync(dlPath, finalBinPath);
    }

    if (!IS_WINDOWS && existsSync(finalBinPath)) {
      chmodSync(finalBinPath, 0o755);
    }
    console.log(`Successfully downloaded ${repo} to ${finalBinPath}`);
  } catch (err: any) {
    console.warn(`Failed to fetch release for ${repo} (${err.message}). Falling back to cargo build...`);
    if (existsSync(repoPath)) {
      runSync('cargo build', repoPath);
    } else {
      console.warn(`Source directory ${repoPath} not found. Skipping build.`);
    }
  }
}

/**
 * Downloads or builds all relevant UI and Backend microservices.
 */
export function buildMicroservices(): void {
  console.log('Building and downloading cdd-* repositories...');
  const binDir = join(PARENT_DIR, 'bin');
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });

  for (const repo of MICROSERVICES) {
    const isRustBinary = ['cdd-control-plane', 'cdd-engine', 'cdd-storage', 'cdd-gateway', 'cdd-publisher'].includes(repo);
    if (isRustBinary) {
      getOrBuildRustService(repo, binDir);
    } else {
      const repoPath = join(PARENT_DIR, repo);
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
 * Generates external infrastructure packaging formats (docker, msi, deb).
 */
export function exportInfrastructure(): void {
  const outDir = join(PARENT_DIR, "dist");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const envOpts = { OUT_DIR: outDir };
  console.log('Exporting infrastructure formats...');
  runSync(`"${LIBSCRIPT}" package-as docker`, REPO_ROOT, false, envOpts);
  runSync(`"${LIBSCRIPT}" package-as docker_compose`, REPO_ROOT, false, envOpts);
}

/**
 * The main execution block. Validates requirements and executes the build script phases.
 */
export function main(): void {
  try {
    ensureDependencies();
    setupDatabases();
    buildMicroservices();
    exportInfrastructure();
    console.log('Deployment script completed successfully.');
  } catch (_error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
