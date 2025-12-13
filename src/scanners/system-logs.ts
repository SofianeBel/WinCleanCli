import { BaseScanner } from './base-scanner.js';
import { CATEGORIES, type ScanResult, type ScannerOptions, type CleanableItem, type CleanResult } from '../types.js';
import { PATHS, emptyDirectory, exists, getSize } from '../utils/index.js';
import { stat } from 'fs/promises';

export class SystemLogsScanner extends BaseScanner {
  category = CATEGORIES['system-logs'];

  async scan(_options?: ScannerOptions): Promise<ScanResult> {
    const items: CleanableItem[] = [];

    if (await exists(PATHS.userLogs)) {
      try {
        const size = await getSize(PATHS.userLogs);
        if (size > 0) {
          const stats = await stat(PATHS.userLogs);
          items.push({
            path: PATHS.userLogs,
            size,
            name: 'User Crash Dumps',
            isDirectory: true,
            modifiedAt: stats.mtime,
          });
        }
      } catch {
        // Ignore errors
      }
    }

    if (await exists(PATHS.systemLogs)) {
      try {
        const size = await getSize(PATHS.systemLogs);
        if (size > 0) {
          const stats = await stat(PATHS.systemLogs);
          items.push({
            path: PATHS.systemLogs,
            size,
            name: 'Windows Logs',
            isDirectory: true,
            modifiedAt: stats.mtime,
          });
        }
      } catch {
        // May not have permission to read system logs
      }
    }

    return this.createResult(items);
  }

  async clean(items: CleanableItem[], dryRun = false): Promise<CleanResult> {
    const errors: string[] = [];
    let freedSpace = 0;
    let cleanedItems = 0;

    for (const item of items) {
      try {
        const sizeBefore = item.size || (await getSize(item.path));
        const result = await emptyDirectory(item.path, dryRun);
        const sizeAfter = dryRun ? sizeBefore : await getSize(item.path);
        freedSpace += Math.max(0, sizeBefore - sizeAfter);
        cleanedItems += result.success;
        if (result.failed > 0) {
          errors.push(`Failed to remove ${result.failed} entries from ${item.name}`);
        }
      } catch (error) {
        errors.push(`Failed to clean ${item.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      category: this.category,
      cleanedItems,
      freedSpace,
      errors,
    };
  }
}
