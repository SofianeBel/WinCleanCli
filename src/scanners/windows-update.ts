import { BaseScanner } from './base-scanner.js';
import { CATEGORIES, type ScanResult, type ScannerOptions, type CleanableItem, type CleanResult } from '../types.js';
import { PATHS, emptyDirectory, exists, getSize } from '../utils/index.js';
import { stat } from 'fs/promises';

export class WindowsUpdateScanner extends BaseScanner {
  category = CATEGORIES['windows-update'];

  async scan(_options?: ScannerOptions): Promise<ScanResult> {
    const items: CleanableItem[] = [];

    if (await exists(PATHS.windowsUpdate)) {
      try {
        const size = await getSize(PATHS.windowsUpdate);
        if (size > 0) {
          const stats = await stat(PATHS.windowsUpdate);
          items.push({
            path: PATHS.windowsUpdate,
            size,
            name: 'Windows Update Download Cache',
            isDirectory: true,
            modifiedAt: stats.mtime,
          });
        }
      } catch {
        // May not have permission
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
