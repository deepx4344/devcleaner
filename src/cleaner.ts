import fs from "fs/promises";
import path from "path";
import picomatch from "picomatch";
import chalk from "chalk";
import readConfigFile from "./utils/reader.js";
import {
  AppConfig,
  CleanerOptions,
  ItemToDelete,
  ScanResult,
} from "./types/index.js";

const currentDirectory = process.cwd();

export async function initializeConfig(
  configPath: string,
): Promise<AppConfig | undefined> {
  return await readConfigFile(configPath);
}

export function createShouldSkipDir(
  configDetails: AppConfig | undefined,
  scanAll: boolean,
): (fullPath: string) => boolean {
  const defaultSkips: string[] = [
    "node_modules",
    ".git",
    ".cache",
    "dist",
    "build",
    "target",
  ];
  const configurationFileSkips = Array.isArray(
    configDetails?.folderExclusions,
  )
    ? configDetails.folderExclusions
    : [];
  
  const folderPatterns = configurationFileSkips.map((p) => {
    if (p.includes("*") || p.includes("?")) return p;
    if (p.startsWith(".")) {
      return `**/*${p}`;
    }
    return `**/${p}`;
  });
  
  const matchers = folderPatterns.map((g) => picomatch(g, { dot: true }));
  
  return (fullPath: string): boolean => {
    const name = path.basename(fullPath);
    const relPath = path.relative(currentDirectory, fullPath);
    
    if (!scanAll && defaultSkips.includes(name)) return true;
    
    if (matchers.some((m) => m(relPath) || m(name))) return true;
    
    return false;
  };
}

export function createMatchers(
  configDetails: AppConfig | undefined,
): ((path: string) => boolean)[] {
  const patternGlobs = (
    Array.isArray(configDetails?.filePatternToDelete)
      ? configDetails.filePatternToDelete
      : []
  ).map((p) => {
    if (p.includes("*") || p.includes("?")) return p;
    if (p.startsWith(".")) {
      return `**/*${p}`;
    }
    return `**/${p}`;
  });
  return patternGlobs.map((g) => picomatch(g, { dot: true }));
}

export function createDirectoryMatcher(
  configDetails: AppConfig | undefined,
): (path: string) => boolean {
  const folderPatterns = (
    Array.isArray(configDetails?.folderToDeleteByName)
      ? configDetails.folderToDeleteByName
      : []
  ).map((p) => {
    if (p.includes("*") || p.includes("?")) return p;
    return `**/${p}`;
  });

  const matchers = folderPatterns.map((g) => picomatch(g, { dot: true }));

  return (path: string): boolean => {
    return matchers.some((m) => m(path));
  };
}

export function createFileExclusionMatcher(
  configDetails: AppConfig | undefined,
): (path: string) => boolean {
  const exclusionPatterns = (
    Array.isArray(configDetails?.fileExclusions)
      ? configDetails.fileExclusions
      : []
  ).map((p) => {
    if (p.includes("*") || p.includes("?")) return p;
    if (p.startsWith(".")) {
      return `**/*${p}`;
    }
    return `**/${p}`;
  });
  
  const matchers = exclusionPatterns.map((g) => picomatch(g, { dot: true }));
  
  return (path: string): boolean => {
    return matchers.some((m) => m(path));
  };
}

async function checkIfEmpty(fullPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(fullPath);
    return entries.length === 0;
  } catch (e) {
    if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
      return true;
    }
    throw e;
  }
}

async function processDirectory(
  dir: string,
  configDetails: AppConfig | undefined,
  shouldSkipDir: (path: string) => boolean,
  matchers: ((path: string) => boolean)[],
  directoryMatcher: (path: string) => boolean,
  fileExclusionMatcher: (path: string) => boolean,
  filePathsToDelete: ItemToDelete[],
  force: boolean,
  verbose: boolean,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;

  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch (e) {
    if (e instanceof Error && verbose) {
      console.error(chalk.red(`Cannot read directory ${dir}:`), e.message || e);
    }
    return;
  }

  for (const file of entries) {
    if (signal?.aborted) return;

    const fullPath = path.resolve(dir, file);
    let stats;
    try {
      stats = await fs.stat(fullPath);
    } catch (err) {
      if (err instanceof Error && verbose) {
        console.error(chalk.red(`Cannot stat ${fullPath}:`), err.message || err);
      }
      continue;
    }

    if (stats.isDirectory()) {
      if (shouldSkipDir(fullPath)) continue;

      const baseName = path.basename(fullPath);
      const isCandidate = directoryMatcher(baseName);

      if (isCandidate) {
        const isEmpty = await checkIfEmpty(fullPath);
        if (isEmpty || force) {
          filePathsToDelete.push({ path: fullPath, type: "folder" });
          if (verbose) console.log(chalk.magenta("Matched folder candidate:"), fullPath);
          continue;
        }
      }
      const isEmpty = await checkIfEmpty(fullPath);
      if (isEmpty) {
        filePathsToDelete.push({ path: fullPath, type: "folder" });
        if (verbose) console.log(chalk.magenta("Matched empty folder:"), fullPath);
      } else {
        await processDirectory(
          fullPath,
          configDetails,
          shouldSkipDir,
          matchers,
          directoryMatcher,
          fileExclusionMatcher,
          filePathsToDelete,
          force,
          verbose,
          signal,
        );
      }
    } else {
      try {
        const rel = path.relative(currentDirectory, fullPath);
        const base = file;
        const excluded = fileExclusionMatcher(rel) || fileExclusionMatcher(base);

        if (!excluded) {
          const matched = matchers.some((m) => m(rel));
          if (matched) {
            filePathsToDelete.push({ path: fullPath, type: "file" });
            if (verbose) console.log(chalk.cyan("Matched file candidate:"), fullPath);
          }
        }
      } catch (err) {
        if (err instanceof Error && verbose) {
          console.error(
            chalk.red("Pattern match error for"),
            fullPath,
            err.message || err,
          );
        }
      }
    }
  }
}

export async function scanDirectories(
  configDetails: AppConfig | undefined,
  options: CleanerOptions,
): Promise<ScanResult> {
  const filePathsToDelete: ItemToDelete[] = [];

  if (!configDetails) {
    return { filesToDelete: filePathsToDelete };
  }

  const shouldSkipDir = createShouldSkipDir(configDetails, options.scanAll);
  const matchers = createMatchers(configDetails);
  const directoryMatcher = createDirectoryMatcher(configDetails);
  const fileExclusionMatcher = createFileExclusionMatcher(configDetails);

  const dirs = configDetails.directoriesToScan.map((d) =>
    path.isAbsolute(d) ? d : path.resolve(currentDirectory, d),
  );

  for (const dir of dirs) {
    if (options.signal?.aborted) break;

    if (shouldSkipDir(dir)) {
      if (options.verbose) console.log(chalk.yellow(`Skipping ${dir}`));
      continue;
    }
    try {
      await processDirectory(
        dir,
        configDetails,
        shouldSkipDir,
        matchers,
        directoryMatcher,
        fileExclusionMatcher,
        filePathsToDelete,
        options.force,
        options.verbose,
        options.signal,
      );
    } catch (e) {
      if (e instanceof Error && options.verbose) {
        console.error(chalk.red(`Failed to process ${dir}:`), e.message || e);
      }
    }
  }

  return { filesToDelete: filePathsToDelete };
}
export async function deleteFiles(
  filesToDelete: ItemToDelete[],
  verbose: boolean = false,
): Promise<void> {
  await Promise.all(
    filesToDelete.map(async (file) => {
      try {
        if (file.type === "folder") {
          await fs.rm(file.path, { recursive: true, force: true });
          if (verbose) console.log(chalk.green("Removed folder (recursive):"), file.path);
        } else {
          await fs.unlink(file.path);
          if (verbose) console.log(chalk.green("Removed file:"), file.path);
        }
      } catch (e) {
        if (e instanceof Error) {
          if (
            (e as NodeJS.ErrnoException).code === "EPERM" ||
            (e as NodeJS.ErrnoException).code === "EBUSY"
          ) {
            console.error(
              chalk.red(`Access/permission denied for ${file.type} at ${file.path}`),
            );
          } else if (verbose) {
            console.error(
              chalk.red(`Failed to remove ${file.type} at ${file.path}:`),
              e.message || e,
            );
          }
        }
      }
    }),
  );
}
