import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import ts from 'typescript';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const temporaryRoots: string[] = [];
const workspacePaths = JSON.parse(readFileSync(join(repositoryRoot, 'tsconfig.json'), 'utf8'))
  .references as { path: string }[];
const typeOnlyPackages = new Set(['contracts', 'star-data', 'catalogue-schema']);

function write(root: string, path: string, content: string) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ufuq-tooling-'));
  temporaryRoots.push(root);
  write(root, 'package.json', readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  for (const { path } of workspacePaths) {
    write(
      root,
      `${path}/package.json`,
      readFileSync(join(repositoryRoot, path, 'package.json'), 'utf8'),
    );
    write(
      root,
      `${path}/src/index.ts`,
      typeOnlyPackages.has(basename(path)) ? 'export type Empty = never;\n' : 'export {};\n',
    );
  }
  for (const path of ['data/sources', 'data/curation', 'data/generated']) {
    write(root, `${path}/README.md`, 'Synthetic tooling fixture.\n');
  }
  return root;
}

function run(script: string, root: string, extra: string[] = []) {
  return spawnSync(process.execPath, [join(repositoryRoot, script), root, ...extra], {
    encoding: 'utf8',
    cwd: root,
    timeout: 25_000,
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
}

function boundaries(root: string) {
  return run('scripts/check-boundaries.mjs', root);
}

function changeDependencies(root: string, workspace: string, dependencies: Record<string, string>) {
  const file = `${workspace}/package.json`;
  const manifest = JSON.parse(readFileSync(join(root, file), 'utf8'));
  manifest.dependencies = dependencies;
  write(root, file, JSON.stringify(manifest));
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    // Only remove the exact temporary repositories created by this test process.
    if (
      resolve(dirname(root)) !== resolve(tmpdir()) ||
      !basename(root).startsWith('ufuq-tooling-')
    ) {
      throw new Error(`Refusing to clean unexpected test path: ${root}`);
    }
    rmSync(root, { recursive: true, force: true });
  }
});

describe('scaffold data guard', () => {
  it('accepts the known empty curation folders without admitting records', () => {
    const root = fixture();
    for (const directory of ['patterns', 'relationships', 'routes']) {
      mkdirSync(join(root, 'data/curation', directory));
    }
    const result = run('scripts/verify-data-scaffold.mjs', root);
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    'sources',
    'generated',
    'curation',
    'curation/patterns',
    'curation/relationships',
    'curation/routes',
  ])('rejects unvalidated data in data/%s', (directory) => {
    const root = fixture();
    write(root, `data/${directory}/unapproved.json`, '{}');
    const result = run('scripts/verify-data-scaffold.mjs', root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('non-scaffold');
  });

  it('rejects unexpected folders even when empty', () => {
    const root = fixture();
    mkdirSync(join(root, 'data/curation/unexpected'));
    expect(run('scripts/verify-data-scaffold.mjs', root).status).toBe(1);
  });
});

describe('production and test configuration', () => {
  it('allows contract test imports while preserving the implementation import ban', async () => {
    const eslint = new ESLint({ cwd: repositoryRoot });
    const source =
      "import { it, expect } from 'vitest';\nit('probe', () => expect(true).toBe(true));\n";
    const test = await eslint.lintText(source, {
      filePath: join(repositoryRoot, 'packages/contracts/src/index.test.ts'),
    });
    expect(test.flatMap((result) => result.messages)).toEqual([]);
    const implementation = await eslint.lintText(source, {
      filePath: join(repositoryRoot, 'packages/contracts/src/index.ts'),
    });
    expect(
      implementation.flatMap((result) => result.messages.map((message) => message.ruleId)),
    ).toContain('no-restricted-imports');
  });

  it('keeps colocated tests out of production compilation and in the test compiler', () => {
    const root = fixture();
    for (const file of ['tsconfig.base.json', 'tsconfig.tests.json']) {
      write(root, file, readFileSync(join(repositoryRoot, file), 'utf8'));
    }
    const testFiles: string[] = [];
    for (const { path } of workspacePaths) {
      write(
        root,
        `${path}/tsconfig.json`,
        readFileSync(join(repositoryRoot, path, 'tsconfig.json'), 'utf8'),
      );
      for (const extension of ['ts', 'tsx']) {
        const testFile = `${path}/src/probe-${extension}.test.${extension}`;
        write(root, testFile, 'export {};\n');
        testFiles.push(resolve(root, testFile));
      }
      const configPath = join(root, path, 'tsconfig.json');
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
      expect(parsed.errors).toEqual([]);
      expect(
        parsed.fileNames.some((file) => /\.test\.tsx?$/.test(file)),
        path,
      ).toBe(false);
      expect(
        parsed.fileNames.some((file) => file.endsWith('/src/index.ts')),
        path,
      ).toBe(true);
    }
    const configPath = join(root, 'tsconfig.tests.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    expect(parsed.errors).toEqual([]);
    const discovered = new Set(parsed.fileNames.map((file) => resolve(file)));
    for (const file of testFiles) expect(discovered.has(file), file).toBe(true);
  });
});

describe('workspace source boundaries', () => {
  it('accepts declared public imports, type re-exports and literal dynamic imports', () => {
    const root = fixture();
    write(
      root,
      'packages/assessment-core/src/index.ts',
      "import type { Empty } from '@ufuq/astronomy-core';\nexport type Result = Empty;\nexport const load = () => import('@ufuq/astronomy-core');\n",
    );
    write(
      root,
      'packages/catalogue-schema/src/index.ts',
      "export { type Empty } from '@ufuq/star-data';\n",
    );
    const result = boundaries(root);
    expect(result.status, result.stderr).toBe(0);
  });

  it('rejects an otherwise allowed import missing from the workspace manifest', () => {
    const root = fixture();
    changeDependencies(root, 'packages/assessment-core', {});
    write(root, 'packages/assessment-core/src/index.ts', "import '@ufuq/astronomy-core';\n");
    const result = boundaries(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Undeclared dependency @ufuq/astronomy-core');
  });

  it('rejects relative imports that bypass workspace entry points', () => {
    const root = fixture();
    write(
      root,
      'apps/web/src/index.ts',
      "import '../../../packages/assessment-core/src/index.js';\n",
    );
    const result = boundaries(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Cross-workspace relative import');
  });

  it('rejects a deep import that the target does not export', () => {
    const root = fixture();
    write(
      root,
      'packages/assessment-core/src/index.ts',
      "export * from '@ufuq/astronomy-core/src/index.js';\n",
    );
    const result = boundaries(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Non-public workspace entry');
  });

  it('accepts an explicitly exported subpath', () => {
    const root = fixture();
    const file = 'packages/astronomy-core/package.json';
    const manifest = JSON.parse(readFileSync(join(root, file), 'utf8'));
    manifest.exports['./safe/*'] = './dist/*.js';
    write(root, file, JSON.stringify(manifest));
    write(
      root,
      'packages/assessment-core/src/index.ts',
      "export * from '@ufuq/astronomy-core/safe/vector';\n",
    );
    const result = boundaries(root);
    expect(result.status, result.stderr).toBe(0);
  });

  it('rejects an explicitly private subpath even when a broader export matches', () => {
    const root = fixture();
    const file = 'packages/astronomy-core/package.json';
    const manifest = JSON.parse(readFileSync(join(root, file), 'utf8'));
    manifest.exports['./safe/*'] = './dist/*.js';
    manifest.exports['./safe/private'] = null;
    write(root, file, JSON.stringify(manifest));
    write(
      root,
      'packages/assessment-core/src/index.ts',
      "export * from '@ufuq/astronomy-core/safe/private';\n",
    );
    const result = boundaries(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Non-public workspace entry');
  });

  it.each([{}, { './public': './dist/public.js' }])(
    'rejects a package root omitted from its export map: %j',
    (exports) => {
      const root = fixture();
      const file = 'packages/astronomy-core/package.json';
      const manifest = JSON.parse(readFileSync(join(root, file), 'utf8'));
      manifest.exports = exports;
      write(root, file, JSON.stringify(manifest));
      write(root, 'packages/assessment-core/src/index.ts', "import '@ufuq/astronomy-core';\n");
      const result = boundaries(root);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Non-public workspace entry');
    },
  );

  it.each([
    { './*': './dist/*.js', './internal/*': null },
    { './internal/*': null, './*': './dist/*.js' },
    { './internal/*': './dist/*.js', './internal/*.private': null },
  ])('respects private wildcard precedence independent of key order: %j', (exports) => {
    const root = fixture();
    const file = 'packages/astronomy-core/package.json';
    const manifest = JSON.parse(readFileSync(join(root, file), 'utf8'));
    manifest.exports = exports;
    write(root, file, JSON.stringify(manifest));
    write(
      root,
      'packages/assessment-core/src/index.ts',
      "import '@ufuq/astronomy-core/internal/secret.private';\n",
    );
    const result = boundaries(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Non-public workspace entry');
  });

  it('accepts a more specific public wildcard within a private subtree', () => {
    const root = fixture();
    const file = 'packages/astronomy-core/package.json';
    const manifest = JSON.parse(readFileSync(join(root, file), 'utf8'));
    manifest.exports = { './internal/*': null, './internal/public/*': './dist/*.js' };
    write(root, file, JSON.stringify(manifest));
    write(
      root,
      'packages/assessment-core/src/index.ts',
      "import '@ufuq/astronomy-core/internal/public/vector';\n",
    );
    const result = boundaries(root);
    expect(result.status, result.stderr).toBe(0);
  });

  it('does not mistake comments or strings for real imports', () => {
    const root = fixture();
    write(
      root,
      'packages/astronomy-core/src/index.ts',
      `// import('react') is an example, not an import.\nexport const message = "from 'three'";\n`,
    );
    const result = boundaries(root);
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    "import 'node:fs';",
    "export { readFileSync } from 'fs';",
    "export const load = () => import('node:fs');",
    "import fs = require('node:fs');",
    "export type Fs = typeof import('node:fs');",
  ])('rejects Node I/O through each module syntax: %s', (source) => {
    const root = fixture();
    write(root, 'packages/astronomy-core/src/index.ts', source);
    const result = boundaries(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('may not import Node module');
  });

  it('rejects non-literal module loads rather than silently missing an edge', () => {
    const root = fixture();
    write(root, 'apps/web/src/index.ts', 'export const load = (name: string) => import(name);');
    const result = boundaries(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Non-literal module load');
  });

  it('rejects a transitive browser dependency on authoritative packages', () => {
    const root = fixture();
    changeDependencies(root, 'packages/contracts', { '@ufuq/bkt-core': '0.0.0' });
    const result = boundaries(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Browser dependency graph reaches server-only package @ufuq/bkt-core',
    );
  });

  it('still rejects executable statements in implementation-only type packages', () => {
    const root = fixture();
    write(root, 'packages/contracts/src/index.ts', 'export const value = 1;');
    const result = boundaries(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Runtime statement is forbidden');
  });
});

describe('test suite discovery and isolation', () => {
  it.each([
    ['vitest.config.ts', 'apps/web/discovery.test.tsx', 'UNIT'],
    ['vitest.reference.config.ts', 'tests/reference/discovery.test.ts', 'REFERENCE'],
    ['vitest.integration.config.ts', 'tests/integration/discovery.test.ts', 'INTEGRATION'],
  ])(
    'discovers failures with %s without running another suite',
    (config, path, marker) => {
      const root = fixture();
      write(
        root,
        path,
        `it('discovery probe', () => { throw new Error('UFUQ_${marker}_SENTINEL'); });`,
      );
      write(root, 'tests/e2e/excluded.spec.ts', "throw new Error('UFUQ_WRONG_SUITE_SENTINEL');");
      const result = spawnSync(
        process.execPath,
        [
          join(repositoryRoot, 'node_modules/vitest/vitest.mjs'),
          'run',
          '--root',
          root,
          '--config',
          join(repositoryRoot, config),
          '--globals',
          '--maxWorkers',
          '1',
          '--no-file-parallelism',
          '--passWithNoTests',
        ],
        {
          encoding: 'utf8',
          cwd: repositoryRoot,
          timeout: 25_000,
          windowsHide: true,
          env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
        },
      );
      const output = result.stdout + result.stderr;
      expect(result.status, output).toBe(1);
      expect(output).toContain(`UFUQ_${marker}_SENTINEL`);
      expect(output).not.toContain('UFUQ_WRONG_SUITE_SENTINEL');
    },
    30_000,
  );
});
