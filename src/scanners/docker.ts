import { BaseScanner } from './base-scanner.js';
import { CATEGORIES, type ScanResult, type ScannerOptions, type CleanableItem, type CleanResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DockerScanner extends BaseScanner {
  category = CATEGORIES['docker'];

  async scan(_options?: ScannerOptions): Promise<ScanResult> {
    const items: CleanableItem[] = [];

    try {
      const { stdout } = await execAsync('docker system df --format "{{.Type}}\t{{.Size}}\t{{.Reclaimable}}"');
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const [type, , reclaimable] = line.split('\t');
        const reclaimableBytes = this.parseDockerSize(reclaimable);

        if (reclaimableBytes > 0) {
          items.push({
            path: `docker:${type.toLowerCase()}`,
            size: reclaimableBytes,
            name: `Docker ${type}`,
            isDirectory: false,
          });
        }
      }
    } catch {
      // Docker may not be installed or running
    }

    return this.createResult(items);
  }

  private parseDockerSize(sizeStr: string): number {
    // Docker uses SI units (kB = 1000 bytes) vs binary units (KB/KiB = 1024 bytes)
    const match = sizeStr.match(/([\d.]+)\s*(B|kB|KB|MB|GB|TB)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    // Docker uses SI prefixes: kB = 1000, MB = 1000^2, etc.
    // We normalize to bytes using SI multipliers for Docker output
    const multipliers: Record<string, number> = {
      B: 1,
      b: 1,
      kB: 1000, // SI kilobyte (Docker default)
      KB: 1024, // Binary kilobyte
      kb: 1000,
      MB: 1000 * 1000,
      mb: 1000 * 1000,
      GB: 1000 * 1000 * 1000,
      gb: 1000 * 1000 * 1000,
      TB: 1000 * 1000 * 1000 * 1000,
      tb: 1000 * 1000 * 1000 * 1000,
    };

    return value * (multipliers[unit] || 1);
  }

  async clean(items: CleanableItem[], dryRun = false): Promise<CleanResult> {
    if (dryRun) {
      return {
        category: this.category,
        cleanedItems: items.length,
        freedSpace: items.reduce((sum, item) => sum + item.size, 0),
        errors: [],
      };
    }

    const errors: string[] = [];
    let freedSpace = 0;

    try {
      const beforeSize = items.reduce((sum, item) => sum + item.size, 0);
      await execAsync('docker system prune -af --volumes');
      freedSpace = beforeSize;
    } catch (error) {
      errors.push(`Docker cleanup failed: ${error}`);
    }

    return {
      category: this.category,
      cleanedItems: errors.length === 0 ? items.length : 0,
      freedSpace,
      errors,
    };
  }
}

