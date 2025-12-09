# DevCleaner

> A powerful CLI tool to keep your development environment clean by removing temporary files, logs, caches, and empty directories.

**DevCleaner** helps you reclaim disk space and maintain a tidy codebase by intelligently scanning and deleting unwanted artifacts. It comes with safe defaults, a dry-run mode, and flexible configuration options.

## Features

*   **🛡️ Safe by Default**: Runs in **Dry-Run** mode automatically. You must explicitly force deletion.
*   **⚙️ Configurable**: Define your own patterns for files and folders to clean via `cleaner-config.json`.
*   **🧠 Smart Exclusions**: Automatically skips critical directories like `node_modules`, `.git`, and `dist`.
*   **🚀 Fast Scanning**: Uses efficient glob matching to find clutter quickly.
*   **Interactive Mode**: Prompts for confirmation before deleting anything (unless forced with `--yes`).

## Installation

You can run `DevCleaner` directly using `npx` or install it globally.

### Using npx (Recommended)
```bash
npx devcleaner
```

### Global Installation
```bash
npm install -g devcleaner
```

## Usage

### Basic Usage (Dry Run)
By default, `DevCleaner` will only **list** the files that would be deleted. It will **not** delete anything.

```bash
clean
# or if running from source
node index.js
```

### Delete Files
To actually delete files, you can use the interactive mode or force the deletion.

**Interactive Mode (Prompts for confirmation):**
```bash
clean --force
```

**Force Deletion (No Prompts):**
```bash
clean --force --yes
```

### Scan Specific Directories
You can limit the scan to specific directories (comma-separated).

```bash
clean --dirs "src,tests,packages"
```

### Scan All Directories
By default, `DevCleaner` skips `node_modules` and `.git`. To scan everything (use with caution!):

```bash
clean --scan-all
```

## Configuration

`DevCleaner` looks for a `cleaner-config.json` file in the current directory. If not found, it uses default settings.

### Default Configuration
```json
{
  "filePatternToDelete": [
    ".temp", ".tmp", ".log", ".logs", ".lock", ".locks",
    "**/*lock.json", "_somefile", ".test.ts", ".test.js", 
    ".spec.js", ".cy.js", ".map"
  ],
  "folderToDeleteByName": [
    ".DS_Store", "__pycache__", "temp_cache", "logs", 
    "temp", "temps", "log"
  ],
  "exclusions": ["index.js", "main.js"]
}
```

### Custom Configuration
Create a `cleaner-config.json` in your project root to override defaults.

| Field | Description |
| :--- | :--- |
| `filePatternToDelete` | Array of glob patterns for files to delete (e.g., `*.log`). |
| `folderToDeleteByName` | Array of folder names to delete recursively (e.g., `tmp`). |
| `exclusions` | Array of specific filenames to preserve (e.g., `important.log`). |
| `directoriesToScan` | Array of directories to start scanning from (default: `["."]`). |

## CLI Options

| Option | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| `--dry-run` | | List files to be deleted without deleting them. | `true` |
| `--force` | `-f` | Perform deletions (disables dry-run). | `false` |
| `--yes` | `-y` | Skip confirmation prompts (non-interactive). | `false` |
| `--dirs <list>` | | Comma-separated list of directories to scan. | `.` |
| `--config <path>` | `-c` | Path to a custom config file. | `./cleaner-config.json` |
| `--scan-all` | | Include `node_modules` and `.git` in scan. | `false` |
| `--verbose` | | Enable verbose logging for debugging. | `false` |
| `--help` | `-h` | Display help information. | |

## License

ISC
