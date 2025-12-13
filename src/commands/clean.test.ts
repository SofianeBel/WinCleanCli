import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

vi.mock('../scanners/index.js', async () => {
  return {
    getScanner: () => {
      throw new Error('getScanner should not be called in this test');
    },
    getAllScanners: () => [],
    runAllScans: async () => ({ results: [], totalSize: 0, totalItems: 0 }),
    runScans: async () => ({ results: [], totalSize: 0, totalItems: 0 }),
  };
});

let cleanCommand: typeof import('./clean.js').cleanCommand;

describe('clean command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    ({ cleanCommand } = await import('./clean.js'));
  });

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('cleanCommand', () => {
    it('should handle no progress option', async () => {
      const result = await cleanCommand({
        noProgress: true,
        dryRun: true,
        all: true,
      });

      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
});
