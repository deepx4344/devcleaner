import * as path from 'node:path';
import { describe, it, expect } from '@jest/globals';
import { createMatchers } from '../src/cleaner.js';
import { AppConfig } from '../src/types/index.js';

describe('Strict Pattern Matching (Safety & Precision)', () => {
  const defaultConfig: AppConfig = {
    directoriesToScan: [],
    filePatternToDelete: [
      "**/*.temp", "**/*.tmp", "**/*.log", "**/*.logs", "**/*.lock", "**/*.locks",
      "**/npm-debug.log*", "**/yarn-debug.log*", "**/yarn-error.log*", "**/*lock.json",
      "**/*.test.ts", "**/*.test.js", "**/*.spec.js", "**/*.cy.js", "**/*.map"
    ],
    folderToDeleteByName: [],
    fileExclusions: ['package-lock.json'],
    folderExclusions: []
  };

  const matchers = createMatchers(defaultConfig);

  const fileMatches = (filePath: string) => {
    const base = path.basename(filePath);
    // Mimic the logic in cleaner.ts search: check exclusions first
    const excluded = (defaultConfig.fileExclusions || []).includes(base);
    if (excluded) return false;

    return matchers.some((m) => m(filePath) || m(base));
  };

  describe('Safety Guarantees', () => {
    it('MUST NEVER match critical project files', () => {
      const sensitiveFiles = [
        'package.json',
        'package-lock.json',
        'tsconfig.json',
        'README.md',
        'src/cli.ts',
        'src/cleaner.ts',
        'config/cleaner-config.json',
        '.gitignore',
        'LICENSE'
      ];

      sensitiveFiles.forEach(file => {
        expect(fileMatches(file)).toBe(false);
      });
    });

    it('should not match common source or asset files', () => {
      const sourceFiles = [
        'src/utils/reader.ts',
        'public/logo.png',
        'index.html',
        'styles.css'
      ];

      sourceFiles.forEach(file => {
        expect(fileMatches(file)).toBe(false);
      });
    });
  });

  describe('Precision Deletions', () => {
    it('should correctly match temp and log files', () => {
      const tempFiles = [
        'debug.log',
        'temp/cache.tmp',
        'npm-debug.log.12345',
        'app.js.map',
        'some.test.js'
      ];

      tempFiles.forEach(file => {
        expect(fileMatches(file)).toBe(true);
      });
    });

    it('should match lock files but not package-lock.json', () => {
      expect(fileMatches('yarn.lock')).toBe(true);
      expect(fileMatches('package.lock')).toBe(true);
      expect(fileMatches('package-lock.json')).toBe(false); // Specifically excluded by logic
    });
  });
});
