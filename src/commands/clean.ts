import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import checkbox from '@inquirer/checkbox';
import { readFileSync } from 'fs';
import type { CategoryId, CleanSummary, CleanableItem, ScanResult, SafetyLevel, JsonCleanOutput } from '../types.js';
import { runAllScans, runScans, getScanner, getAllScanners } from '../scanners/index.js';
import { createCleanProgress, createScanProgress, expandPath, formatSize, generateReport, getDiskSpace, getProfile, loadConfig, loadProfiles } from '../utils/index.js';

function getPackageVersion(): string {
  try {
    const raw = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

interface CleanCommandOptions {
  all?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  category?: CategoryId;
  profile?: string;
  includeRisky?: boolean;
  noProgress?: boolean;
  json?: boolean;
  report?: string;
}

const SAFETY_ICONS: Record<SafetyLevel, string> = {
  safe: chalk.green('●'),
  moderate: chalk.yellow('●'),
  risky: chalk.red('●'),
};

interface CategoryChoice {
  name: string;
  value: string;
  checked: boolean;
  size: number;
  items: CleanableItem[];
}

export async function cleanCommand(options: CleanCommandOptions): Promise<CleanSummary | null> {
  const startTime = Date.now();
  const config = await loadConfig();
  const showProgress = !options.noProgress && !options.json && process.stdout.isTTY;

  // Handle profile option
  let profileCategories: CategoryId[] | undefined;
  if (options.profile) {
    await loadProfiles(); // Ensure profiles are loaded
    const profile = getProfile(options.profile);
    if (!profile) {
      const profiles = await loadProfiles();
      const available = Object.keys(profiles).join(', ');
      console.error(chalk.red(`Unknown profile: ${options.profile}`));
      console.error(chalk.dim(`Available profiles: ${available}`));
      return null;
    }
    profileCategories = profile.categories;
    if (!options.json) {
      console.log(chalk.cyan(`Using profile: ${profile.name}`));
      console.log(chalk.dim(`  ${profile.description}`));
    }
    // Apply profile options
    if (profile.options?.includeRisky) {
      options.includeRisky = true;
    }
  }

  // Determine which scanners to use
  let scanners: CategoryId[];
  if (options.category) {
    scanners = [options.category];
  } else if (profileCategories) {
    scanners = profileCategories;
  } else {
    scanners = getAllScanners().map((s) => s.category.id);
  }

  const scanProgress = showProgress ? createScanProgress(scanners.length) : null;

  const scanOptions = {
    parallel: config.parallelScans ?? true,
    concurrency: config.concurrency ?? 4,
    optionsForScanner: (scanner: { category: { id: CategoryId } }) => {
      if (scanner.category.id === 'downloads' && typeof config.downloadsDaysOld === 'number') {
        return { daysOld: config.downloadsDaysOld };
      }
      if (scanner.category.id === 'large-files' && typeof config.largeFilesMinSize === 'number') {
        return { minSize: config.largeFilesMinSize };
      }
      if (scanner.category.id === 'node-modules' && config.extraPaths?.nodeModules?.length) {
        return { searchPaths: config.extraPaths.nodeModules.map(expandPath) };
      }
      return undefined;
    },
    onProgress: (completed: number, _total: number, scanner: { category: { name: string } }) => {
      scanProgress?.update(completed, `Scanning ${scanner.category.name}...`);
    },
  };

  // Run scans for selected categories
  const summary = (options.category || profileCategories)
    ? await runScans(scanners, scanOptions)
    : await runAllScans(scanOptions);

  scanProgress?.finish();

  if (summary.totalSize === 0) {
    if (options.json) {
      printJsonCleanResults(null, startTime, options.dryRun ?? false);
    } else {
      console.log(chalk.green('\n✓ Your PC is already clean!\n'));
    }
    return null;
  }

  const excluded = new Set(config.excludeCategories ?? []);
  let resultsWithItems = summary.results
    .filter((r) => r.items.length > 0)
    .filter((r) => !excluded.has(r.category.id));

  const riskyResults = resultsWithItems.filter((r) => r.category.safetyLevel === 'risky');
  const safeResults = resultsWithItems.filter((r) => r.category.safetyLevel !== 'risky');

  if (!options.includeRisky && riskyResults.length > 0) {
    if (!options.json) {
      const riskySize = riskyResults.reduce((sum, r) => sum + r.totalSize, 0);
      console.log();
      console.log(chalk.yellow('⚠ Skipping risky categories (use --risky to include):'));
      for (const result of riskyResults) {
        console.log(chalk.dim(`  ${SAFETY_ICONS.risky} ${result.category.name}: ${formatSize(result.totalSize)}`));
        if (result.category.safetyNote) {
          console.log(chalk.dim.italic(`     ${result.category.safetyNote}`));
        }
      }
      console.log(chalk.dim(`  Total skipped: ${formatSize(riskySize)}`));
    }
    resultsWithItems = safeResults;
  }

  if (resultsWithItems.length === 0) {
    if (options.json) {
      printJsonCleanResults(null, startTime, options.dryRun ?? false);
    } else {
      console.log(chalk.green('\n✓ Nothing safe to clean!\n'));
    }
    return null;
  }

  let selectedItems: { categoryId: CategoryId; items: CleanableItem[] }[] = [];

  if (options.all || options.json) {
    // JSON mode implies --all to avoid interactive prompts
    selectedItems = resultsWithItems.map((r) => ({
      categoryId: r.category.id,
      items: r.items,
    }));
  } else {
    const defaultSelected = config.defaultCategories?.length ? new Set(config.defaultCategories) : undefined;
    selectedItems = await selectItemsInteractively(resultsWithItems, defaultSelected);
  }

  if (selectedItems.length === 0) {
    if (options.json) {
      printJsonCleanResults(null, startTime, options.dryRun ?? false);
    } else {
      console.log(chalk.yellow('\nNo items selected for cleaning.\n'));
    }
    return null;
  }

  const totalToClean = selectedItems.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.size, 0), 0);
  const totalItems = selectedItems.reduce((sum, s) => sum + s.items.length, 0);

  // JSON mode implies --yes to avoid interactive prompts
  if (!options.yes && !options.json && !options.dryRun) {
    const proceed = await confirm({
      message: `Delete ${totalItems} items (${formatSize(totalToClean)})?`,
      default: false,
    });

    if (!proceed) {
      console.log(chalk.yellow('\nCleaning cancelled.\n'));
      return null;
    }
  }

  if (options.dryRun) {
    // Build dry-run results for JSON output
    const dryRunResults: CleanSummary = {
      results: selectedItems.map(({ categoryId, items }) => {
        const scanner = getScanner(categoryId);
        return {
          category: scanner.category,
          cleanedItems: items.length,
          freedSpace: items.reduce((sum, i) => sum + i.size, 0),
          errors: [],
        };
      }),
      totalFreedSpace: totalToClean,
      totalCleanedItems: totalItems,
      totalErrors: 0,
    };

    if (options.json) {
      printJsonCleanResults(dryRunResults, startTime, true);
    } else {
      console.log(chalk.cyan('\n[DRY RUN] Would clean the following:'));
      for (const { categoryId, items } of selectedItems) {
        const scanner = getScanner(categoryId);
        const size = items.reduce((sum, i) => sum + i.size, 0);
        console.log(`  ${scanner.category.name}: ${items.length} items (${formatSize(size)})`);
      }
      console.log(chalk.cyan(`\n[DRY RUN] Would free ${formatSize(totalToClean)}\n`));
    }

    // Generate report for dry-run if requested
    if (options.report) {
      const duration = Date.now() - startTime;
      await generateReport(options.report, {
        type: 'clean',
        timestamp: new Date().toISOString(),
        dryRun: true,
        duration,
        summary: dryRunResults,
      });
      if (!options.json) {
        console.log(chalk.green(`Report saved to: ${options.report}`));
      }
    }

    return dryRunResults;
  }

  const cleanProgress = showProgress ? createCleanProgress(selectedItems.length) : null;

  const cleanResults: CleanSummary = {
    results: [],
    totalFreedSpace: 0,
    totalCleanedItems: 0,
    totalErrors: 0,
  };

  let cleanedCount = 0;
  for (const { categoryId, items } of selectedItems) {
    const scanner = getScanner(categoryId);
    cleanProgress?.update(cleanedCount, `Cleaning ${scanner.category.name}...`);

    const result = await scanner.clean(items, options.dryRun);
    cleanResults.results.push(result);
    cleanResults.totalFreedSpace += result.freedSpace;
    cleanResults.totalCleanedItems += result.cleanedItems;
    cleanResults.totalErrors += result.errors.length;
    cleanedCount++;
  }

  cleanProgress?.finish();

  if (options.json) {
    printJsonCleanResults(cleanResults, startTime, false);
  } else {
    await printCleanResults(cleanResults, startTime);
  }

  // Generate report if requested
  if (options.report) {
    const duration = Date.now() - startTime;
    await generateReport(options.report, {
      type: 'clean',
      timestamp: new Date().toISOString(),
      dryRun: options.dryRun ?? false,
      duration,
      summary: cleanResults,
    });
    if (!options.json) {
      console.log(chalk.green(`Report saved to: ${options.report}`));
    }
  }

  return cleanResults;
}

async function selectItemsInteractively(
  results: ScanResult[],
  defaultSelected?: Set<CategoryId>
): Promise<{ categoryId: CategoryId; items: CleanableItem[] }[]> {
  console.log();
  console.log(chalk.bold('Select categories to clean:'));
  console.log();

  const choices: CategoryChoice[] = results.map((r) => {
    const safetyIcon = SAFETY_ICONS[r.category.safetyLevel];
    const isRisky = r.category.safetyLevel === 'risky';
    
    return {
      name: `${safetyIcon} ${r.category.name.padEnd(28)} ${chalk.yellow(formatSize(r.totalSize).padStart(10))} ${chalk.dim(`(${r.items.length} items)`)}`,
      value: r.category.id,
      checked: defaultSelected ? defaultSelected.has(r.category.id) : !isRisky,
      size: r.totalSize,
      items: r.items,
    };
  });

  const selectedCategories = await checkbox<CategoryId>({
    message: 'Categories',
    choices: choices.map((c) => ({
      name: c.name,
      value: c.value as CategoryId,
      checked: c.checked,
    })),
    pageSize: 15,
  });
  const selectedResults = results.filter((r) => selectedCategories.includes(r.category.id));

  const selectedItems: { categoryId: CategoryId; items: CleanableItem[] }[] = [];

  for (const result of selectedResults) {
    const isRisky = result.category.safetyLevel === 'risky';
    
    if (isRisky || result.category.id === 'large-files' || result.category.id === 'itunes-backups') {
      if (isRisky && result.category.safetyNote) {
        console.log();
        console.log(chalk.red(`⚠ WARNING: ${result.category.safetyNote}`));
      }
      
      const itemChoices = result.items.map((item) => ({
        name: `${item.name.substring(0, 40).padEnd(40)} ${chalk.yellow(formatSize(item.size).padStart(10))}`,
        value: item.path,
        checked: false,
      }));

      const selectedPaths = await checkbox<string>({
        message: `Select items from ${result.category.name}:`,
        choices: itemChoices,
        pageSize: 10,
      });
      const selectedItemsList = result.items.filter((i) => selectedPaths.includes(i.path));

      if (selectedItemsList.length > 0) {
        selectedItems.push({
          categoryId: result.category.id,
          items: selectedItemsList,
        });
      }
    } else {
      selectedItems.push({
        categoryId: result.category.id,
        items: result.items,
      });
    }
  }

  return selectedItems;
}

async function printCleanResults(summary: CleanSummary, startTime: number): Promise<void> {
  const duration = Math.round((Date.now() - startTime) / 1000);
  const successRate = summary.totalCleanedItems > 0
    ? ((summary.totalCleanedItems - summary.totalErrors) / summary.totalCleanedItems * 100).toFixed(1)
    : '100.0';

  // Count total cleaned items
  let itemsCount = 0;
  for (const result of summary.results) {
    itemsCount += result.cleanedItems;
  }

  console.log();
  console.log(chalk.bold.green('✨ Cleaning Complete!'));
  console.log(chalk.dim('─'.repeat(55)));
  console.log();
  console.log(`   ${chalk.cyan('Space freed:')}        ${chalk.green.bold(formatSize(summary.totalFreedSpace))}`);
  console.log(`   ${chalk.cyan('Items cleaned:')}      ${chalk.yellow(itemsCount.toLocaleString())}`);
  console.log(`   ${chalk.cyan('Duration:')}           ${chalk.yellow(`${duration}s`)}`);
  console.log(`   ${chalk.cyan('Success rate:')}       ${chalk.yellow(`${successRate}%`)}`);

  // Get disk space info
  const diskSpace = await getDiskSpace();
  if (diskSpace) {
    const previousFree = diskSpace.free - summary.totalFreedSpace;
    console.log();
    console.log(`   ${chalk.cyan('Disk space:')}         ${chalk.dim(formatSize(previousFree))} → ${chalk.green(formatSize(diskSpace.free))} available`);
  }

  console.log();
  console.log(chalk.dim('─'.repeat(55)));

  // Show per-category breakdown if multiple categories
  if (summary.results.length > 1) {
    console.log();
    console.log(chalk.dim('Breakdown by category:'));
    for (const result of summary.results) {
      if (result.cleanedItems > 0) {
        console.log(
          chalk.dim(`  ${result.category.name.padEnd(28)} ${formatSize(result.freedSpace).padStart(10)}`)
        );
      }
    }
  }

  // Show errors if any
  if (summary.totalErrors > 0) {
    console.log();
    console.log(chalk.red(`⚠ ${summary.totalErrors} error(s) occurred during cleanup`));
    for (const result of summary.results) {
      for (const error of result.errors) {
        console.log(chalk.dim.red(`  ${result.category.name}: ${error}`));
      }
    }
  }

  console.log();
}

function printJsonCleanResults(summary: CleanSummary | null, startTime: number, dryRun: boolean): void {
  const duration = Date.now() - startTime;

  const output: JsonCleanOutput = {
    timestamp: new Date().toISOString(),
    version: getPackageVersion(),
    dryRun,
    results: summary?.results.map((r) => ({
      category: {
        id: r.category.id,
        name: r.category.name,
      },
      cleanedItems: r.cleanedItems,
      freedSpace: r.freedSpace,
      errors: r.errors,
    })) ?? [],
    summary: {
      freedSpace: summary?.totalFreedSpace ?? 0,
      cleanedItems: summary?.totalCleanedItems ?? 0,
      errors: summary?.totalErrors ?? 0,
      duration,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}
