/**
 * @file Strongly-typed interfaces, type aliases, and type guards for CDD operations.
 * @module scripts/lib/types
 */

/**
 * Represents a single downloadable release asset from the GitHub Releases API.
 */
export interface GitHubReleaseAsset {
  /** The filename of the release asset. */
  readonly name: string;
  /** The direct browser download URL for the release asset. */
  readonly browser_download_url: string;
}

/**
 * Represents a GitHub Release payload returned by the GitHub REST API.
 */
export interface GitHubRelease {
  /** The list of downloadable assets attached to the release. */
  readonly assets?: readonly GitHubReleaseAsset[];
}

/**
 * Resolved runtime configuration for CDD operations scripts.
 */
export interface OpsConfig {
  /** Path to the POSIX libscript executable (`libscript.sh`). */
  readonly libscriptSh: string;
  /** Path to the Windows libscript executable (`libscript.cmd`). */
  readonly libscriptCmd: string;
  /** True if the target platform is Windows (`win32`). */
  readonly isWindows: boolean;
  /** Active libscript executable path for the target platform. */
  readonly libscript: string;
  /** Root directory of the `cdd-ops` repository. */
  readonly repoRoot: string;
  /** Parent directory containing all sibling `cdd-*` repositories. */
  readonly parentDir: string;
  /** PostgreSQL hostname. */
  readonly pgHost: string;
  /** PostgreSQL port string. */
  readonly pgPort: string;
  /** PostgreSQL username. */
  readonly pgUser: string;
  /** Valkey/Redis hostname. */
  readonly valkeyHost: string;
  /** Valkey/Redis port string. */
  readonly valkeyPort: string;
  /** Full PostgreSQL connection string for the `cdd` database. */
  readonly databaseUrl: string;
  /** Full Redis/Valkey connection string. */
  readonly redisUrl: string;
  /** Optional GitHub API personal access token for authenticated release queries. */
  readonly githubToken?: string;
  /** True when executing inside a GitHub Actions runner environment. */
  readonly isGithubActions: boolean;
  /** Target OS platform identifier. */
  readonly osPlatform: NodeJS.Platform;
  /** Target CPU architecture identifier. */
  readonly arch: string;
}

/**
 * Describes the resolved command, arguments, and working directory to launch a Rust microservice.
 */
export interface RustServiceCommand {
  /** Executable path or command name (e.g., `/path/to/bin/cdd-gateway` or `cargo`). */
  readonly cmd: string;
  /** Command-line arguments passed when spawning the service. */
  readonly args: string[];
  /** Working directory in which the service should be started. */
  readonly cwd: string;
}

/**
 * Options controlling how core dependencies are checked and provisioned.
 */
export interface EnsureDependenciesOptions {
  /** If true, skips dependency provisioning when `GITHUB_ACTIONS` is set. */
  readonly skipInCi?: boolean;
  /** If true, checks whether Rust and Node.js are already installed before invoking install. */
  readonly checkToolchainsFirst?: boolean;
  /** If true, probes live TCP ports for PostgreSQL and Valkey/Redis before testing/installing packages. */
  readonly checkRunningDatabasesFirst?: boolean;
  /** Optional custom configuration override. */
  readonly config?: OpsConfig;
}

/**
 * Options controlling how PostgreSQL and Valkey/Redis databases are initialized.
 */
export interface SetupDatabasesOptions {
  /** If true, waits for Redis/Valkey readiness via `wait4x redis`. */
  readonly waitForRedis?: boolean;
  /** If true, ensures `diesel_cli` is installed and runs Diesel migrations on `cdd-control-plane`. */
  readonly runMigrations?: boolean;
  /** Optional custom configuration override. */
  readonly config?: OpsConfig;
}

/**
 * Fallback behavior when a prebuilt Rust release cannot be downloaded.
 */
export type RustFallbackMode = 'skip-if-missing' | 'exit-if-missing';

/**
 * Database and state lifecycle verbs supported by `libscript`.
 */
export type LibscriptDbAction = 'provision-db' | 'deprovision-db' | 'export-state' | 'import-state';

/**
 * Metadata extracted from `packaging.json` for invoking `libscript package-as` installer generators.
 */
export interface PackagingManifestSummary {
  /** Component or stack identifier (e.g., `'cdd'`). */
  readonly name: string;
  /** Human-readable product title (e.g., `'Compiler Driven Development (CDD) Platform'`). */
  readonly title: string;
  /** Semantic version string (e.g., `'0.0.1'`). */
  readonly version: string;
  /** Publisher or organization name (e.g., `'CDD Open Source Project'`). */
  readonly publisher: string;
  /** Deterministic UUIDv4 upgrade code GUID. */
  readonly upgrade_code: string;
}

/**
 * Supported `libscript package-as` distribution, container, and image target formats.
 */
export type PackageFormat =
  | 'docker'
  | 'dockerfile'
  | 'docker_compose'
  | 'docker-compose'
  | 'docker-image'
  | 'oci-image'
  | 'msi'
  | 'innosetup'
  | 'nsis'
  | 'deb'
  | 'rpm'
  | 'apk'
  | 'txz'
  | 'pkg'
  | 'dmg'
  | 'tui'
  | 'iso'
  | 'raw-img'
  | 'qcow2'
  | 'vmdk'
  | 'vdi'
  | 'rootfs-tar'
  | 'bsd-img'
  | 'illumos-distro'
  | 'freebsd-distro'
  | 'unikernel'
  | 'qemu-qcow2'
  | 'vmware-vmdk'
  | 'hyperv-vhd'
  | 'hyperv-vhdx'
  | 'proxmox-template'
  | 'virtualbox-vdi'
  | 'virtualbox-ova'
  | 'xen-img'
  | 'microvm-disk'
  | 'aws-ami'
  | 'azure-vhd'
  | 'gcp-image'
  | 'cloud-img'
  | 'vagrant-box'
  | 'disk-builder';

/**
 * Immutable list of all valid {@link PackageFormat} identifiers supported by `libscript package-as`.
 */
export const PACKAGE_FORMATS: readonly PackageFormat[] = [
  'docker',
  'dockerfile',
  'docker_compose',
  'docker-compose',
  'docker-image',
  'oci-image',
  'msi',
  'innosetup',
  'nsis',
  'deb',
  'rpm',
  'apk',
  'txz',
  'pkg',
  'dmg',
  'tui',
  'iso',
  'raw-img',
  'qcow2',
  'vmdk',
  'vdi',
  'rootfs-tar',
  'bsd-img',
  'illumos-distro',
  'freebsd-distro',
  'unikernel',
  'qemu-qcow2',
  'vmware-vmdk',
  'hyperv-vhd',
  'hyperv-vhdx',
  'proxmox-template',
  'virtualbox-vdi',
  'virtualbox-ova',
  'xen-img',
  'microvm-disk',
  'aws-ami',
  'azure-vhd',
  'gcp-image',
  'cloud-img',
  'vagrant-box',
  'disk-builder',
];

/**
 * Checks whether an unknown value is a valid {@link PackageFormat}.
 * @param value - The unknown value to inspect.
 * @returns True if the value is a valid {@link PackageFormat}.
 */
export function isPackageFormat(value: unknown): value is PackageFormat {
  return typeof value === 'string' && (PACKAGE_FORMATS as readonly string[]).includes(value);
}

/**
 * Options for resolving or building a Rust microservice binary.
 */
export interface GetOrBuildRustServiceOptions {
  /** Extra environment variables passed to `cargo build` on fallback. */
  readonly cargoEnv?: Record<string, string>;
  /** Behavior when the source repository directory does not exist during fallback. */
  readonly fallbackMode?: RustFallbackMode;
  /** Optional custom configuration override. */
  readonly config?: OpsConfig;
}

/**
 * Checks whether an unknown value is a valid {@link GitHubReleaseAsset}.
 * @param value - The unknown value to inspect.
 * @returns True if the value conforms to {@link GitHubReleaseAsset}.
 */
export function isGitHubReleaseAsset(value: unknown): value is GitHubReleaseAsset {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record['name'] === 'string' && typeof record['browser_download_url'] === 'string';
}

/**
 * Checks whether an unknown value is a valid {@link GitHubRelease}.
 * @param value - The unknown value to inspect.
 * @returns True if the value conforms to {@link GitHubRelease}.
 */
export function isGitHubRelease(value: unknown): value is GitHubRelease {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record['assets'] === undefined) {
    return true;
  }
  return Array.isArray(record['assets']) && record['assets'].every(isGitHubReleaseAsset);
}

/**
 * Safely formats an unknown caught error value into a human-readable message string.
 * @param error - The caught error value of type `unknown`.
 * @returns A string describing the error.
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
