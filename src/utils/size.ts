const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${UNITS[i]}`;
}

export function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const unitIndex = UNITS.indexOf(unit);

  return value * Math.pow(1024, unitIndex);
}

export const SIZE_THRESHOLDS = {
  LARGE_FILE: 500 * 1024 * 1024,
  MEDIUM_FILE: 100 * 1024 * 1024,
  SMALL_FILE: 10 * 1024 * 1024,
} as const;

export interface DiskSpaceInfo {
  drive: string;
  total: number;
  free: number;
  used: number;
}

export async function getDiskSpace(drive = 'C:'): Promise<DiskSpaceInfo | null> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Use PowerShell to get disk space info
    const { stdout } = await execAsync(
      `powershell -Command "Get-PSDrive ${drive.replace(':', '')} | Select-Object Used,Free | ConvertTo-Json"`,
      { timeout: 5000 }
    );

    const data = JSON.parse(stdout.trim());
    const used = data.Used ?? 0;
    const free = data.Free ?? 0;
    const total = used + free;

    return { drive, total, free, used };
  } catch {
    return null;
  }
}

