import { stat, readdir, rm, access, opendir } from 'fs/promises';
import { join } from 'path';
import type { CleanableItem } from '../types.js';
import { isSystemPath } from './paths.js';

/** Maximum concurrent I/O operations for directory scanning */
const MAX_CONCURRENT_IO = 20;

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function getSize(path: string): Promise<number> {
  try {
    const stats = await stat(path);
    if (stats.isFile()) {
      return stats.size;
    }
    if (stats.isDirectory()) {
      return await getDirectorySize(path);
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Run tasks with limited concurrency.
 */
async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Set<Promise<void>> = new Set();

  for (const task of tasks) {
    const p: Promise<void> = task().then((result) => {
      results.push(result);
      executing.delete(p);
    });
    executing.add(p);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Calculate the total size of a directory and its contents.
 * Uses parallel I/O for better performance on large directories.
 * @param dirPath - Path to the directory
 * @returns Total size in bytes
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const dir = await opendir(dirPath, { bufferSize: 64 });
    const tasks: (() => Promise<number>)[] = [];

    for await (const dirent of dir) {
      const fullPath = join(dirPath, dirent.name);

      if (dirent.isFile()) {
        tasks.push(async () => {
          try {
            const stats = await stat(fullPath);
            return stats.size;
          } catch {
            return 0;
          }
        });
      } else if (dirent.isDirectory()) {
        tasks.push(async () => {
          try {
            return await getDirectorySize(fullPath);
          } catch {
            return 0;
          }
        });
      }
    }

    const sizes = await runWithConcurrencyLimit(tasks, MAX_CONCURRENT_IO);
    return sizes.reduce((sum, size) => sum + size, 0);
  } catch {
    return 0;
  }
}

export async function getItems(
  dirPath: string,
  options: {
    recursive?: boolean;
    minAge?: number;
    minSize?: number;
    maxDepth?: number;
  } = {}
): Promise<CleanableItem[]> {
  const items: CleanableItem[] = [];
  const { recursive = false, minAge, minSize, maxDepth = 10 } = options;

  async function processDir(currentPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        try {
          const stats = await stat(fullPath);

          if (minAge) {
            const daysOld = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
            if (daysOld < minAge) continue;
          }

          const size = entry.isDirectory() ? await getDirectorySize(fullPath) : stats.size;

          if (minSize && size < minSize) continue;

          items.push({
            path: fullPath,
            size,
            name: entry.name,
            isDirectory: entry.isDirectory(),
            modifiedAt: stats.mtime,
          });

          if (recursive && entry.isDirectory()) {
            await processDir(fullPath, depth + 1);
          }
        } catch {
          continue;
        }
      }
    } catch {
      return;
    }
  }

  await processDir(dirPath, 0);
  return items;
}

export async function getDirectoryItems(dirPath: string): Promise<CleanableItem[]> {
  const items: CleanableItem[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      try {
        const stats = await stat(fullPath);
        const size = entry.isDirectory() ? await getDirectorySize(fullPath) : stats.size;

        items.push({
          path: fullPath,
          size,
          name: entry.name,
          isDirectory: entry.isDirectory(),
          modifiedAt: stats.mtime,
        });
      } catch {
        continue;
      }
    }
  } catch {
    return [];
  }

  return items;
}

/**
 * Remove a file or directory safely.
 * @param path - Path to remove
 * @param dryRun - If true, don't actually remove
 * @returns true if removed successfully, false otherwise
 */
export async function removeItem(path: string, dryRun = false): Promise<boolean> {
  // Protect system paths from being removed
  if (isSystemPath(path)) {
    console.warn(`Skipping protected system path: ${path}`);
    return false;
  }

  if (dryRun) {
    return true;
  }

  try {
    await rm(path, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function removeItems(
  items: CleanableItem[],
  dryRun = false,
  onProgress?: (current: number, total: number, item: CleanableItem) => void
): Promise<{ success: number; failed: number; freedSpace: number }> {
  let success = 0;
  let failed = 0;
  let freedSpace = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.(i + 1, items.length, item);

    const removed = await removeItem(item.path, dryRun);
    if (removed) {
      success++;
      freedSpace += item.size;
    } else {
      failed++;
    }
  }

  return { success, failed, freedSpace };
}

export async function emptyDirectory(
  dirPath: string,
  dryRun = false,
  onProgress?: (current: number, total: number, entryName: string) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  if (dryRun) {
    try {
      const entries = await readdir(dirPath);
      return { success: entries.length, failed: 0 };
    } catch {
      return { success: 0, failed: 0 };
    }
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const total = entries.length;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      onProgress?.(i + 1, total, entry.name);

      try {
        await rm(join(dirPath, entry.name), { recursive: true, force: true });
        success++;
      } catch {
        failed++;
      }
    }
  } catch {
    return { success: 0, failed: 0 };
  }

  return { success, failed };
}
