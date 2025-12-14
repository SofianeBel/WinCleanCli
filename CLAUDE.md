# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun run dev          # Run in development mode
bun run build        # Build for production (tsup)
bun run lint         # Run ESLint
bun run typecheck    # TypeScript type checking
bun test             # Run all tests
bun test <pattern>   # Run specific test file (e.g., bun test fs)
bun run test:watch   # Run tests in watch mode
bun run test:coverage # Run tests with coverage report
```

## Architecture Overview

This is a Windows-only CLI tool that scans and removes junk files. It uses Commander.js for CLI parsing and Inquirer for interactive prompts.

### Core Structure

**Entry Point**: `src/index.ts` - Defines CLI commands using Commander:
- Default action runs interactive mode
- `scan` - Shows what can be cleaned
- `clean` - Non-interactive cleaning with flags
- `uninstall` - Remove apps and related files
- `maintenance` - System tasks (DNS flush, disk cleanup)
- `categories` - List available scan categories
- `config` / `backup` - Manage settings and backups

**Type System** (`src/types.ts`):
- `CategoryId` - Union type of all scanner IDs
- `Scanner` interface with `scan()` and `clean()` methods
- `SafetyLevel`: 'safe' | 'moderate' | 'risky'
- `CATEGORIES` constant maps IDs to metadata

### Scanner Pattern

All scanners extend `BaseScanner` (`src/scanners/base-scanner.ts`):
```typescript
abstract class BaseScanner implements Scanner {
  abstract category: Category;
  abstract scan(options?: ScannerOptions): Promise<ScanResult>;
  // clean() has default implementation using removeItems()
}
```

Scanners are registered in `src/scanners/index.ts` via `ALL_SCANNERS` record. The `runAllScans()` and `runScans()` functions handle parallel execution with configurable concurrency.

### Key Utilities

- `src/utils/fs.ts` - File operations: `exists()`, `getSize()`, `getItems()`, `removeItems()`, `emptyDirectory()`
- `src/utils/paths.ts` - Windows path helpers for AppData, TEMP, etc.
- `src/utils/size.ts` - Human-readable size formatting
- `src/utils/hash.ts` - File hashing for duplicate detection

### Adding a New Scanner

1. Create `src/scanners/<name>.ts` extending `BaseScanner`
2. Add category ID to `CategoryId` type in `types.ts`
3. Add category metadata to `CATEGORIES` constant
4. Import and register in `src/scanners/index.ts`

### Safety Levels

- `safe` - Always safe to delete (temp files, recycle bin, browser cache)
- `moderate` - Generally safe but may require rebuilding (dev cache, logs)
- `risky` - Requires `--risky` flag (downloads, iTunes backups, large files)
