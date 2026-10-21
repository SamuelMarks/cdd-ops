/**
 * @file Rust microservice release resolution, archive extraction, and Cargo build fallback.
 * @module scripts/lib/rust-service
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, lstatSync, mkdirSync, rmSync, renameSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from './constants';
import { runSync } from './exec';
import {
  formatError,
  GetOrBuildRustServiceOptions,
  GitHubReleaseAsset,
  isGitHubRelease,
  RustServiceCommand,
} from './types';

/**
 * Resolves the Rust target triplet string for a given OS platform and CPU architecture.
 * @param osPlatform - The operating system platform (`win32`, `darwin`, `linux`, etc.).
 * @param arch - The CPU architecture (`arm64`, `x64`, etc.).
 * @returns The Rust target triplet string.
 */
export function resolveTargetTriplet(osPlatform: NodeJS.Platform, arch: string): string {
  if (osPlatform === 'win32') {
    return 'x86_64-pc-windows-msvc';
  }
  if (osPlatform === 'darwin' && arch === 'arm64') {
    return 'aarch64-apple-darwin';
  }
  if (osPlatform === 'darwin' && arch === 'x64') {
    return 'x86_64-apple-darwin';
  }
  return 'x86_64-unknown-linux-gnu';
}

/**
 * Selects the matching executable file from an extracted archive directory.
 * @param extractedDir - The directory where the archive was extracted.
 * @param files - List of filenames inside `extractedDir`.
 * @param archiveType - Whether the archive was `.tar.gz` or `.zip`.
 * @returns The filename of the discovered binary, or `undefined` if none matched.
 */
export function findExtractedBinary(
  extractedDir: string,
  files: readonly string[],
  archiveType: 'tar.gz' | 'zip',
): string | undefined {
  for (const file of files) {
    const fullPath = join(extractedDir, file);
    if (archiveType === 'tar.gz') {
      if (!file.endsWith('.tar.gz') && !file.endsWith('.zip') && !lstatSync(fullPath).isDirectory()) {
        return file;
      }
    } else {
      if (file.endsWith('.exe') || (!file.includes('.') && !lstatSync(fullPath).isDirectory())) {
        return file;
      }
    }
  }
  return undefined;
}

/**
 * Downloads a prebuilt GitHub release for a Rust microservice or falls back to `cargo build`.
 * @param repo - The GitHub repository name (e.g., `'cdd-gateway'`).
 * @param destDir - The destination directory for the downloaded binary.
 * @param options - Options controlling Cargo environment variables, fallback mode, and config.
 * @returns A {@link RustServiceCommand} describing how to invoke the resolved service.
 */
export function getOrBuildRustService(
  repo: string,
  destDir: string,
  options: GetOrBuildRustServiceOptions = {},
): RustServiceCommand {
  const cfg = options.config ?? resolveConfig();
  const cargoEnv = options.cargoEnv ?? {};
  const fallbackMode = options.fallbackMode ?? 'skip-if-missing';

  console.log(`Resolving ${repo}...`);
  const repoPath = join(cfg.parentDir, repo);
  const finalBinPath = join(destDir, cfg.isWindows ? `${repo}.exe` : repo);

  try {
    const releaseUrl = `https://api.github.com/repos/SamuelMarks/${repo}/releases/latest`;
    const curlOpts = cfg.githubToken ? `-H "Authorization: token ${cfg.githubToken}" ` : '';
    const res = execSync(`curl -sL ${curlOpts}${releaseUrl}`).toString();
    const parsed: unknown = JSON.parse(res);

    if (!isGitHubRelease(parsed)) {
      throw new Error(`Invalid GitHub release payload for ${repo}.`);
    }

    const target = resolveTargetTriplet(cfg.osPlatform, cfg.arch);
    const asset: GitHubReleaseAsset | undefined = parsed.assets?.find((a: GitHubReleaseAsset) =>
      a.name.includes(target),
    );

    if (!asset) {
      throw new Error(`Asset for triplet ${target} not found (404).`);
    }

    const downloadUrl = asset.browser_download_url;
    const dlPath = join(destDir, asset.name);
    console.log(`Downloading ${downloadUrl} to ${dlPath}...`);
    execSync(`curl -sL -o "${dlPath}" "${downloadUrl}"`);

    if (asset.name.endsWith('.tar.gz') || asset.name.endsWith('.zip')) {
      const archiveType = asset.name.endsWith('.tar.gz') ? 'tar.gz' : 'zip';
      const tempDir = join(destDir, `temp-${repo}`);
      mkdirSync(tempDir, { recursive: true });
      try {
        execSync(`tar -xf "${dlPath}" -C "${tempDir}"`);
        rmSync(dlPath, { force: true });
        if (!existsSync(finalBinPath)) {
          const files = readdirSync(tempDir);
          const matchedFile = findExtractedBinary(tempDir, files, archiveType);
          if (matchedFile !== undefined) {
            renameSync(join(tempDir, matchedFile), finalBinPath);
          }
        }
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    } else {
      renameSync(dlPath, finalBinPath);
    }

    if (!cfg.isWindows && existsSync(finalBinPath)) {
      chmodSync(finalBinPath, 0o755);
    }
    console.log(`Successfully downloaded ${repo} to ${finalBinPath}`);
    return { cmd: finalBinPath, args: [], cwd: destDir };
  } catch (err: unknown) {
    const message = formatError(err);
    console.warn(`Failed to fetch release for ${repo} (${message}). Falling back to cargo build...`);
    if (existsSync(repoPath)) {
      runSync('cargo build', repoPath, false, cargoEnv);
      return { cmd: 'cargo', args: ['run', '--bin', repo], cwd: repoPath };
    }
    if (fallbackMode === 'exit-if-missing') {
      console.error(`Source directory ${repoPath} not found. Cannot build from source.`);
      process.exit(1);
    } else {
      console.warn(`Source directory ${repoPath} not found. Skipping build.`);
    }
    return { cmd: finalBinPath, args: [], cwd: destDir };
  }
}
