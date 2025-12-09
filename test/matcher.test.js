import path from 'path';
import picomatch from 'picomatch';
import { describe, it, expect } from '@jest/globals';

// Helper to normalize and create matchers (mirrors index.js logic)
function createMatchers(patterns) {
  const patternGlobs = (Array.isArray(patterns) ? patterns : []).map((p) => {
    if (p.includes("*") || p.includes("?")) return p;
    if (p.startsWith(".")) {
      return `**/*${p}`;
    }
    return `**/${p}`;
  });
  return patternGlobs.map((g) => picomatch(g, { dot: true }));
}

// Helper to test if a file matches any matcher
function fileMatches(filePath, matchers) {
  const rel = path.relative(process.cwd(), filePath);
  const base = path.basename(filePath);
  return matchers.some((m) => m(rel) || m(base) || m(filePath));
}

describe('Pattern Matching', () => {
  it('should match .log files', () => {
    const matchers = createMatchers(['.log']);
    expect(fileMatches('debug.log', matchers)).toBe(true);
    expect(fileMatches('app.log', matchers)).toBe(true);
    expect(fileMatches('path/to/file.log', matchers)).toBe(true);
  });

  it('should match .tmp files', () => {
    const matchers = createMatchers(['.tmp']);
    expect(fileMatches('cache.tmp', matchers)).toBe(true);
    expect(fileMatches('temp.tmp', matchers)).toBe(true);
  });

  it('should match .map files', () => {
    const matchers = createMatchers(['.map']);
    expect(fileMatches('app.js.map', matchers)).toBe(true);
    expect(fileMatches('bundle.map', matchers)).toBe(true);
  });

  it('should match .test.js files', () => {
    const matchers = createMatchers(['.test.js']);
    expect(fileMatches('helper.test.js', matchers)).toBe(true);
    expect(fileMatches('app.test.js', matchers)).toBe(true);
  });

  it('should match .spec.js files', () => {
    const matchers = createMatchers(['.spec.js']);
    expect(fileMatches('component.spec.js', matchers)).toBe(true);
    expect(fileMatches('app.spec.js', matchers)).toBe(true);
  });

  it('should match lock.json files', () => {
    const matchers = createMatchers(['lock.json']);
    expect(fileMatches('lock.json', matchers)).toBe(true);
    // Note: 'package-lock.json' is NOT matched by 'lock.json' pattern
    // It would need '.lock.json' pattern to match as suffix
    expect(fileMatches('package-lock.json', matchers)).toBe(false);
  });

  it('should NOT match excluded files', () => {
    const matchers = createMatchers(['.js']);
    const isExcluded = (file) => ['index.js', 'main.js'].includes(path.basename(file));
    
    expect(fileMatches('app.js', matchers) && !isExcluded('app.js')).toBe(true);
    expect(fileMatches('index.js', matchers) && !isExcluded('index.js')).toBe(false);
    expect(fileMatches('main.js', matchers) && !isExcluded('main.js')).toBe(false);
  });

  it('should NOT match .ts files when not in config', () => {
    const matchers = createMatchers(['.test.js', '.log', '.map']);
    expect(fileMatches('types.ts', matchers)).toBe(false);
    expect(fileMatches('app.ts', matchers)).toBe(false);
  });

  it('should NOT match .md files when not in config', () => {
    const matchers = createMatchers(['.test.js', '.log', '.map']);
    expect(fileMatches('README.md', matchers)).toBe(false);
  });

  it('should handle multiple patterns', () => {
    const matchers = createMatchers(['.log', '.tmp', '.map', '.test.js', 'lock.json']);
    expect(fileMatches('app.log', matchers)).toBe(true);
    expect(fileMatches('cache.tmp', matchers)).toBe(true);
    expect(fileMatches('app.js.map', matchers)).toBe(true);
    expect(fileMatches('test.test.js', matchers)).toBe(true);
    expect(fileMatches('lock.json', matchers)).toBe(true);
    expect(fileMatches('main.js', matchers)).toBe(false);
  });

  it('should handle dot files in patterns', () => {
    const matchers = createMatchers(['.temp', '.logs']);
    expect(fileMatches('.temp', matchers)).toBe(true);
    expect(fileMatches('.logs', matchers)).toBe(true);
    expect(fileMatches('file.temp', matchers)).toBe(true);
    expect(fileMatches('file.logs', matchers)).toBe(true);
  });

  it('should handle glob patterns with wildcards', () => {
    const matchers = createMatchers(['**/*.test.js', '**/*.spec.js']);
    expect(fileMatches('test/app.test.js', matchers)).toBe(true);
    expect(fileMatches('src/utils/helper.spec.js', matchers)).toBe(true);
  });
});

describe('Configuration Edge Cases', () => {
  it('should handle empty pattern list', () => {
    const matchers = createMatchers([]);
    expect(fileMatches('anything.js', matchers)).toBe(false);
  });

  it('should handle null or undefined patterns gracefully', () => {
    const matchers = createMatchers(null);
    expect(fileMatches('app.js', matchers)).toBe(false);

    const matchers2 = createMatchers(undefined);
    expect(fileMatches('app.js', matchers2)).toBe(false);
  });

  it('should distinguish between suffix and filename patterns', () => {
    // .lock should match as suffix (any file ending in .lock)
    const matchers1 = createMatchers(['.lock']);
    expect(fileMatches('package.lock', matchers1)).toBe(true);
    expect(fileMatches('yarn.lock', matchers1)).toBe(true);

    // lock.json should match exact filename (only 'lock.json', not 'package-lock.json')
    const matchers2 = createMatchers(['lock.json']);
    expect(fileMatches('lock.json', matchers2)).toBe(true);
    expect(fileMatches('package-lock.json', matchers2)).toBe(false);
    
    // To match files with 'lock' and 'json' pattern, use **/*lock.json glob
    const matchers3 = createMatchers(['**/*lock.json']);
    expect(fileMatches('package-lock.json', matchers3)).toBe(true);
    expect(fileMatches('lock.json', matchers3)).toBe(true);
  });
});
