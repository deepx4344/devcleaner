import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { Command } from "commander";
import chalk from "chalk";
import { initializeConfig, scanDirectories, deleteFiles } from "./cleaner.js";
import { ItemToDelete, CleanerOptions } from "./types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultConfigPath = path.join(
  __dirname,
  "..",
  "config",
  "cleaner-config.json",
);
const cwdConfigPath = path.join(process.cwd(), "cleaner-config.json");
const abortController = new AbortController();

async function resolveConfigPath(): Promise<string> {
  try {
    await fs.access(cwdConfigPath);
    return cwdConfigPath;
  } catch {
    return defaultConfigPath;
  }
}

const program = new Command();
program
  .description("DevCleaner - remove temp files and empty dirs")
  .option("--dry-run", "List files to be deleted (default)", true)
  .option("-f, --force", "Perform deletions (overrides --dry-run)")
  .option("-y, --yes", "Assume yes to prompts (non-interactive)", false)
  .option("-c, --config <path>", "Path to config file")
  .option("--dirs <list>", "Comma-separated list of directories to scan")
  .option("--scan-all", "Include node_modules and .git in scan", false)
  .option("--verbose", "Enable verbose logging", false)
  .helpOption("-h, --help", "Display help for command");

program.parse(process.argv);
const opts = program.opts();

const dryRun = opts.force ? false : !!opts.dryRun;
const force = !!opts.force;
const autoYes = !!opts.yes;
const scanAll = !!opts.scanAll;
const verbose = !!opts.verbose;
const configPath = opts.config || (await resolveConfigPath());

function displayBanner(): void {
  console.log("");
  console.log(chalk.bold.cyan("╔════════════════════════════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("║"), chalk.bold.white("  DevCleaner"), chalk.gray("-"), chalk.green("Keep your dev environment clean"), chalk.bold.cyan("                ║"));
  console.log(chalk.bold.cyan("╚════════════════════════════════════════════════════════════╝"));
  console.log("");
}

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const coloredQuestion = chalk.yellow(question);
  const answer = await rl.question(coloredQuestion);
  rl.close();
  return answer;
}

async function displayResults(items: ItemToDelete[]): Promise<void> {
  console.log(chalk.bold.yellow("Here are the files and folders to be deleted:"));
  console.log("");
  items.forEach((item) => {
    const relPath = path.relative(process.cwd(), item.path);
    const prefix = item.type === "folder" ? chalk.magenta("[DIR]") : chalk.cyan("[FILE]");
    console.log(`${prefix} ${relPath}`);
  });
  console.log("");
  console.log(chalk.bold(`${items.length} items found`));
  console.log("");
}

async function handleDeletionConfirmation(
  items: ItemToDelete[],
): Promise<boolean> {
  if (dryRun) {
    console.log(chalk.yellow("Running in dry-run mode; no files will be deleted."));
    return false;
  }

  let answer: string;
  if (autoYes) {
    answer = "y";
  } else {
    answer = await promptUser("Should I go ahead and delete? y/n => ");
  }

  if (answer && answer.toLowerCase() === "y") {
    return true;
  } else if (answer && answer.toLowerCase() === "n") {
    console.log(chalk.yellow("Operation Canceled By User"));
    return false;
  } else {
    console.log(chalk.red("Unknown command"));
    return false;
  }
}

function gracefulExit(): void {
  console.log(chalk.yellow("Operation Canceled By User"));
  abortController.abort();
  process.exit(0);
}

async function runClean(): Promise<void> {
  try {
    displayBanner();
    const resolvedConfigPath = configPath;

    if (verbose) {
      console.log(chalk.blue(`Using config file: ${resolvedConfigPath}`));
    }

    const config = await initializeConfig(resolvedConfigPath);

    if (!config) {
      console.error(chalk.red("Failed to load configuration."));
      process.exit(1);
    }

    const cleanerOptions: CleanerOptions = {
      configPath: resolvedConfigPath,
      scanAll,
      verbose,
      force,
      signal: abortController.signal,
    };

    if (verbose) console.log(chalk.blue("Scanning directories..."));

    const { filesToDelete } = await scanDirectories(config, cleanerOptions);

    if (filesToDelete.length === 0) {
      console.log(chalk.green("No files found."));
      process.exit(0);
    }

    await displayResults(filesToDelete);

    const shouldDelete = await handleDeletionConfirmation(filesToDelete);

    if (shouldDelete) {
      await deleteFiles(filesToDelete, verbose);
      console.log(chalk.green.bold("All temp files deleted successfully"));
    }

    process.exit(0);
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === "AbortError") {
        console.log(chalk.yellow("Operation Canceled By User"));
      } else {
        console.error(chalk.red("An unexpected error occurred:"), e.message);
      }
    } else {
      console.error(chalk.red("An unexpected error occurred:"), e);
    }
    process.exit(1);
  }
}

process.on("SIGINT", gracefulExit);

await runClean();
