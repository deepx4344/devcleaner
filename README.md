# DevCleaner 🧹

> A powerful, type-safe CLI tool to keep your development environment clean by removing temporary files, logs, caches, and empty directories.

**DevCleaner** helps you reclaim disk space and maintain a tidy codebase by intelligently scanning and deleting unwanted artifacts. Migrated to **TypeScript**, it provides robust safety guards, a dry-run mode, and flexible configuration options.

## 🚀 Key Features

*   **🛡️ Safety First**: Defaults to **Dry-Run** mode. You must explicitly use `--force` to delete.
*   **🏗️ TypeScript Powered**: Fully typed logic for better reliability and performance.
*   **⚙️ Configurable**: Define custom patterns for files and folders via `cleaner-config.json`.
*   **🧠 Smart Exclusions**: Automatically protects critical directories like `node_modules`, `.git`, and `dist`.
*   **⚡ ESM Native**: Built using modern Node.js ECMAScript Modules.
*   **💬 Interactive Confirmation**: Prompts you before deletion (unless `-y` is used).

## 📦 Installation

```bash
# Run directly without installation
npx devcleaner
# or
pnpm dlx devcleaner
# or
bunx devcleaner

# Or install globally
npm install -g devcleaner
yarn global add devcleaner
pnpm add -g devcleaner
bun add -g devcleaner
```

## 🛠 Usage

### Basic Usage (Dry Run)
By default, `DevCleaner` lists what *would* be deleted. It will **not** touch your files yet.

```bash
clean
# or if running from source
npm start
# or
yarn start
# or
pnpm start
# or
bun start
```

### Deleting Files
To perform an actual cleanup, use the `--force` flag.

**Interactive Mode (Requires confirmation):**
```bash
clean --force
```

**Silent Mode (No prompts):**
```bash
clean --force --yes
```

### Advanced Options

| Option | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| `--dry-run` | | List candidates without deleting (default). | `true` |
| `--force` | `-f` | Enables actual deletion. | `false` |
| `--yes` | `-y` | Skips confirmation prompts. | `false` |
| `--dirs <list>` | | Comma-separated paths to scan (e.g., `src,test`). | `.` |
| `--config <path>`| `-c` | Path to custom `cleaner-config.json`. | `./cleaner-config.json` |
| `--scan-all` | | Include `node_modules` and `.git` in scan. | `false` |
| `--verbose` | | Enable detailed log output. | `false` |

---

## 🔧 Configuration

Create a `cleaner-config.json` in your project root to customize scanning behavior.

### Configuration Schema

| Field | Description |
| :--- | :--- |
| `directoriesToScan` | Array of entry points for the scan (e.g., `["src"]`). |
| `filePatternToDelete` | Glob patterns for files to remove (e.g., `["**/*.log"]`). |
| `folderToDeleteByName`| Recursive folder names to clean (e.g., `["logs"]`). |
| `fileExclusions` | Specific files to **always** protect. |
| `folderExclusions` | Specific directories to **always** skip. |

### Example `cleaner-config.json`
```json
{
  "directoriesToScan": ["."],
  "filePatternToDelete": ["**/*.tmp", "**/*.log", "**/*lock.json"],
  "folderToDeleteByName": ["temp", "logs"],
  "fileExclusions": ["package.json", "tsconfig.json"],
  "folderExclusions": ["node_modules", ".git", "dist"]
}
```

## 🛠 Development

DevCleaner is built with TypeScript and Jest.

```bash
# Install dependencies
npm install   # or yarn, pnpm install, bun install

# Build the project
npm run build # or yarn build, pnpm build, bun run build

# Run tests (Experimental ESM mode)
npm test      # or yarn test, pnpm test, bun test
```

## 📄 License

MIT License.
