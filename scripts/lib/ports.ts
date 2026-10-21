/**
 * @file Port inspection and process termination helpers for cleaning up lingering services.
 * @module scripts/lib/ports
 */

import { execSync } from 'node:child_process';
import { IS_WINDOWS, PORTS } from './constants';

/**
 * Splits a multi-line string into individual lines using LF or CRLF delimiters.
 * @param input - The multi-line text to split.
 * @returns Array of line strings.
 */
export function splitLines(input: string): string[] {
  const lf = String.fromCharCode(10);
  const cr = String.fromCharCode(13);
  return input.split(lf).map((line: string) => (line.endsWith(cr) ? line.slice(0, -1) : line));
}

/**
 * Parses Windows `netstat -ano` output to extract non-zero PIDs listening on a target port.
 * @param netstatOutput - Raw stdout from `netstat -ano`.
 * @param port - The TCP port number to match.
 * @returns An array of process ID strings to terminate.
 */
export function parseWindowsNetstatPids(netstatOutput: string, port: number): string[] {
  const pids: string[] = [];
  const lines = splitLines(netstatOutput.trim());
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const localAddress = parts[1];
    const pid = parts[parts.length - 1];
    if (
      parts.length > 4 &&
      localAddress !== undefined &&
      localAddress.includes(`:${port}`) &&
      pid !== undefined &&
      pid !== '0'
    ) {
      pids.push(pid);
    }
  }
  return pids;
}

/**
 * Parses POSIX `lsof -t` output into a list of non-empty PID strings.
 * @param lsofOutput - Raw stdout from `lsof -Pi :<port> -sTCP:LISTEN -t`.
 * @returns An array of process ID strings to terminate.
 */
export function parsePosixLsofPids(lsofOutput: string): string[] {
  const trimmed = lsofOutput.trim();
  if (!trimmed) {
    return [];
  }
  return splitLines(trimmed)
    .map((pid: string) => pid.trim())
    .filter((pid: string) => pid.length > 0);
}

/**
 * Terminates any lingering processes listening on the specified TCP ports.
 * @param ports - List of TCP ports to clean up (defaults to {@link PORTS}).
 * @param isWindows - Whether to use Windows `netstat`/`taskkill` or POSIX `lsof`/`kill`.
 */
export function killPorts(ports: readonly number[] = PORTS, isWindows: boolean = IS_WINDOWS): void {
  console.log('Cleaning up lingering ports...');
  for (const port of ports) {
    try {
      if (isWindows) {
        const output = execSync(`netstat -ano | findstr :${port}`).toString();
        const pids = parseWindowsNetstatPids(output, port);
        for (const pid of pids) {
          console.log(`Killing process on port ${port} (PID: ${pid})`);
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        }
      } else {
        const rawOutput = execSync(`lsof -Pi :${port} -sTCP:LISTEN -t`, { stdio: 'pipe' }).toString();
        const pids = parsePosixLsofPids(rawOutput);
        if (pids.length > 0) {
          console.log(`Killing process on port ${port} (PIDs: ${pids.join(', ')})`);
          execSync(`kill -9 ${pids.join(' ')}`, { stdio: 'ignore' });
        }
      }
    } catch {
      // Port is not in use or inspection command exited non-zero; safe to ignore.
    }
  }
}
