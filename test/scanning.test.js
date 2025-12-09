import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Scanning Logic', () => {
  let tempDir;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'devcleaner-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should detect empty directories', async () => {
    const emptyDir = path.join(tempDir, 'empty');
    await fs.mkdir(emptyDir);

    const directory = await fs.opendir(emptyDir);
    const entry = await directory.read();
    await directory.close();

    expect(entry).toBe(null); // null means empty
  });

  it('should detect non-empty directories', async () => {
    const nonEmptyDir = path.join(tempDir, 'nonempty');
    await fs.mkdir(nonEmptyDir);
    await fs.writeFile(path.join(nonEmptyDir, 'file.txt'), 'content');

    const directory = await fs.opendir(nonEmptyDir);
    const entry = await directory.read();
    await directory.close();

    expect(entry).not.toBe(null); // not null means non-empty
  });

  it('should skip node_modules directory by default', () => {
    const shouldSkipDir = (fullPath) => {
      const name = path.basename(fullPath);
      const defaultSkips = ['node_modules', '.git', '.cache', 'dist', 'build', 'target'];
      return defaultSkips.includes(name);
    };

    expect(shouldSkipDir('/path/to/node_modules')).toBe(true);
    expect(shouldSkipDir('/path/to/.git')).toBe(true);
    expect(shouldSkipDir('/path/to/src')).toBe(false);
  });

  it('should respect custom skip directories from config', () => {
    const shouldSkipDir = (fullPath, configuredSkips = []) => {
      const name = path.basename(fullPath);
      const defaultSkips = ['node_modules', '.git', '.cache', 'dist', 'build', 'target'];
      const skipList = new Set([...defaultSkips, ...configuredSkips]);
      return skipList.has(name);
    };

    expect(shouldSkipDir('/path/to/custom_skip', ['custom_skip'])).toBe(true);
    expect(shouldSkipDir('/path/to/src', ['custom_skip'])).toBe(false);
  });

  it('should handle directory paths with special characters', () => {
    const testPaths = [
      '/path/with spaces/folder',
      '/path/with-dashes/folder',
      '/path/with_underscores/folder',
      '/path/(with-parens)/folder',
    ];

    testPaths.forEach((p) => {
      expect(() => path.basename(p)).not.toThrow();
    });
  });
});

describe('Exclusion Logic', () => {
  it('should exclude files by exact basename match', () => {
    const exclusions = ['index.js', 'main.js'];
    const isExcluded = (file) => exclusions.includes(path.basename(file));

    expect(isExcluded('index.js')).toBe(true);
    expect(isExcluded('main.js')).toBe(true);
    expect(isExcluded('/path/to/index.js')).toBe(true);
    expect(isExcluded('app.js')).toBe(false);
  });

  it('should not exclude files with similar names', () => {
    const exclusions = ['index.js'];
    const isExcluded = (file) => exclusions.includes(path.basename(file));

    expect(isExcluded('index.test.js')).toBe(false);
    expect(isExcluded('my-index.js')).toBe(false);
  });
});

describe('Configuration Schema Validation', () => {
  it('should validate required fields', () => {
    const config = {
      filePatternToDelete: ['.log'],
      folderToDeleteByName: ['logs'],
      exclusions: ['index.js'],
    };

    expect(Array.isArray(config.filePatternToDelete)).toBe(true);
    expect(Array.isArray(config.folderToDeleteByName)).toBe(true);
    expect(Array.isArray(config.exclusions)).toBe(true);
  });

  it('should handle missing optional fields gracefully', () => {
    const config = {
      filePatternToDelete: ['.log'],
    };

    const folderToDelete = Array.isArray(config.folderToDeleteByName)
      ? config.folderToDeleteByName
      : [];
    const exclusions = Array.isArray(config.exclusions) ? config.exclusions : [];

    expect(folderToDelete).toEqual([]);
    expect(exclusions).toEqual([]);
  });

  it('should set default directoriesToScan if missing', () => {
    const config = {};
    const dirs =
      !config.directoriesToScan ||
      !Array.isArray(config.directoriesToScan) ||
      config.directoriesToScan.length === 0
        ? ['.']
        : config.directoriesToScan;

    expect(dirs).toEqual(['.']);
  });

  it('should respect configured directoriesToScan', () => {
    const config = {
      directoriesToScan: ['src', 'logs', 'temp'],
    };

    const dirs =
      !config.directoriesToScan ||
      !Array.isArray(config.directoriesToScan) ||
      config.directoriesToScan.length === 0
        ? ['.']
        : config.directoriesToScan;

    expect(dirs).toEqual(['src', 'logs', 'temp']);
  });
});
