/**
 * @file Strongly-typed interfaces, type aliases, and type guards for CDD operations.
 * @module scripts/lib/types
 */

/**
 * Supported target languages across the 13 `cdd-*` language compilers.
 */
export type CddTargetLanguage =
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'java'
  | 'kotlin'
  | 'php'
  | 'python'
  | 'ruby'
  | 'rust'
  | 'sh'
  | 'swift'
  | 'ts';

/**
 * Immutable list of all 13 supported {@link CddTargetLanguage} identifiers.
 */
export const CDD_TARGET_LANGUAGES: readonly CddTargetLanguage[] = [
  'c',
  'cpp',
  'csharp',
  'go',
  'java',
  'kotlin',
  'php',
  'python',
  'ruby',
  'rust',
  'sh',
  'swift',
  'ts',
];

/**
 * Checks whether an unknown value is a valid {@link CddTargetLanguage}.
 * @param value - The unknown value to inspect.
 * @returns True if the value is a valid {@link CddTargetLanguage}.
 */
export function isCddTargetLanguage(value: unknown): value is CddTargetLanguage {
  return typeof value === 'string' && (CDD_TARGET_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Repository names for the 13 `cdd-*` language compilers.
 */
export type CddCompilerRepo =
  | 'cdd-c'
  | 'cdd-cpp'
  | 'cdd-csharp'
  | 'cdd-go'
  | 'cdd-java'
  | 'cdd-kotlin'
  | 'cdd-php'
  | 'cdd-python-all'
  | 'cdd-ruby'
  | 'cdd-rust'
  | 'cdd-sh'
  | 'cdd-swift'
  | 'cdd-ts';

/**
 * Immutable list of all 13 {@link CddCompilerRepo} repository names.
 */
export const CDD_COMPILER_REPOS: readonly CddCompilerRepo[] = [
  'cdd-c',
  'cdd-cpp',
  'cdd-csharp',
  'cdd-go',
  'cdd-java',
  'cdd-kotlin',
  'cdd-php',
  'cdd-python-all',
  'cdd-ruby',
  'cdd-rust',
  'cdd-sh',
  'cdd-swift',
  'cdd-ts',
];

/**
 * WebAssembly artifact filenames for the 13 `cdd-*` language compilers.
 */
export type CddWasmArtifact =
  | 'cdd-c.wasm'
  | 'cdd-cpp.wasm'
  | 'cdd-csharp.wasm'
  | 'cdd-go.wasm'
  | 'cdd-java.wasm'
  | 'cdd-kotlin.wasm'
  | 'cdd-php.wasm'
  | 'cdd-python-all.wasm'
  | 'cdd-ruby.wasm'
  | 'cdd-rust.wasm'
  | 'cdd-sh.wasm'
  | 'cdd-swift.wasm'
  | 'cdd-ts.wasm';

/**
 * Immutable list of all 13 {@link CddWasmArtifact} filenames.
 */
export const CDD_WASM_ARTIFACTS: readonly CddWasmArtifact[] = [
  'cdd-c.wasm',
  'cdd-cpp.wasm',
  'cdd-csharp.wasm',
  'cdd-go.wasm',
  'cdd-java.wasm',
  'cdd-kotlin.wasm',
  'cdd-php.wasm',
  'cdd-python-all.wasm',
  'cdd-ruby.wasm',
  'cdd-rust.wasm',
  'cdd-sh.wasm',
  'cdd-swift.wasm',
  'cdd-ts.wasm',
];

/**
 * Supported API specification input formats across the CDD platform.
 */
export type CddSpecFormat =
  | 'swagger_2_0'
  | 'openapi_3_0'
  | 'openapi_3_1'
  | 'openapi_3_2'
  | 'arazzo_1_1'
  | 'google_discovery_v1';

/**
 * Immutable list of all supported {@link CddSpecFormat} identifiers.
 */
export const CDD_SPEC_FORMATS: readonly CddSpecFormat[] = [
  'swagger_2_0',
  'openapi_3_0',
  'openapi_3_1',
  'openapi_3_2',
  'arazzo_1_1',
  'google_discovery_v1',
];

/**
 * Checks whether an unknown value is a valid {@link CddSpecFormat}.
 * @param value - The unknown value to inspect.
 * @returns True if the value is a valid {@link CddSpecFormat}.
 */
export function isCddSpecFormat(value: unknown): value is CddSpecFormat {
  return typeof value === 'string' && (CDD_SPEC_FORMATS as readonly string[]).includes(value);
}

/**
 * Supported package registries and app stores for `cdd-publisher` releases.
 */
export type CddRegistryType =
  | 'crates-io'
  | 'npm'
  | 'pypi'
  | 'maven'
  | 'gradle'
  | 'nuget'
  | 'rubygems'
  | 'packagist'
  | 'go-proxy'
  | 'swift-registry'
  | 'conan'
  | 'vcpkg'
  | 'homebrew'
  | 'apk'
  | 'deb'
  | 'rpm'
  | 'pkg';

/**
 * Immutable list of all supported {@link CddRegistryType} package registry targets.
 */
export const CDD_REGISTRY_TYPES: readonly CddRegistryType[] = [
  'crates-io',
  'npm',
  'pypi',
  'maven',
  'gradle',
  'nuget',
  'rubygems',
  'packagist',
  'go-proxy',
  'swift-registry',
  'conan',
  'vcpkg',
  'homebrew',
  'apk',
  'deb',
  'rpm',
  'pkg',
];

/**
 * Checks whether an unknown value is a valid {@link CddRegistryType}.
 * @param value - The unknown value to inspect.
 * @returns True if the value is a valid {@link CddRegistryType}.
 */
export function isCddRegistryType(value: unknown): value is CddRegistryType {
  return typeof value === 'string' && (CDD_REGISTRY_TYPES as readonly string[]).includes(value);
}

/**
 * Supported documentation hosting targets for generated HTML API documentation.
 */
export type CddDocHostingTarget =
  | 'cdd-docs-ui'
  | 'github-pages'
  | 'readthedocs'
  | 'docs-rs'
  | 'pkg-go-dev'
  | 'javadoc-io';

/**
 * Immutable list of all supported {@link CddDocHostingTarget} documentation hosting targets.
 */
export const CDD_DOC_HOSTING_TARGETS: readonly CddDocHostingTarget[] = [
  'cdd-docs-ui',
  'github-pages',
  'readthedocs',
  'docs-rs',
  'pkg-go-dev',
  'javadoc-io',
];

/**
 * Checks whether an unknown value is a valid {@link CddDocHostingTarget}.
 * @param value - The unknown value to inspect.
 * @returns True if the value is a valid {@link CddDocHostingTarget}.
 */
export function isCddDocHostingTarget(value: unknown): value is CddDocHostingTarget {
  return typeof value === 'string' && (CDD_DOC_HOSTING_TARGETS as readonly string[]).includes(value);
}

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
  /** Google OAuth 2.0 Client ID (`CDD__GOOGLE_CLIENT_ID`). */
  readonly googleClientId: string;
  /** Google OAuth 2.0 Client Secret (`CDD__GOOGLE_CLIENT_SECRET`). */
  readonly googleClientSecret: string;
  /** Google OAuth 2.0 Token/Authorization URL (`CDD__GOOGLE_OAUTH_URL`). */
  readonly googleOauthUrl: string;
  /** Google OAuth 2.0 UserInfo endpoint URL (`CDD__GOOGLE_USERINFO_URL`). */
  readonly googleUserinfoUrl: string;
  /** GitHub OAuth 2.0 Client ID (`CDD__GITHUB_CLIENT_ID`). */
  readonly githubClientId: string;
  /** GitHub OAuth 2.0 Client Secret (`CDD__GITHUB_CLIENT_SECRET`). */
  readonly githubClientSecret: string;
  /** Target GitHub organization name (`GITHUB_ORG_NAME`) for SDK repository provisioning. */
  readonly githubOrgName: string;
  /** Shared secret key for `cdd-storage` S3/object storage authentication. */
  readonly storageSecretKey: string;
  /** PGP key identifier (`CDD__PGP_KEY_ID`) used by `cdd-publisher` to sign artifacts. */
  readonly pgpKeyId: string;
  /** Directory containing `cdd-cpp.wasm` and all 13 `cdd-<lang>.wasm` compiler artifacts. */
  readonly wasmDir: string;
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
  /** Semantic version string (e.g., `'0.0.5'`). */
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
