import { execSync, spawn, ChildProcess } from 'node:child_process';
import { platform } from 'node:os';
import { resolve, join } from 'node:path';
import { existsSync, readdirSync, lstatSync } from 'node:fs';

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

const MICROSERVICES = [
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

function hasCommand(command: string): boolean {
  try {
    const cmd = IS_WINDOWS ? `where ${command}` : `command -v ${command}`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
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
  console.log('Provisioning core dependencies...');
  runSync(`"${LIBSCRIPT}" install rust`);
  runSync(`"${LIBSCRIPT}" install nodejs`);

  console.log('Checking if databases are installed...');
  ensureWait4x();

  try {
    execSync(`"${LIBSCRIPT}" test postgres`, { stdio: 'ignore' });
    console.log('PostgreSQL is already installed.');
  } catch {
    runSync(`"${LIBSCRIPT}" install postgres`);
  }

  let hasValkey = false;
  let hasRedis = false;
  try {
    execSync(`"${LIBSCRIPT}" test valkey`, { stdio: 'ignore' });
    hasValkey = true;
  } catch {}
  try {
    execSync(`"${LIBSCRIPT}" test redis`, { stdio: 'ignore' });
    hasRedis = true;
  } catch {}

  if (hasValkey) {
    console.log('Valkey is already installed.');
  } else if (hasRedis) {
    console.log('Redis is already installed.');
  } else {
    runSync(`"${LIBSCRIPT}" install valkey`);
  }
}

function setupDatabases() {
  console.log('Ensuring PostgreSQL is ready...');
  runSync(`wait4x postgresql "postgres://${PG_USER}@${PG_HOST}:${PG_PORT}/postgres?sslmode=disable" -t 60s`);

  console.log('Setting up Postgres Database...');
  const createDbCmd = IS_WINDOWS
    ? `psql -h ${PG_HOST} -U ${PG_USER} -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | findstr "1" >nul || psql -h ${PG_HOST} -U ${PG_USER} -c "CREATE DATABASE cdd"`
    : `psql -h ${PG_HOST} -U ${PG_USER} -tc "SELECT 1 FROM pg_database WHERE datname = 'cdd'" | grep -q 1 || psql -h ${PG_HOST} -U ${PG_USER} -c "CREATE DATABASE cdd"`;
  runSync(createDbCmd);
}

function buildMicroservices() {
  console.log('Building cdd-* repositories in-place...');
  for (const repo of MICROSERVICES) {
    const repoPath = join(PARENT_DIR, repo);
    if (existsSync(repoPath) && lstatSync(repoPath).isDirectory()) {
      console.log(`Building ${repo}...`);
      if (existsSync(join(repoPath, 'Cargo.toml'))) {
        runSync('cargo build', repoPath);
      } else if (existsSync(join(repoPath, 'package.json'))) {
        runSync('npm install', repoPath);
        runSync('npm run build --if-present', repoPath);
      }
    } else {
      console.log(`Warning: Repository ${repoPath} not found, skipping.`);
    }
  }
}

function exportInfrastructure() {
  console.log('Exporting infrastructure formats...');
  runSync(`"${LIBSCRIPT}" package_as docker`);
  runSync(`"${LIBSCRIPT}" package_as docker-compose`);
  runSync(`"${LIBSCRIPT}" package_as msi`);
  runSync(`"${LIBSCRIPT}" package_as exe`);
  runSync(`"${LIBSCRIPT}" package_as deb`);
}

function main() {
  try {
    ensureDependencies();
    setupDatabases();
    buildMicroservices();
    exportInfrastructure();
    console.log('Deployment script completed successfully.');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

main();
