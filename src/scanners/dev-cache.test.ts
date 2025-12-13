import { describe, it, expect, vi } from 'vitest';
import { DevCacheScanner } from './dev-cache.js';

vi.mock('../utils/index.js', () => ({
  PATHS: {
    npmCache: '__mock__',
    yarnCache: '__mock__',
    pnpmCache: '__mock__',
    pipCache: '__mock__',
    nugetCache: '__mock__',
    gradleCache: '__mock__',
    cargoCache: '__mock__',
  },
  exists: async () => false,
  getSize: async () => 0,
}));

describe('DevCacheScanner', () => {
  it('should have correct category', () => {
    const scanner = new DevCacheScanner();
    expect(scanner.category.id).toBe('dev-cache');
    expect(scanner.category.group).toBe('Development');
    expect(scanner.category.safetyLevel).toBe('moderate');
  });

  it('should scan without errors', async () => {
    const scanner = new DevCacheScanner();
    const result = await scanner.scan();

    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('totalSize');
    expect(Array.isArray(result.items)).toBe(true);
  });
});
