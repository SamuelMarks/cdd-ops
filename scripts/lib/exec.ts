/**
 * @file Process execution utilities for running synchronous and asynchronous commands.
 * @module scripts/lib/exec
 */

import { execSync, spawn, ChildProcess } from 'node:child_process';
import { IS_WINDOWS, REPO_ROOT } from './constants';

/**
 * Runs a shell command synchronously and pipes output to standard streams.
 * @param command - The shell command string to execute.
 * @param cwd - The working directory to execute in (defaults to `REPO_ROOT`).
 * @param ignoreError - If true, suppresses process termination when the command fails.
 * @param envVars - Additional environment variables merged into `process.env`.
 */
export function runSync(
  command: string,
  cwd: string = REPO_ROOT,
  ignoreError: boolean = false,
  envVars: Record<string, string> = {},
): void {
  try {
    console.log(`> ${command}`);
    execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, ...envVars } });
  } catch {
    if (!ignoreError) {
      console.error(`Command failed: ${command}`);
      process.exit(1);
    }
  }
}

/**
 * Spawns a background child process with inherited standard streams.
 * @param command - The executable or command name to spawn.
 * @param args - Array of CLI arguments to pass to the command.
 * @param cwd - Working directory for the child process (defaults to `REPO_ROOT`).
 * @param envVars - Additional environment variables merged into `process.env`.
 * @param isWindows - Whether to enable shell execution mode for Windows compatibility.
 * @returns The spawned {@link ChildProcess} instance.
 */
export function runAsync(
  command: string,
  args: string[],
  cwd: string = REPO_ROOT,
  envVars: Record<string, string> = {},
  isWindows: boolean = IS_WINDOWS,
): ChildProcess {
  console.log(`> [Background] ${command} ${args.join(' ')}`);
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...envVars },
    shell: isWindows ? true : undefined,
  });

  child.on('error', (err: Error) => {
    console.error(`Failed to start process ${command}:`, err);
  });

  return child;
}

/**
 * Checks whether a given CLI command is available on the host system PATH.
 * @param command - The CLI command name to check.
 * @param isWindows - Whether to use `where` (Windows) instead of `command -v` (POSIX).
 * @returns True if the command is available in PATH, false otherwise.
 */
export function hasCommand(command: string, isWindows: boolean = IS_WINDOWS): boolean {
  try {
    const cmd = isWindows ? `where ${command}` : `command -v ${command}`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
