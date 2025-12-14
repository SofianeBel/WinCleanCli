import chalk from 'chalk';
import checkbox from '@inquirer/checkbox';
import input from '@inquirer/input';
import type { CategoryId, CleaningProfile } from '../types.js';
import { CATEGORIES } from '../types.js';
import { BUILTIN_PROFILES, deleteProfile, loadProfiles, saveProfile } from '../utils/index.js';

interface ProfileCommandOptions {
  list?: boolean;
  create?: boolean;
  delete?: string;
  show?: string;
}

export async function profileCommand(options: ProfileCommandOptions): Promise<void> {
  if (options.list) {
    await listProfiles();
    return;
  }

  if (options.show) {
    await showProfile(options.show);
    return;
  }

  if (options.create) {
    await createProfile();
    return;
  }

  if (options.delete) {
    await removeProfile(options.delete);
    return;
  }

  // Default: show list
  await listProfiles();
}

async function listProfiles(): Promise<void> {
  const profiles = await loadProfiles();

  console.log();
  console.log(chalk.bold('Available Cleaning Profiles'));
  console.log(chalk.dim('─'.repeat(60)));

  // Built-in profiles first
  console.log();
  console.log(chalk.cyan('Built-in Profiles:'));
  for (const profile of Object.values(BUILTIN_PROFILES)) {
    console.log(`  ${chalk.yellow(profile.id.padEnd(12))} ${profile.name}`);
    console.log(chalk.dim(`               ${profile.description}`));
    console.log(chalk.dim(`               Categories: ${profile.categories.length}`));
  }

  // Custom profiles
  const customProfiles = Object.values(profiles).filter(
    (p) => !(p.id in BUILTIN_PROFILES)
  );

  if (customProfiles.length > 0) {
    console.log();
    console.log(chalk.cyan('Custom Profiles:'));
    for (const profile of customProfiles) {
      console.log(`  ${chalk.yellow(profile.id.padEnd(12))} ${profile.name}`);
      console.log(chalk.dim(`               ${profile.description}`));
      console.log(chalk.dim(`               Categories: ${profile.categories.length}`));
    }
  }

  console.log();
  console.log(chalk.dim('Usage: windows-cleaner-cli clean --profile <name>'));
  console.log(chalk.dim('       windows-cleaner-cli profile --show <name>'));
  console.log(chalk.dim('       windows-cleaner-cli profile --create'));
  console.log();
}

async function showProfile(profileId: string): Promise<void> {
  const profiles = await loadProfiles();
  const profile = profiles[profileId];

  if (!profile) {
    console.error(chalk.red(`Profile not found: ${profileId}`));
    console.error(chalk.dim(`Available profiles: ${Object.keys(profiles).join(', ')}`));
    return;
  }

  const isBuiltin = profileId in BUILTIN_PROFILES;

  console.log();
  console.log(chalk.bold(`Profile: ${profile.name}`));
  console.log(chalk.dim('─'.repeat(50)));
  console.log();
  console.log(`  ${chalk.cyan('ID:')}          ${profile.id}`);
  console.log(`  ${chalk.cyan('Type:')}        ${isBuiltin ? chalk.yellow('Built-in') : chalk.green('Custom')}`);
  console.log(`  ${chalk.cyan('Description:')} ${profile.description}`);
  console.log();
  console.log(chalk.cyan('  Categories:'));
  for (const categoryId of profile.categories) {
    const category = CATEGORIES[categoryId];
    if (category) {
      console.log(chalk.dim(`    - ${category.name} (${categoryId})`));
    } else {
      console.log(chalk.dim.red(`    - ${categoryId} (unknown)`));
    }
  }

  if (profile.options) {
    console.log();
    console.log(chalk.cyan('  Options:'));
    if (profile.options.includeRisky) {
      console.log(chalk.dim('    - Include risky categories'));
    }
    if (profile.options.downloadsDaysOld) {
      console.log(chalk.dim(`    - Downloads older than ${profile.options.downloadsDaysOld} days`));
    }
    if (profile.options.largeFilesMinSize) {
      console.log(chalk.dim(`    - Large files min size: ${profile.options.largeFilesMinSize} bytes`));
    }
  }

  console.log();
}

async function createProfile(): Promise<void> {
  console.log();
  console.log(chalk.bold('Create New Profile'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log();

  // Get profile ID
  const id = await input({
    message: 'Profile ID (lowercase, no spaces):',
    validate: (value) => {
      if (!value) return 'ID is required';
      if (!/^[a-z0-9-]+$/.test(value)) return 'ID must be lowercase letters, numbers, and hyphens only';
      if (value in BUILTIN_PROFILES) return 'Cannot use built-in profile name';
      return true;
    },
  });

  // Get profile name
  const name = await input({
    message: 'Profile name:',
    validate: (value) => value ? true : 'Name is required',
  });

  // Get description
  const description = await input({
    message: 'Description:',
    validate: (value) => value ? true : 'Description is required',
  });

  // Select categories
  console.log();
  console.log(chalk.dim('Select categories to include in this profile:'));

  const categoryChoices = Object.values(CATEGORIES).map((cat) => ({
    name: `${cat.name} (${cat.id}) - ${cat.safetyLevel}`,
    value: cat.id,
    checked: false,
  }));

  const selectedCategories = await checkbox<CategoryId>({
    message: 'Categories:',
    choices: categoryChoices,
    pageSize: 15,
  });

  if (selectedCategories.length === 0) {
    console.log(chalk.yellow('\nNo categories selected. Profile not created.'));
    return;
  }

  const profile: CleaningProfile = {
    id,
    name,
    description,
    categories: selectedCategories,
  };

  await saveProfile(profile);

  console.log();
  console.log(chalk.green(`✓ Profile "${name}" created successfully!`));
  console.log(chalk.dim(`Use it with: windows-cleaner-cli clean --profile ${id}`));
  console.log();
}

async function removeProfile(profileId: string): Promise<void> {
  try {
    await deleteProfile(profileId);
    console.log(chalk.green(`✓ Profile "${profileId}" deleted successfully!`));
  } catch (error) {
    console.error(chalk.red((error as Error).message));
  }
}
