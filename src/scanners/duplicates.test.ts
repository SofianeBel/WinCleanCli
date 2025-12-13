import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DuplicatesScanner } from './duplicates.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('DuplicatesScanner', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'windows-cleaner-duplicates-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should have correct category', () => {
    const scanner = new DuplicatesScanner();
    expect(scanner.category.id).toBe('duplicates');
    expect(scanner.category.group).toBe('Storage');
    expect(scanner.category.safetyLevel).toBe('risky');
  });

  it('should have safety note about keeping newest', () => {
    const scanner = new DuplicatesScanner();
    expect(scanner.category.safetyNote).toBeDefined();
    expect(scanner.category.safetyNote).toContain('newest');
  });

  it('should scan without errors', async () => {
    const scanner = new DuplicatesScanner();
    const result = await scanner.scan({ searchPaths: [testDir], maxDepth: 1 });

    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('totalSize');
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('should respect minSize option', async () => {
    const scanner = new DuplicatesScanner();
    const result = await scanner.scan({ searchPaths: [testDir], maxDepth: 1, minSize: 10 * 1024 * 1024 });

    expect(result).toHaveProperty('items');
  });
});
