import fs from "fs/promises";
import path from "path";
import picomatch from "picomatch";
import readConfigFile from "./utils/reader.js";
import { AppConfig, CleanerOptions, ItemToDelete, ScanResult } from "./types/index.js";

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
  return (fullPath: string): boolean => {
    const name = path.basename(fullPath);
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
    const skipList: Set<string> = new Set([
      ...defaultSkips,
      ...configurationFileSkips,
    ]);
    if (!scanAll && skipList.has(name)) return true;
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

async function checkIfEmpty(fullPath: string): Promise<boolean> {
  const directory = await fs.opendir(fullPath);
  const entry = await directory.read();
  await directory.close();
  return entry === null;
}

async function processDirectory(
  dir: string,
  configDetails: AppConfig | undefined,
  shouldSkipDir: (path: string) => boolean,
  matchers: ((path: string) => boolean)[],
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
      console.error(`Cannot read directory ${dir}:`, e.message || e);
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
        console.error(`Cannot stat ${fullPath}:`, err.message || err);
      }
      continue;
    }

    if (stats.isDirectory()) {
      if (shouldSkipDir(fullPath)) continue;

      const baseName = path.basename(fullPath);
      const isCandidate = Array.isArray(configDetails?.folderToDeleteByName) &&
        configDetails.folderToDeleteByName.includes(baseName);

      if (isCandidate) {
        const isEmpty = await checkIfEmpty(fullPath);
        if (isEmpty || force) {
          filePathsToDelete.push({ path: fullPath, type: "folder" });
          if (verbose) console.log("Matched folder candidate:", fullPath);
          continue; // Don't recurse into a folder we're deleting
        }
      }

      // Check if it's an empty folder anyway
      const isEmpty = await checkIfEmpty(fullPath);
      if (isEmpty) {
        filePathsToDelete.push({ path: fullPath, type: "folder" });
        if (verbose) console.log("Matched empty folder:", fullPath);
      } else {
        await processDirectory(
          fullPath,
          configDetails,
          shouldSkipDir,
          matchers,
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
        const excluded =
          Array.isArray(configDetails?.fileExclusions) &&
          configDetails.fileExclusions.includes(base);

        if (!excluded) {
          const matched = matchers.some(
            (m) => m(rel) || m(base) || m(fullPath),
          );
          if (matched) {
            filePathsToDelete.push({ path: fullPath, type: "file" });
            if (verbose) console.log("Matched file candidate:", fullPath);
          }
        }
      } catch (err) {
        if (err instanceof Error && verbose) {
          console.error(
            "Pattern match error for",
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

  const dirs = configDetails.directoriesToScan.map((d) =>
    path.isAbsolute(d) ? d : path.resolve(currentDirectory, d),
  );

  for (const dir of dirs) {
    if (options.signal?.aborted) break;

    if (shouldSkipDir(dir)) {
      if (options.verbose) console.log(`Skipping ${dir}`);
      continue;
    }
    try {
      await processDirectory(
        dir,
        configDetails,
        shouldSkipDir,
        matchers,
        filePathsToDelete,
        options.force,
        options.verbose,
        options.signal,
      );
    } catch (e) {
      if (e instanceof Error && options.verbose) {
        console.error(`Failed to process ${dir}:`, e.message || e);
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
          if (verbose) console.log("Removed folder (recursive):", file.path);
        } else {
          await fs.unlink(file.path);
          if (verbose) console.log("Removed file:", file.path);
        }
      } catch (e) {
        if (e instanceof Error) {
          if ((e as NodeJS.ErrnoException).code === "EPERM" || (e as NodeJS.ErrnoException).code === "EBUSY") {
            console.error(
              `Access/permission denied for ${file.type} at ${file.path}`,
            );
          } else if (verbose) {
            console.error(
              `Failed to remove ${file.type} at ${file.path}:`,
              e.message || e,
            );
          }
        }
      }
    }),
  );
}

