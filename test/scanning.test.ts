import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanDirectories, createShouldSkipDir } from '../src/cleaner.js';
import { AppConfig, CleanerOptions } from '../src/types/index.js';

describe('Scanning & Functional Logic', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'devcleaner-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Directory Exclusions (Safety)', () => {
    it('should skip critical directories even if matched by name', () => {
      const config: AppConfig = {
        directoriesToScan: [],
        filePatternToDelete: [],
        folderToDeleteByName: [],
        fileExclusions: [],
        folderExclusions: ['node_modules', '.git']
      };
      const shouldSkip = createShouldSkipDir(config, false);

      expect(shouldSkip(path.join(tempDir, 'node_modules'))).toBe(true);
      expect(shouldSkip(path.join(tempDir, '.git'))).toBe(true);
      expect(shouldSkip(path.join(tempDir, 'src'))).toBe(false);
    });
  });

  describe('AbortSignal Support', () => {
    it('should stop scanning immediately when signal is aborted', async () => {
      // Create a bunch of directories
      for (let i = 0; i < 50; i++) {
        await fs.mkdir(path.join(tempDir, `dir-${i}`));
      }

      const controller = new AbortController();
      const options = {
        configPath: 'test.json',
        scanAll: false,
        verbose: false,
        force: false,
        signal: controller.signal
      };

      const config: AppConfig = {
        directoriesToScan: [tempDir],
        filePatternToDelete: [],
        folderToDeleteByName: [],
        fileExclusions: [],
        folderExclusions: []
      };

      // Abort halfway through (simulated by a very fast abortion)
      controller.abort();

      const { filesToDelete } = await scanDirectories(config, options);

      // Should be empty or very few if aborted immediately
      expect(filesToDelete.length).toBe(0);
    });
  });

  describe('Functional Scanning', () => {
    it('should find empty directories in a nested structure', async () => {
      const nested = path.join(tempDir, 'a', 'b', 'c');
      await fs.mkdir(nested, { recursive: true });

      const config: AppConfig = {
        directoriesToScan: [tempDir],
        filePatternToDelete: [],
        folderToDeleteByName: [],
        fileExclusions: [],
        folderExclusions: []
      };
      const options: CleanerOptions = { configPath: 'test.json', scanAll: false, verbose: false, force: false };

      const { filesToDelete } = await scanDirectories(config, options);

      // It should catch the bottom-most empty dir 'c'
      expect(filesToDelete.some(f => f.path.endsWith('c'))).toBe(true);
    });

    it('should respect file exclusions', async () => {
      const logFile = path.join(tempDir, 'test.log');
      await fs.writeFile(logFile, 'content');

      const config: AppConfig = {
        directoriesToScan: [tempDir],
        filePatternToDelete: ['**/*.log'],
        folderToDeleteByName: [],
        fileExclusions: ['test.log'],
        folderExclusions: []
      };
      const options: CleanerOptions = { configPath: 'test.json', scanAll: false, verbose: false, force: false };

      const { filesToDelete } = await scanDirectories(config, options);
      expect(filesToDelete.length).toBe(0);
    });
  });
});
