#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
const currentDirectory = process.cwd();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToConfig = path.join(__dirname, "cleaner-config.json");

let filePathsToDelete = [];

let dryRun = false;
let force = false;
const abortController = new AbortController();

let configuration = JSON.parse(await fs.readFile(pathToConfig, "utf8"));
if (process.argv.length <= 2) {
  console.log("No arguement given");
  process.exit(0);
}

process.argv.forEach((arg) => {
  if (arg === "--dry-run") {
    dryRun = true;
  } else if (arg === "--force") {
    force = true;
  }
});

if (dryRun && force) {
  console.log("Cannot dry-run and force, pick one option");
  process.exit(0);
}

async function startDryRun() {
  console.log("Processing from", currentDirectory);
  try {
    await processDirectory(currentDirectory);
  } catch (e) {}
}

async function processDirectory(dir) {
  let direct = await fs.readdir(dir);
  try {
    await Promise.all(
      direct.map(async (file) => {
        let fullPath = path.join(dir, file);
        let stats = await fs.stat(fullPath);
        // console.log(fullPath);
        if (stats.isDirectory()) {
          let emptys = await empty(fullPath);
          if (emptys) {
            let pushObj = { path: fullPath, type: "folder" };
            filePathsToDelete.push(pushObj);
          } else {
            await processDirectory(fullPath);
          }
        } else {
          configuration.filePatternToDelete.map(async (ext) => {
            if (
              fullPath.endsWith(ext) &&
              !configuration.exclusions.includes(file)
            ) {
              let pushObj = { path: fullPath, type: "file" };
              filePathsToDelete.push(pushObj);
            }
          });
        }
      })
    );
  } catch (e) {}
  //   console.log(direct);
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
      if (file.type === "folder") {
        await fs.rmdir(file.path);
      } else {
        await fs.unlink(file.path);
      }
    })
  );
}

async function DryRun(ITBD) {
  try {
    await startDryRun();
    if (ITBD.length === 0) {
      console.log("No files found");
      process.exit(0);
    }
    console.log("Here are the file to be deleted");
    console.log("");
    ITBD.map((items) => {
      console.log(items);
    });

    console.log("");
    console.log(`${ITBD.length} files and empty folders found`);
    console.log("");
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question("Should i go ahead and delete? y/n => ");
    if (answer.toLowerCase() === "y") {
      await deleteFiles(filePathsToDelete);
      console.log("All Temp Files deleted");
    } else if (answer.toLowerCase() === "n") {
      console.log("Operation Canceled By User");
    } else {
      console.log("Unknown command");
    }
    rl.close();
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
}
// console.log(filePathsToDelete);
