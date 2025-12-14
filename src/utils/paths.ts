import { homedir } from 'os';
import { join, normalize, resolve } from 'path';

export const HOME = homedir();

const APPDATA = process.env.APPDATA || join(HOME, 'AppData', 'Roaming');
const LOCALAPPDATA = process.env.LOCALAPPDATA || join(HOME, 'AppData', 'Local');
const WINDIR = process.env.WINDIR || 'C:\\Windows';

export const PATHS = {
  userCaches: join(LOCALAPPDATA, 'Microsoft', 'Windows', 'INetCache'),
  systemTemp: join(WINDIR, 'Temp'),
  userTemp: process.env.TEMP || join(LOCALAPPDATA, 'Temp'),
  userLogs: join(LOCALAPPDATA, 'CrashDumps'),
  systemLogs: join(WINDIR, 'Logs'),
  eventLogs: join(WINDIR, 'System32', 'winevt', 'Logs'),
  downloads: join(HOME, 'Downloads'),
  documents: join(HOME, 'Documents'),

  chromeCache: join(LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
  chromeCacheData: join(LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache'),
  edgeCache: join(LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
  firefoxProfiles: join(LOCALAPPDATA, 'Mozilla', 'Firefox', 'Profiles'),
  braveCache: join(LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Cache'),

  npmCache: join(APPDATA, 'npm-cache'),
  yarnCache: join(LOCALAPPDATA, 'Yarn', 'Cache'),
  pnpmCache: join(LOCALAPPDATA, 'pnpm', 'store'),
  pipCache: join(LOCALAPPDATA, 'pip', 'Cache'),
  nugetCache: join(HOME, '.nuget', 'packages'),
  gradleCache: join(HOME, '.gradle', 'caches'),
  cargoCache: join(HOME, '.cargo', 'registry'),

  chocolateyCache: 'C:\\ProgramData\\chocolatey\\cache',
  scoopCache: join(HOME, 'scoop', 'cache'),

  itunesBackups: join(APPDATA, 'Apple Computer', 'MobileSync', 'Backup'),
  appleBackupsAlt: join(HOME, 'Apple', 'MobileSync', 'Backup'),

  windowsUpdate: join(WINDIR, 'SoftwareDistribution', 'Download'),
  prefetch: join(WINDIR, 'Prefetch'),

  recycleBin: '$Recycle.Bin',

  programFiles: process.env.ProgramFiles || 'C:\\Program Files',
  programFilesX86: process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
};

/**
 * Expand a path that may start with ~ to use the home directory.
 * Validates that the resulting path is safe and not a system path.
 * @param inputPath - Path to expand
 * @returns Normalized absolute path
 * @throws Error if path traversal is detected or path is unsafe
 */
export function expandPath(inputPath: string): string {
  let expanded = inputPath;
  if (inputPath.startsWith('~')) {
    expanded = inputPath.replace('~', HOME);
  }

  const normalized = normalize(resolve(expanded));

  // Validate that the resolved path is safe
  if (isSystemPath(normalized)) {
    throw new Error(`Unsafe path detected: ${inputPath} resolves to protected system path`);
  }

  return normalized;
}

/**
 * Check if a path is a protected system path that should never be modified.
 * @param targetPath - Path to check
 * @returns true if the path is a system path
 */
export function isSystemPath(targetPath: string): boolean {
  const normalized = normalize(targetPath).toLowerCase();

  const systemPaths = [
    'c:\\windows',
    'c:\\program files',
    'c:\\program files (x86)',
    'c:\\programdata',
    'c:\\$recycle.bin',
    'c:\\system volume information',
    'c:\\recovery',
    'c:\\boot',
  ];

  return systemPaths.some((p) => normalized.startsWith(p));
}

/**
 * Check if a path is within safe user directories.
 * @param targetPath - Path to check
 * @returns true if the path is within a safe directory
 */
export function isSafePath(targetPath: string): boolean {
  const safePaths = [
    HOME,
    process.env.TEMP || '',
    process.env.TMP || '',
    process.env.LOCALAPPDATA || '',
    process.env.APPDATA || '',
  ].filter(Boolean);

  const normalized = normalize(targetPath).toLowerCase();

  // Block system paths first
  if (isSystemPath(normalized)) {
    return false;
  }

  // Check if within safe directories
  return safePaths.some((safe) => normalized.startsWith(normalize(safe).toLowerCase()));
}
