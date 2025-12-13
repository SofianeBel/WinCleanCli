import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import checkbox from '@inquirer/checkbox';
import type { CategoryId, CleanSummary, CleanableItem, ScanResult, SafetyLevel } from '../types.js';
import { runAllScans, runScans, getScanner, getAllScanners } from '../scanners/index.js';
import { createCleanProgress, createScanProgress, expandPath, formatSize, loadConfig } from '../utils/index.js';

interface CleanCommandOptions {
  all?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  category?: CategoryId;
  includeRisky?: boolean;
  noProgress?: boolean;
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
  const config = await loadConfig();
  const showProgress = !options.noProgress && process.stdout.isTTY;
  const scanners = options.category ? [options.category] : getAllScanners().map((s) => s.category.id);
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

  const summary = options.category
    ? await runScans([options.category], scanOptions)
    : await runAllScans(scanOptions);

  scanProgress?.finish();

  if (summary.totalSize === 0) {
    console.log(chalk.green('\n✓ Your PC is already clean!\n'));
    return null;
  }

  const excluded = new Set(config.excludeCategories ?? []);
  let resultsWithItems = summary.results
    .filter((r) => r.items.length > 0)
    .filter((r) => !excluded.has(r.category.id));

  const riskyResults = resultsWithItems.filter((r) => r.category.safetyLevel === 'risky');
  const safeResults = resultsWithItems.filter((r) => r.category.safetyLevel !== 'risky');

  if (!options.includeRisky && riskyResults.length > 0) {
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
    resultsWithItems = safeResults;
  }

  if (resultsWithItems.length === 0) {
    console.log(chalk.green('\n✓ Nothing safe to clean!\n'));
    return null;
  }

  let selectedItems: { categoryId: CategoryId; items: CleanableItem[] }[] = [];

  if (options.all) {
    selectedItems = resultsWithItems.map((r) => ({
      categoryId: r.category.id,
      items: r.items,
    }));
  } else {
    const defaultSelected = config.defaultCategories?.length ? new Set(config.defaultCategories) : undefined;
    selectedItems = await selectItemsInteractively(resultsWithItems, defaultSelected);
  }

  if (selectedItems.length === 0) {
    console.log(chalk.yellow('\nNo items selected for cleaning.\n'));
    return null;
  }

  const totalToClean = selectedItems.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.size, 0), 0);
  const totalItems = selectedItems.reduce((sum, s) => sum + s.items.length, 0);

  if (!options.yes && !options.dryRun) {
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
    console.log(chalk.cyan('\n[DRY RUN] Would clean the following:'));
    for (const { categoryId, items } of selectedItems) {
      const scanner = getScanner(categoryId);
      const size = items.reduce((sum, i) => sum + i.size, 0);
      console.log(`  ${scanner.category.name}: ${items.length} items (${formatSize(size)})`);
    }
    console.log(chalk.cyan(`\n[DRY RUN] Would free ${formatSize(totalToClean)}\n`));
    return null;
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

  printCleanResults(cleanResults);

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

function printCleanResults(summary: CleanSummary): void {
  console.log();
  console.log(chalk.bold.green('✓ Cleaning Complete'));
  console.log(chalk.dim('─'.repeat(50)));

  for (const result of summary.results) {
    if (result.cleanedItems > 0) {
      console.log(
        `  ${result.category.name.padEnd(30)} ${chalk.green('✓')} ${formatSize(result.freedSpace)} freed`
      );
    }
    for (const error of result.errors) {
      console.log(`  ${result.category.name.padEnd(30)} ${chalk.red('✗')} ${error}`);
    }
  }

  console.log();
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.bold(`Freed: ${chalk.green(formatSize(summary.totalFreedSpace))}`));
  console.log(chalk.dim(`Cleaned ${summary.totalCleanedItems} items`));

  if (summary.totalErrors > 0) {
    console.log(chalk.red(`Errors: ${summary.totalErrors}`));
  }

  console.log();
}
