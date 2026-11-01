import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// An explicit root lets tooling regressions exercise isolated synthetic repositories.
const repositoryRoot = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'));
const scaffoldDataDirectories = ['data/sources', 'data/curation', 'data/generated'];
const errors = [];
const emptyCurationDirectories = new Set(['patterns', 'relationships', 'routes']);

for (const directory of scaffoldDataDirectories) {
  const entries = readdirSync(join(repositoryRoot, directory), { withFileTypes: true });
  const unexpected = [];
  for (const entry of entries) {
    if (entry.name === 'README.md' && entry.isFile()) continue;
    if (
      directory === 'data/curation' &&
      emptyCurationDirectories.has(entry.name) &&
      entry.isDirectory()
    ) {
      // Only empty organizational folders are permitted, not unvalidated content.
      if (readdirSync(join(repositoryRoot, directory, entry.name)).length === 0) continue;
    }
    unexpected.push(entry.name);
  }
  if (unexpected.length > 0) {
    errors.push(`${directory} contains non-scaffold files: ${unexpected.join(', ')}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    'Data scaffold verified: README placeholders and known empty curation folders only; no data records exist.',
  );
}
