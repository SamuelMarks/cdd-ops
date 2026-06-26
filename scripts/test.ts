import { execSync, spawn, ChildProcess } from 'node:child_process';
import { platform } from 'node:os';
import { resolve, join } from 'node:path';
import { existsSync, readdirSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';

// Constants
const LIBSCRIPT_SH = resolve(__dirname, '../../libscript/libscript.sh');
const LIBSCRIPT_CMD = resolve(__dirname, '../../libscript/libscript.cmd');
const IS_WINDOWS = platform() === 'win32';
const LIBSCRIPT = IS_WINDOWS ? LIBSCRIPT_CMD : LIBSCRIPT_SH;
const REPO_ROOT = resolve(__dirname, '..');
const PARENT_DIR = resolve(REPO_ROOT, '..');

const PG_HOST = process.env.POSTGRES_HOST || 'localhost';
const PG_PORT = process.env.POSTGRES_PORT || '5432';
const PG_USER = process.env.POSTGRES_USER || 'postgres';
const VALKEY_HOST = process.env.VALKEY_HOST || 'localhost';
const VALKEY_PORT = process.env.VALKEY_PORT || '6379';

const DATABASE_URL = `postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/cdd`;
const REDIS_URL = `redis://${VALKEY_HOST}:${VALKEY_PORT}`;

const PORTS = [8081, 8082, 8083, 8084, 8085, 8086];

// Ensure libscript uses mise to avoid fnm concurrency bugs
process.env.NODEJS_INSTALL_METHOD = 'source';

// Utils
function runSync(command: string, cwd = REPO_ROOT, ignoreError = false): void {
  try {
    console.log(`> ${command}`);
    execSync(command, { cwd, stdio: 'inherit', env: process.env });
  } catch (error) {
    if (!ignoreError) {
      console.error(`Command failed: ${command}`);
      process.exit(1);
    }
  }
}

function runAsync(command: string, args: string[], cwd = REPO_ROOT, envVars: Record<string, string> = {}): ChildProcess {
  console.log(`> [Background] ${command} ${args.join(' ')}`);
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...envVars },
    shell: IS_WINDOWS ? true : undefined, // Use shell on Windows for cmd-style execution
  });

  child.on('error', (err) => {
    console.error(`Failed to start process ${command}:`, err);
  });

  return child;
}

function hasCommand(command: string): boolean {
  try {
    const cmd = IS_WINDOWS ? `where ${command}` : `command -v ${command}`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function killPorts() {
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

// Ensure wait4x is installed
function ensureWait4x() {
  if (!hasCommand('wait4x')) {
    console.log('Installing wait4x...');
    runSync(`"${LIBSCRIPT}" install wait4x`);
  }
}

function ensureDependencies() {
  ensureWait4x();

  if (!process.env.GITHUB_ACTIONS) {
    console.log('Checking if rust is installed...');
    try {
      execSync(`"${LIBSCRIPT}" test rust`, { stdio: 'ignore' });
      console.log('Rust is already installed.');
    } catch {
      runSync(`"${LIBSCRIPT}" install rust`);
    }

    console.log('Checking if nodejs is installed...');
    try {
      execSync(`"${LIBSCRIPT}" test nodejs`, { stdio: 'ignore' });
      console.log('Node.js is already installed.');
    } catch {
      runSync(`"${LIBSCRIPT}" install nodejs`);
    }

    console.log('Checking if databases are running or installed...');
    try {
      execSync(`wait4x tcp "${PG_HOST}:${PG_PORT}" -t 1s`, { stdio: 'ignore' });
      console.log(`PostgreSQL is already running on ${PG_HOST}:${PG_PORT}.`);
    } catch {
       try {
         execSync(`"${LIBSCRIPT}" test postgres`, { stdio: 'ignore' });
         console.log('PostgreSQL is already installed.');
       } catch {
         runSync(`"${LIBSCRIPT}" install postgres`);
       }
    }

    try {
      execSync(`wait4x tcp "${VALKEY_HOST}:${VALKEY_PORT}" -t 1s`, { stdio: 'ignore' });
      console.log(`Redis/Valkey is already running on ${VALKEY_HOST}:${VALKEY_PORT}.`);
    } catch {
      let hasRedis = false;
      let hasValkey = false;
      try { execSync(`"${LIBSCRIPT}" test redis`, { stdio: 'ignore' }); hasRedis = true; } catch {}
      try { execSync(`"${LIBSCRIPT}" test valkey`, { stdio: 'ignore' }); hasValkey = true; } catch {}

      if (hasRedis || hasValkey) {
        console.log('Redis/Valkey is already installed.');
      } else {
        runSync(`"${LIBSCRIPT}" install valkey`);
      }
    }
  }
}

function setupDatabases() {
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
  runSync('diesel migration run', join(PARENT_DIR, 'cdd-control-plane'), false);
}

function buildAndStartServices(): ChildProcess[] {
  console.log('Pre-building Rust services sequentially to avoid cargo lock contention...');
  runSync('cargo build', join(PARENT_DIR, 'cdd-control-plane'));
  runSync('cargo build', join(PARENT_DIR, 'cdd-storage'));
  runSync('cargo build', join(PARENT_DIR, 'cdd-gateway'));

  const processes: ChildProcess[] = [];
  const envConfig = {
      CDD__DATABASE_URL: DATABASE_URL,
      CDD__REDIS_URL: REDIS_URL,
  };

  console.log('Starting cdd-control-plane...');
  processes.push(runAsync('cargo', ['run'], join(PARENT_DIR, 'cdd-control-plane'), {
      ...envConfig,
      CDD__SERVER_BIND: '0.0.0.0:8081'
  }));

  console.log('Starting cdd-storage...');
  processes.push(runAsync('cargo', ['run'], join(PARENT_DIR, 'cdd-storage'), {
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
  processes.push(runAsync('npm', ['start'], webUiPath, envConfig));

  console.log('Starting cdd-gateway...');
  processes.push(runAsync('cargo', ['run'], join(PARENT_DIR, 'cdd-gateway'), {
      ...envConfig,
      CDD__SERVER_BIND: '0.0.0.0:8086'
  }));

  return processes;
}

function runE2eTests() {
  console.log('Waiting for Gateway to be healthy on port 8086...');
  runSync('wait4x http http://localhost:8086/version http://localhost:8086/api/v1/health http://localhost:8086/ --expect-status-code 200 -t 360s');
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
  } catch (error) {
      console.error(`Command failed: npx playwright test`);
      process.exit(1);
  }
}

function main() {
  let bgProcesses: ChildProcess[] = [];

  const cleanup = () => {
      console.log('Shutting down background processes...');
      for (const p of bgProcesses) {
          try {
              if (IS_WINDOWS) {
                  execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' });
              } else {
                  p.kill('SIGKILL');
              }
          } catch (e) {
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
  } catch (error) {
    console.error('Test execution failed:', error);
    cleanup();
    process.exit(1);
  }
}

main();
