/**
 * Godot executable path detection and validation
 */

import { normalize } from 'path';
import { existsSync } from 'fs';
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);

const DEBUG_MODE = process.env.DEBUG === 'true';

function logDebug(message: string): void {
  if (DEBUG_MODE) {
    console.error(`[DEBUG] ${message}`);
  }
}

const validatedPaths = new Map<string, boolean>();

export function isValidGodotPathSync(path: string): boolean {
  try {
    return path === 'godot' || existsSync(path);
  } catch {
    return false;
  }
}

export async function isValidGodotPath(path: string): Promise<boolean> {
  if (validatedPaths.has(path)) {
    return validatedPaths.get(path)!;
  }

  try {
    logDebug(`Validating Godot path: ${path}`);
    if (path !== 'godot' && !existsSync(path)) {
      validatedPaths.set(path, false);
      return false;
    }
    await execFileAsync(path, ['--version']);
    validatedPaths.set(path, true);
    return true;
  } catch {
    validatedPaths.set(path, false);
    return false;
  }
}

export async function detectGodotPath(currentPath: string | null, strictPathValidation: boolean): Promise<string | null> {
  // If currentPath is already set and valid, use it
  if (currentPath && await isValidGodotPath(currentPath)) {
    logDebug(`Using existing Godot path: ${currentPath}`);
    return currentPath;
  }

  // Check environment variable
  if (process.env.GODOT_PATH) {
    const normalizedPath = normalize(process.env.GODOT_PATH);
    if (await isValidGodotPath(normalizedPath)) {
      logDebug(`Using Godot path from environment: ${normalizedPath}`);
      return normalizedPath;
    }
  }

  // Auto-detect based on platform
  const osPlatform = process.platform;
  const possiblePaths: string[] = ['godot'];

  if (osPlatform === 'darwin') {
    possiblePaths.push(
      '/Applications/Godot.app/Contents/MacOS/Godot',
      '/Applications/Godot_4.app/Contents/MacOS/Godot',
      `${process.env.HOME}/Applications/Godot.app/Contents/MacOS/Godot`,
      `${process.env.HOME}/Applications/Godot_4.app/Contents/MacOS/Godot`,
      `${process.env.HOME}/Library/Application Support/Steam/steamapps/common/Godot Engine/Godot.app/Contents/MacOS/Godot`
    );
  } else if (osPlatform === 'win32') {
    possiblePaths.push(
      'C:\\Program Files\\Godot\\Godot.exe',
      'C:\\Program Files (x86)\\Godot\\Godot.exe',
      'C:\\Program Files\\Godot_4\\Godot.exe',
      'C:\\Program Files (x86)\\Godot_4\\Godot.exe',
      `${process.env.USERPROFILE}\\Godot\\Godot.exe`
    );
  } else if (osPlatform === 'linux') {
    possiblePaths.push(
      '/usr/bin/godot',
      '/usr/local/bin/godot',
      '/snap/bin/godot',
      `${process.env.HOME}/.local/bin/godot`
    );
  }

  for (const p of possiblePaths) {
    const normalizedPath = normalize(p);
    if (await isValidGodotPath(normalizedPath)) {
      logDebug(`Found Godot at: ${normalizedPath}`);
      return normalizedPath;
    }
  }

  console.error(`[SERVER] Could not find Godot in common locations for ${osPlatform}`);

  if (strictPathValidation) {
    throw new Error('Could not find a valid Godot executable. Set GODOT_PATH or provide a valid path in config.');
  }

  // Fallback defaults
  let fallback: string;
  if (osPlatform === 'win32') {
    fallback = normalize('C:\\Program Files\\Godot\\Godot.exe');
  } else if (osPlatform === 'darwin') {
    fallback = normalize('/Applications/Godot.app/Contents/MacOS/Godot');
  } else {
    fallback = normalize('/usr/bin/godot');
  }

  console.error(`[SERVER] Using default path: ${fallback}, but this may not work.`);
  return fallback;
}
