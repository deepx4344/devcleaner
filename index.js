#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { Command } from "commander";
import picomatch from "picomatch";
const currentDirectory = process.cwd();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToConfig = path.join(__dirname, "cleaner-config.json");


const program = new Command();
program
  .description('DevCleaner - remove temp files and empty dirs')
  .option('--dry-run', 'List files to be deleted (default)', true)
  .option('-f, --force', 'Perform deletions (overrides --dry-run)')
  .option('-y, --yes', 'Assume yes to prompts (non-interactive)', false)
  .option('-c, --config <path>', 'Path to config file', pathToConfig)
  .option('--dirs <list>', 'Comma-separated list of directories to scan')
  .option('--scan-all', 'Include node_modules and .git in scan', false)
  .option('--verbose', 'Enable verbose logging', false)
  .helpOption('-h, --help', 'Display help for command');

program.parse(process.argv);
const opts = program.opts();

let filePathsToDelete = [];
const abortController = new AbortController();

let dryRun = opts.force ? false : !!opts.dryRun;
let force = !!opts.force;
const autoYes = !!opts.yes;
const scanAll = !!opts.scanAll;
const verbose = !!opts.verbose;

const configPath = opts.config || pathToConfig;
let configuration;
try {
  configuration = JSON.parse(await fs.readFile(configPath, "utf8"));
} catch (e) {
  console.error("Failed to read config:", configPath, e.message || e);
  process.exit(1);
}

if (opts.dirs) {
  configuration.directoriesToScan = opts.dirs.split(",").map((d) => d.trim());
}


if (
  !configuration.directoriesToScan ||
  !Array.isArray(configuration.directoriesToScan) ||
  configuration.directoriesToScan.length === 0
) {
  configuration.directoriesToScan = ["."];
}

function shouldSkipDir(fullPath) {
  const name = path.basename(fullPath);
  const defaultSkips = ["node_modules", ".git", ".cache", "dist", "build", "target"];
  const configuredSkips = Array.isArray(configuration.skipDirectories)
    ? configuration.skipDirectories
    : [];
  const skipList = new Set([...defaultSkips, ...configuredSkips]);
  if (!scanAll && skipList.has(name)) return true;
  return false;
}

async function startDryRun() {
  const dirs = configuration.directoriesToScan.map((d) =>
    path.isAbsolute(d) ? d : path.join(currentDirectory, d)
  );
  for (const dir of dirs) {
    if (shouldSkipDir(dir)) {
      if (verbose) console.log(`Skipping ${dir}`);
      continue;
    }
    try {
      await processDirectory(dir);
    } catch (e) {
      if (verbose) console.error(`Failed to process ${dir}:`, e.message || e);
    }
  }
}

const patternGlobs = (Array.isArray(configuration.filePatternToDelete)
  ? configuration.filePatternToDelete
  : []
).map((p) => {
  if (p.includes("*") || p.includes("?")) return p;
  if (p.startsWith(".")) {
    return `**/*${p}`;
  }
  return `**/${p}`;
});

const matchers = patternGlobs.map((g) => picomatch(g, { dot: true }));

async function processDirectory(dir) {
  let direct;
  try {
    direct = await fs.readdir(dir);
  } catch (e) {
    if (verbose) console.error(`Cannot read directory ${dir}:`, e.message || e);
    return;
  }

  try {
    await Promise.all(
      direct.map(async (file) => {
        const fullPath = path.join(dir, file);
        let stats;
        try {
          stats = await fs.stat(fullPath);
        } catch (stErr) {
          if (verbose) console.error(`Cannot stat ${fullPath}:`, stErr.message || stErr);
          return;
        }

        if (stats.isDirectory()) {
          if (shouldSkipDir(fullPath)) return;
          const baseName = path.basename(fullPath);
          if (
            Array.isArray(configuration.folderToDeleteByName) &&
            configuration.folderToDeleteByName.includes(baseName)
          ) {
            const emptys = await empty(fullPath);
            if (emptys || force) {
              filePathsToDelete.push({ path: fullPath, type: "folder" });
              if (verbose) console.log('Matched folder candidate:', fullPath);
            } else {
              await processDirectory(fullPath);
            }
          } else {
            const emptys = await empty(fullPath);
            if (emptys) {
              filePathsToDelete.push({ path: fullPath, type: "folder" });
              if (verbose) console.log('Matched empty folder:', fullPath);
            } else {
              await processDirectory(fullPath);
            }
          }
        } else {
          try {
            const rel = path.relative(currentDirectory, fullPath);
            const base = file;
            const excluded = Array.isArray(configuration.exclusions) && configuration.exclusions.includes(base);
            if (!excluded) {
              const matched = matchers.some((m) => m(rel) || m(base) || m(fullPath));
              if (matched) {
                filePathsToDelete.push({ path: fullPath, type: "file" });
                if (verbose) console.log('Matched file candidate:', fullPath);
              }
            }
          } catch (matchErr) {
            if (verbose) console.error('Pattern match error for', fullPath, matchErr.message || matchErr);
          }
        }
      })
    );
  } catch (e) {
    if (verbose) console.error(`Error scanning directory ${dir}:`, e.stack || e);
  }
}

const empty = async (fullPath) => {
  const directory = await fs.opendir(fullPath);
  const empty = await directory.read();
  await directory.close();
  return empty === null;
};

async function deleteFiles(filesToDelete) {
  await Promise.all(
    filesToDelete.map(async (file) => {
      try {
        if (file.type === "folder") {
          if (force) {
            await fs.rm(file.path, { recursive: true, force: true });
            if (verbose) console.log('Removed folder (recursive):', file.path);
          } else {
            await fs.rmdir(file.path);
            if (verbose) console.log('Removed empty folder:', file.path);
          }
        } else {
          await fs.unlink(file.path);
          if (verbose) console.log('Removed file:', file.path);
        }
      } catch (e) {
        if (e && (e.code === "EPERM" || e.code === "EBUSY")) {
          console.error(`Access/permission denied for ${file.type} at ${file.path}`);
        } else if (verbose) {
          console.error(`Failed to remove ${file.type} at ${file.path}:`, e && e.message ? e.message : e);
        }
      }
    })
  );
  filesToDelete.length = 0;
}

const deleteFoundFiles = async (ITBD) => {
  if (ITBD.length === 0) {
    console.log('No files to delete.');
    return;
  }
  await deleteFiles(ITBD);
};

async function DryRun(ITBD) {
  try {
    await startDryRun();
    if (ITBD.length === 0) {
      console.log("No files found");
      process.exit(0);
    }
    console.log("Here are the files to be deleted");
    console.log("");
    ITBD.forEach((items) => {
      console.log(items);
    });

    console.log("");
    console.log(`${ITBD.length} files and empty folders found`);
    console.log("");
    
    if (dryRun) {
      console.log('Running in dry-run mode; no files will be deleted.');
    } else {
      let answer = null;
      if (autoYes) {
        answer = "y";
      } else {
        const rl = readline.createInterface({ input, output });
        answer = await rl.question("Should i go ahead and delete? y/n => ");
        rl.close();
      }

      if (answer && answer.toLowerCase() === "y") {
        await deleteFoundFiles(ITBD);
        console.log("All temp files deleted");
      } else if (answer && answer.toLowerCase() === "n") {
        console.log("Operation Canceled By User");
      } else {
        console.log("Unknown command");
      }
    }
  } catch (e) {
    if (e.name === "AbortError") {
      console.log("Operation Canceled By User");
    } else {
      console.log(e);
      console.log("An unexpected Error occured.");
    }
  } finally {
    console.log("Exiting gracefully");
    process.exit(0);
  }
}

const graceFulExit = async () => {
  console.log("Operation Canceled By User");
  abortController.abort();
  process.exit(0);
};

process.on("SIGINT", graceFulExit);

if (dryRun) {
  await DryRun(filePathsToDelete);
} else if (force) {
  if (verbose) console.log("Scanning directories...");
  await startDryRun();
  if (filePathsToDelete.length === 0) {
    console.log("No files found to delete.");
  } else {
    console.log(`Deleting ${filePathsToDelete.length} file(s)/folder(s)...`);
    await deleteFoundFiles(filePathsToDelete);
    console.log("All temp files deleted successfully");
  }
}
