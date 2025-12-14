import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { CategoryId, CleaningProfile } from '../types.js';

const APPDATA = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');

const CONFIG_PATHS = [
  join(homedir(), '.windowscleanerrc'),
  join(APPDATA, 'windows-cleaner-cli', 'config.json'),
];

export interface Config {
  defaultCategories?: CategoryId[];
  excludeCategories?: CategoryId[];
  downloadsDaysOld?: number;
  largeFilesMinSize?: number;
  parallelScans?: boolean;
  concurrency?: number;
  extraPaths?: {
    nodeModules?: string[];
    projects?: string[];
  };
}

const DEFAULT_CONFIG: Config = {
  downloadsDaysOld: 30,
  largeFilesMinSize: 500 * 1024 * 1024,
  parallelScans: true,
  concurrency: 4,
};

let cachedConfig: Config | null = null;

export async function loadConfig(configPath?: string): Promise<Config> {
  if (cachedConfig && !configPath) {
    return cachedConfig;
  }

  const paths = configPath ? [configPath] : CONFIG_PATHS;

  for (const path of paths) {
    try {
      await access(path);
      const content = await readFile(path, 'utf-8');
      const parsed = JSON.parse(content) as Partial<Config>;
      cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
      return cachedConfig;
    } catch {
      continue;
    }
  }

  cachedConfig = DEFAULT_CONFIG;
  return cachedConfig;
}

export async function saveConfig(config: Config, configPath?: string): Promise<void> {
  const path = configPath ?? CONFIG_PATHS[0];
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2));
  cachedConfig = config;
}

export function getDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

export async function configExists(): Promise<boolean> {
  for (const path of CONFIG_PATHS) {
    try {
      await access(path);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

export async function initConfig(): Promise<string> {
  const configPath = CONFIG_PATHS[0];
  const defaultConfig: Config = {
    downloadsDaysOld: 30,
    largeFilesMinSize: 500 * 1024 * 1024,
    parallelScans: true,
    concurrency: 4,
    extraPaths: {
      nodeModules: ['~\\Projects', '~\\Developer', '~\\Code'],
      projects: ['~\\Projects', '~\\Developer', '~\\Code'],
    },
  };

  await writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
  return configPath;
}

// Built-in cleaning profiles
export const BUILTIN_PROFILES: Record<string, CleaningProfile> = {
  quick: {
    id: 'quick',
    name: 'Quick Clean',
    description: 'Browser cache, temp files, recycle bin - fast and safe',
    categories: ['browser-cache', 'temp-files', 'recycle-bin', 'system-cache'],
  },
  developer: {
    id: 'developer',
    name: 'Developer Clean',
    description: 'Dev caches, node_modules, Docker - free up dev space',
    categories: ['dev-cache', 'node-modules', 'docker', 'chocolatey'],
  },
  full: {
    id: 'full',
    name: 'Full Clean',
    description: 'All safe and moderate categories - thorough cleanup',
    categories: [
      'browser-cache',
      'temp-files',
      'recycle-bin',
      'system-cache',
      'system-logs',
      'dev-cache',
      'node-modules',
      'windows-update',
      'prefetch',
      'docker',
      'chocolatey',
    ],
  },
};

const PROFILES_FILE = join(APPDATA, 'windows-cleaner-cli', 'profiles.json');

let cachedProfiles: Record<string, CleaningProfile> | null = null;

export async function loadProfiles(): Promise<Record<string, CleaningProfile>> {
  if (cachedProfiles) {
    return cachedProfiles;
  }

  // Start with built-in profiles
  const profiles = { ...BUILTIN_PROFILES };

  // Load custom profiles
  try {
    await access(PROFILES_FILE);
    const content = await readFile(PROFILES_FILE, 'utf-8');
    const customProfiles = JSON.parse(content) as Record<string, CleaningProfile>;
    Object.assign(profiles, customProfiles);
  } catch {
    // No custom profiles file
  }

  cachedProfiles = profiles;
  return profiles;
}

export async function saveProfile(profile: CleaningProfile): Promise<void> {
  const profiles = await loadProfiles();

  // Don't allow overwriting built-in profiles
  if (profile.id in BUILTIN_PROFILES) {
    throw new Error(`Cannot overwrite built-in profile: ${profile.id}`);
  }

  profiles[profile.id] = profile;

  // Only save custom profiles (not built-ins)
  const customProfiles: Record<string, CleaningProfile> = {};
  for (const [id, p] of Object.entries(profiles)) {
    if (!(id in BUILTIN_PROFILES)) {
      customProfiles[id] = p;
    }
  }

  await mkdir(dirname(PROFILES_FILE), { recursive: true });
  await writeFile(PROFILES_FILE, JSON.stringify(customProfiles, null, 2));
  cachedProfiles = profiles;
}

export async function deleteProfile(profileId: string): Promise<void> {
  if (profileId in BUILTIN_PROFILES) {
    throw new Error(`Cannot delete built-in profile: ${profileId}`);
  }

  const profiles = await loadProfiles();
  if (!(profileId in profiles)) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  delete profiles[profileId];

  // Only save custom profiles
  const customProfiles: Record<string, CleaningProfile> = {};
  for (const [id, p] of Object.entries(profiles)) {
    if (!(id in BUILTIN_PROFILES)) {
      customProfiles[id] = p;
    }
  }

  await mkdir(dirname(PROFILES_FILE), { recursive: true });
  await writeFile(PROFILES_FILE, JSON.stringify(customProfiles, null, 2));
  cachedProfiles = profiles;
}

export function getProfile(profileId: string): CleaningProfile | undefined {
  // Check cached profiles first
  if (cachedProfiles && profileId in cachedProfiles) {
    return cachedProfiles[profileId];
  }
  // Fall back to built-in profiles
  return BUILTIN_PROFILES[profileId];
}

export function clearProfilesCache(): void {
  cachedProfiles = null;
}

