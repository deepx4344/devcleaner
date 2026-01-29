import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { Command } from "commander";
import { initializeConfig, scanDirectories, deleteFiles } from "./cleaner.js";
import { ItemToDelete, CleanerOptions } from "./types/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultConfigPath = path.join(__dirname, "..", "config", "cleaner-config.json");
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

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

async function displayResults(items: ItemToDelete[]): Promise<void> {
  console.log("Here are the files and folders to be deleted:");
  console.log("");
  items.forEach((item) => {
    const relPath = path.relative(process.cwd(), item.path);
    const prefix = item.type === 'folder' ? '[DIR] ' : '[FILE]';
    console.log(`${prefix} ${relPath}`);
  });
  console.log("");
  console.log(`${items.length} items found`);
  console.log("");
}

async function handleDeletionConfirmation(
  items: ItemToDelete[],
): Promise<boolean> {
  if (dryRun) {
    console.log("Running in dry-run mode; no files will be deleted.");
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
    console.log("Operation Canceled By User");
    return false;
  } else {
    console.log("Unknown command");
    return false;
  }
}

function gracefulExit(): void {
  console.log("Operation Canceled By User");
  abortController.abort();
  process.exit(0);
}

async function runClean(): Promise<void> {
  try {
    const resolvedConfigPath = opts.config || (await resolveConfigPath());

    if (verbose) {
      console.log(`Using config file: ${resolvedConfigPath}`);
    }

    const config = await initializeConfig(resolvedConfigPath);

    if (!config) {
      console.error("Failed to load configuration.");
      process.exit(1);
    }

    const cleanerOptions: CleanerOptions = {
      configPath: resolvedConfigPath,
      scanAll,
      verbose,
      force,
      signal: abortController.signal,
    };

    if (verbose) console.log("Scanning directories...");

    const { filesToDelete } = await scanDirectories(config, cleanerOptions);

    if (filesToDelete.length === 0) {
      console.log("No files found.");
      process.exit(0);
    }

    await displayResults(filesToDelete);

    const shouldDelete = await handleDeletionConfirmation(filesToDelete);

    if (shouldDelete) {
      await deleteFiles(filesToDelete, verbose);
      console.log("All temp files deleted successfully");
    }

    process.exit(0);
  } catch (e) {
    if (e instanceof Error) {
      if (e.name === "AbortError") {
        console.log("Operation Canceled By User");
      } else {
        console.error("An unexpected error occurred:", e.message);
      }
    } else {
      console.error("An unexpected error occurred:", e);
    }
    process.exit(1);
  }
}

process.on("SIGINT", gracefulExit);

await runClean();
