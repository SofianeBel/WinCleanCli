import chalk from 'chalk';
import confirm from '@inquirer/confirm';
import checkbox from '@inquirer/checkbox';
import select from '@inquirer/select';
import type { CategoryId, CleanSummary, CleanableItem, ScanResult, SafetyLevel } from '../types.js';
import { runAllScans, runScans, getScanner, getAllScanners } from '../scanners/index.js';
import { createCleanProgress, createScanProgress, expandPath, formatSize, getDiskSpace, loadConfig, loadProfiles } from '../utils/index.js';

const SAFETY_ICONS: Record<SafetyLevel, string> = {
  safe: chalk.green('●'),
  moderate: chalk.yellow('●'),
  risky: chalk.red('●'),
};

interface InteractiveOptions {
  includeRisky?: boolean;
  noProgress?: boolean;
}

export async function interactiveCommand(options: InteractiveOptions = {}): Promise<CleanSummary | null> {
  const startTime = Date.now();
  const config = await loadConfig();
  const profiles = await loadProfiles();

  console.log();
  console.log(chalk.bold.cyan('🧹 Windows Cleaner CLI'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log();

  // Profile selection
  const profileChoices = [
    { name: chalk.dim('Manual selection - Choose categories yourself'), value: 'manual' },
    { name: `${chalk.yellow('⚡')} Quick Clean - Browser cache, temp files, recycle bin`, value: 'quick' },
    { name: `${chalk.yellow('💻')} Developer Clean - Dev caches, node_modules, Docker`, value: 'developer' },
    { name: `${chalk.yellow('🔥')} Full Clean - All safe and moderate categories`, value: 'full' },
  ];

  // Add custom profiles
  const customProfiles = Object.values(profiles).filter(p => !['quick', 'developer', 'full'].includes(p.id));
  for (const profile of customProfiles) {
    profileChoices.push({
      name: `${chalk.cyan('📋')} ${profile.name} - ${profile.description}`,
      value: profile.id,
    });
  }

  const selectedProfile = await select({
    message: 'How would you like to clean?',
    choices: profileChoices,
  });

  let selectedCategories: CategoryId[] | null = null;
  if (selectedProfile !== 'manual') {
    const profile = profiles[selectedProfile];
    if (profile) {
      selectedCategories = profile.categories;
      console.log();
      console.log(chalk.cyan(`Using profile: ${profile.name}`));
    }
  }

  const showProgress = !options.noProgress && process.stdout.isTTY;
  const scannersToUse = selectedCategories
    ? getAllScanners().filter(s => selectedCategories!.includes(s.category.id))
    : getAllScanners();
  const scanProgress = showProgress ? createScanProgress(scannersToUse.length) : null;

  console.log(chalk.cyan('Scanning your PC for cleanable files...\n'));

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

  const summary = selectedCategories
    ? await runScans(selectedCategories, scanOptions)
    : await runAllScans(scanOptions);

  scanProgress?.finish();

  if (summary.totalSize === 0) {
    console.log(chalk.green('✓ Your PC is already clean! Nothing to remove.\n'));
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
    console.log(chalk.yellow('⚠ Hiding risky categories:'));
    for (const result of riskyResults) {
      console.log(chalk.dim(`  ${SAFETY_ICONS.risky} ${result.category.name}: ${formatSize(result.totalSize)}`));
    }
    console.log(chalk.dim(`  Total hidden: ${formatSize(riskySize)}`));
    console.log(chalk.dim('  Run with --risky to include these categories'));
    resultsWithItems = safeResults;
  }

  if (resultsWithItems.length === 0) {
    console.log(chalk.green('\n✓ Nothing safe to clean!\n'));
    return null;
  }

  console.log();
  const visibleSize = resultsWithItems.reduce((sum, r) => sum + r.totalSize, 0);
  console.log(chalk.bold(`Found ${chalk.green(formatSize(visibleSize))} that can be cleaned:`));
  console.log();

  let selectedItems: { categoryId: CategoryId; items: CleanableItem[] }[];

  if (selectedCategories) {
    // Profile was selected - skip category selection, auto-select all
    // But still prompt for individual items in special categories
    selectedItems = await selectItemsFromProfile(resultsWithItems);
  } else {
    // Manual selection - show full category selection
    const defaultSelected = config.defaultCategories?.length ? new Set(config.defaultCategories) : undefined;
    selectedItems = await selectItemsInteractively(resultsWithItems, defaultSelected);
  }

  if (selectedItems.length === 0) {
    console.log(chalk.yellow('\nNo items selected. Nothing to clean.\n'));
    return null;
  }

  const totalToClean = selectedItems.reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.size, 0), 0);
  const totalItems = selectedItems.reduce((sum, s) => sum + s.items.length, 0);

  console.log();
  console.log(chalk.bold('Summary:'));
  console.log(`  Items to delete: ${chalk.yellow(totalItems.toString())}`);
  console.log(`  Space to free: ${chalk.green(formatSize(totalToClean))}`);
  console.log();

  const proceed = await confirm({
    message: `Proceed with cleaning?`,
    default: true,
  });

  if (!proceed) {
    console.log(chalk.yellow('\nCleaning cancelled.\n'));
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

    const result = await scanner.clean(items);
    cleanResults.results.push(result);
    cleanResults.totalFreedSpace += result.freedSpace;
    cleanResults.totalCleanedItems += result.cleanedItems;
    cleanResults.totalErrors += result.errors.length;
    cleanedCount++;
  }

  cleanProgress?.finish();

  await printCleanResults(cleanResults, startTime);

  return cleanResults;
}

async function selectItemsInteractively(
  results: ScanResult[],
  defaultSelected?: Set<CategoryId>
): Promise<{ categoryId: CategoryId; items: CleanableItem[] }[]> {
  const choices = results.map((r) => {
    const safetyIcon = SAFETY_ICONS[r.category.safetyLevel];
    const isRisky = r.category.safetyLevel === 'risky';

    return {
      name: `${safetyIcon} ${r.category.name.padEnd(28)} ${chalk.yellow(formatSize(r.totalSize).padStart(10))} ${chalk.dim(`(${r.items.length} items)`)}`,
      value: r.category.id,
      checked: defaultSelected ? defaultSelected.has(r.category.id) : !isRisky,
    };
  });

  const selectedCategories = await checkbox<CategoryId>({
    message: 'Select categories to clean (space to toggle, enter to confirm):',
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
    const needsItemSelection = isRisky || result.category.id === 'large-files' || result.category.id === 'itunes-backups';

    if (needsItemSelection) {
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

async function selectItemsFromProfile(
  results: ScanResult[]
): Promise<{ categoryId: CategoryId; items: CleanableItem[] }[]> {
  const selectedItems: { categoryId: CategoryId; items: CleanableItem[] }[] = [];

  // Show what will be cleaned from the profile
  console.log(chalk.dim('Categories included in profile:'));
  for (const result of results) {
    const safetyIcon = SAFETY_ICONS[result.category.safetyLevel];
    console.log(`  ${safetyIcon} ${result.category.name.padEnd(28)} ${chalk.yellow(formatSize(result.totalSize).padStart(10))} ${chalk.dim(`(${result.items.length} items)`)}`);
  }
  console.log();

  for (const result of results) {
    const isRisky = result.category.safetyLevel === 'risky';
    const needsItemSelection = isRisky || result.category.id === 'large-files' || result.category.id === 'itunes-backups';

    if (needsItemSelection) {
      // For special categories, still prompt for individual items
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
      // For safe categories, auto-select all items
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
