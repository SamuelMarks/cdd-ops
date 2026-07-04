import { execSync, spawn, ChildProcess } from 'node:child_process';
import { platform } from 'node:os';
import { resolve, join } from 'node:path';
import { existsSync, readdirSync, lstatSync, readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, chmodSync } from 'node:fs';

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

export const DATABASE_URL = `postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/cdd`;
export const REDIS_URL = `redis://${VALKEY_HOST}:${VALKEY_PORT}`;

export const PORTS = [8081, 8082, 8083, 8084, 8085, 8086];

// Ensure libscript uses mise to avoid fnm concurrency bugs
process.env.NODEJS_INSTALL_METHOD = 'mise';

/**
 * Runs a command synchronously.
 * @param command - Command string.
 * @param cwd - Working directory.
 * @param ignoreError - Whether to ignore errors.
 * @param envVars - Extra environment variables.
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
 * Runs a command asynchronously.
 * @param command - Command string.
 * @param args - Command arguments.
 * @param cwd - Working directory.
 * @param envVars - Extra environment variables.
 * @returns ChildProcess instance.
 */
export function runAsync(command: string, args: string[], cwd = REPO_ROOT, envVars: Record<string, string> = {}): ChildProcess {
  console.log(`> [Background] ${command} ${args.join(' ')}`);
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...envVars },
    shell: IS_WINDOWS ? true : undefined,
  });

  child.on('error', (err) => {
    console.error(`Failed to start process ${command}:`, err);
  });

  return child;
}

/**
 * Checks if a CLI command exists.
 * @param command - Command name.
 * @returns boolean
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
 * Kills processes listening on specific ports.
 */
export function killPorts(): void {
  console.log('Cleaning up lingering ports...');
  for (const port of PORTS) {
    try {
      if (IS_WINDOWS) {
        const output = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = output.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 4 && parts[1].includes(`:${port}`)) {
            const pid = parts[parts.length - 1];
            if (pid !== '0') {
               console.log(`Killing process on port ${port} (PID: ${pid})`);
               execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            }
          }
        }
      } else {
        const pids = execSync(`lsof -Pi :${port} -sTCP:LISTEN -t`, { stdio: 'pipe' }).toString().trim();
        if (pids) {
          console.log(`Killing process on port ${port} (PIDs: ${pids})`);
          execSync(`kill -9 ${pids.split('\n').join(' ')}`, { stdio: 'ignore' });
        }
      }
    } catch {
      // Port might not be in use, ignore
    }
  }
}

/**
 * Ensures wait4x is installed.
 */
export function ensureWait4x(): void {
  if (!hasCommand('wait4x')) {
    console.log('Installing wait4x...');
    runSync(`"${LIBSCRIPT}" wait4x install wait4x`);
  }
}

/**
 * Ensures all core dependencies are installed.
 */
export function ensureDependencies(): void {
  if (!process.env.GITHUB_ACTIONS) {
    ensureWait4x();

    console.log('Checking if rust is installed...');
    try {
      execSync(`"${LIBSCRIPT}" rust test rust`, { stdio: 'ignore' });
      console.log('Rust is already installed.');
    } catch {
      runSync(`"${LIBSCRIPT}" rust install rust`);
    }

    console.log('Checking if nodejs is installed...');
    try {
      execSync(`"${LIBSCRIPT}" nodejs test nodejs`, { stdio: 'ignore' });
      console.log('Node.js is already installed.');
    } catch {
      runSync(`"${LIBSCRIPT}" nodejs install nodejs`);
    }

    console.log('Checking if databases are running or installed...');
    try {
      execSync(`wait4x tcp "${PG_HOST}:${PG_PORT}" -t 1s`, { stdio: 'ignore' });
      console.log(`PostgreSQL is already running on ${PG_HOST}:${PG_PORT}.`);
    } catch {
       try {
         execSync(`"${LIBSCRIPT}" postgres test postgres`, { stdio: 'ignore' });
         console.log('PostgreSQL is already installed.');
       } catch {
         runSync(`"${LIBSCRIPT}" postgres install postgres`);
       }
    }

    try {
      execSync(`wait4x tcp "${VALKEY_HOST}:${VALKEY_PORT}" -t 1s`, { stdio: 'ignore' });
      console.log(`Redis/Valkey is already running on ${VALKEY_HOST}:${VALKEY_PORT}.`);
    } catch {
      let hasRedis = false;
      let hasValkey = false;
      try { execSync(`"${LIBSCRIPT}" redis test redis`, { stdio: 'ignore' }); hasRedis = true; } catch {}
      try { execSync(`"${LIBSCRIPT}" valkey test valkey`, { stdio: 'ignore' }); hasValkey = true; } catch {}

      if (hasRedis || hasValkey) {
        console.log('Redis/Valkey is already installed.');
      } else {
        runSync(`"${LIBSCRIPT}" valkey install valkey`);
      }
    }
  }
}

/**
 * Sets up and migrates the PostgreSQL database.
 */
export function setupDatabases(): void {
  console.log('Ensuring PostgreSQL is ready...');
  runSync(`wait4x postgresql "postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/postgres?sslmode=disable" -t 60s`);

  console.log('Ensuring Redis/Valkey is ready...');
  runSync(`wait4x redis "redis://${VALKEY_HOST}:${VALKEY_PORT}" -t 60s`);

  console.log('Setting up Postgres Database for local tests...');
  const createDbCmd = IS_WINDOWS
    ? `psql -h ${PG_HOST} -U ${PG_USER} -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | findstr "1" >nul || psql -h ${PG_HOST} -U ${PG_USER} -c "CREATE DATABASE cdd"`
    : `psql -h ${PG_HOST} -U ${PG_USER} -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | grep -q 1 || psql -h ${PG_HOST} -U ${PG_USER} -c "CREATE DATABASE cdd"`;
  runSync(createDbCmd);

  console.log('Ensuring diesel_cli is installed...');
  if (!hasCommand('diesel')) {
      runSync('cargo install diesel_cli --no-default-features --features postgres');
  }

  console.log('Running Diesel Migrations via diesel cli...');
  runSync('diesel migration run', join(PARENT_DIR, 'cdd-control-plane'), false, { DATABASE_URL });
}

/**
 * Downloads a prebuilt release for a rust microservice or builds from source via Cargo as a fallback.
 * @param repo - Repository name.
 * @param destDir - Destination directory.
 * @param cargoEnv - Environment variables for cargo.
 * @returns Object with command details.
 */
export function getOrBuildRustService(repo: string, destDir: string, cargoEnv: Record<string, string>): { cmd: string, args: string[], cwd: string } {
  console.log(`Resolving ${repo}...`);
  const repoPath = join(PARENT_DIR, repo);
  const finalBinPath = join(destDir, IS_WINDOWS ? `${repo}.exe` : repo);

  try {
    const releaseUrl = `https://api.github.com/repos/SamuelMarks/${repo}/releases/latest`;
    const curlOpts = process.env.GITHUB_TOKEN ? `-H "Authorization: token ${process.env.GITHUB_TOKEN}"` : '';
    const res = execSync(`curl -sL ${curlOpts} ${releaseUrl}`).toString();
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
      const tempDir = join(destDir, `temp-${repo}`);
      mkdirSync(tempDir, { recursive: true });
      execSync(`tar -xf "${dlPath}" -C "${tempDir}"`);
      rmSync(dlPath, { force: true });
      if (!existsSync(finalBinPath)) {
        const files = readdirSync(tempDir);
        for (const f of files) {
          if (!f.endsWith('.tar.gz') && !f.endsWith('.zip') && !lstatSync(join(tempDir, f)).isDirectory()) {
             renameSync(join(tempDir, f), finalBinPath);
             break;
          }
        }
      }
      rmSync(tempDir, { recursive: true, force: true });
    } else if (asset.name.endsWith('.zip')) {
      const tempDir = join(destDir, `temp-${repo}`);
      mkdirSync(tempDir, { recursive: true });
      execSync(`tar -xf "${dlPath}" -C "${tempDir}"`);
      rmSync(dlPath, { force: true });
      if (!existsSync(finalBinPath)) {
        const files = readdirSync(tempDir);
        for (const f of files) {
          if (f.endsWith('.exe') || (!f.includes('.') && !lstatSync(join(tempDir, f)).isDirectory())) {
             renameSync(join(tempDir, f), finalBinPath);
             break;
          }
        }
      }
      rmSync(tempDir, { recursive: true, force: true });
    } else {
      renameSync(dlPath, finalBinPath);
    }

    if (!IS_WINDOWS && existsSync(finalBinPath)) {
      chmodSync(finalBinPath, 0o755);
    }
    console.log(`Successfully downloaded ${repo} to ${finalBinPath}`);
    return { cmd: finalBinPath, args: [], cwd: destDir };
  } catch (err: any) {
    console.warn(`Failed to fetch release for ${repo} (${err.message}). Falling back to cargo build...`);
    if (existsSync(repoPath)) {
      runSync('cargo build', repoPath, false, cargoEnv);
      return { cmd: 'cargo', args: ['run', '--bin', repo], cwd: repoPath };
    } else {
      console.error(`Source directory ${repoPath} not found. Cannot build from source.`);
      process.exit(1);
    }
  }
}

/**
 * Builds all services and starts them in the background.
 * @returns Array of child processes.
 */
export function buildAndStartServices(): ChildProcess[] {
  console.log('Resolving pre-built Rust services (or building from source fallback)...');
  const binDir = join(PARENT_DIR, 'bin');
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });

  const sharedTargetDir = join(PARENT_DIR, 'shared-cargo-target');
  const cargoEnv = {
      CARGO_TARGET_DIR: sharedTargetDir,
      CARGO_PROFILE_DEV_DEBUG: '0'
  };

  const cpSvc = getOrBuildRustService('cdd-control-plane', binDir, cargoEnv);
  const storageSvc = getOrBuildRustService('cdd-storage', binDir, cargoEnv);
  const gatewaySvc = getOrBuildRustService('cdd-gateway', binDir, cargoEnv);

  const processes: ChildProcess[] = [];
  const envConfig = {
      CDD__DATABASE_URL: DATABASE_URL,
      CDD__REDIS_URL: REDIS_URL,
      ...cargoEnv,
  };

  console.log('Starting cdd-control-plane...');
  processes.push(runAsync(cpSvc.cmd, cpSvc.args, cpSvc.cwd, {
      ...envConfig,
      CDD__SERVER_BIND: '0.0.0.0:8081'
  }));

  console.log('Starting cdd-storage...');
  processes.push(runAsync(storageSvc.cmd, storageSvc.args, storageSvc.cwd, {
      ...envConfig,
      PORT: '8085'
  }));

  console.log('Starting cdd-docs-ui...');
  const docsUiPath = join(PARENT_DIR, 'cdd-docs-ui');
  runSync('npm install', docsUiPath);
  runSync('npm run build', docsUiPath);
  processes.push(runAsync('npm', ['run', 'serve'], docsUiPath, envConfig));

  console.log('Patching cdd-web-ui to use GITHUB_TOKEN...');
  const wasmScriptPath = join(PARENT_DIR, 'cdd-web-ui', 'scripts', 'build-wasm.mjs');
  if (existsSync(wasmScriptPath)) {
    let scriptContent = readFileSync(wasmScriptPath, 'utf8');
    scriptContent = scriptContent.replace(
      /{ headers: { 'User-Agent': 'node.js' } }/g,
      "{ headers: { 'User-Agent': 'node.js', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } }"
    );
    writeFileSync(wasmScriptPath, scriptContent);
  }

  console.log('Starting cdd-web-ui...');
  const webUiPath = join(PARENT_DIR, 'cdd-web-ui');
  runSync('npm install', webUiPath);
  runSync('npm run build', webUiPath);
  processes.push(runAsync('npx', ['--yes', 'serve', '-s', join('dist', 'cdd-web-ui', 'browser'), '-l', '8083'], webUiPath, envConfig));

  console.log('Starting cdd-gateway...');
  processes.push(runAsync(gatewaySvc.cmd, gatewaySvc.args, gatewaySvc.cwd, {
      ...envConfig,
      CDD__SERVER_BIND: '0.0.0.0:8086'
  }));

  return processes;
}

/**
 * Runs end-to-end tests via Playwright.
 */
export function runE2eTests(): void {
  console.log('Waiting for Gateway to be healthy on port 8086...');
  runSync('wait4x http http://localhost:8086/version http://localhost:8086/api/v1/health http://localhost:8086/ --expect-status-code 200 -t 900s');
  console.log('Gateway and downstream services are up!');

  console.log('Running E2E tests locally...');
  const e2ePath = join(REPO_ROOT, 'e2e');
  runSync('npm install', e2ePath);
  runSync('npx playwright install --with-deps', e2ePath);

  try {
      console.log(`> npx playwright test`);
      execSync('npx playwright test', {
          cwd: e2ePath,
          stdio: 'inherit',
          env: { ...process.env, BASE_URL: 'http://localhost:8086' }
      });
  } catch (_error) {
      console.error(`Command failed: npx playwright test`);
      process.exit(1);
  }
}

/**
 * The main execution block. Validates requirements, starts background services, runs tests, and cleans up.
 */
export function main(): void {
  let bgProcesses: ChildProcess[] = [];

  /**
   * Cleans up background processes.
   */
  const cleanup = () => {
      console.log('Shutting down background processes...');
      for (const p of bgProcesses) {
          try {
              if (IS_WINDOWS) {
                  execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' });
              } else {
                  p.kill('SIGKILL');
              }
          } catch (_e) {
              // ignore
          }
      }
  };

  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });
  process.on('exit', cleanup);

  try {
    killPorts();
    ensureDependencies();
    setupDatabases();
    bgProcesses = buildAndStartServices();
    runE2eTests();
    console.log('Tests completed successfully.');
    cleanup();
    process.exit(0);
  } catch (_error) {
    console.error('Test execution failed:', error);
    cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
