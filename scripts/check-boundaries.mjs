import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';

// Keep the default CLI unchanged; tests can supply an isolated repository root.
const repositoryRoot = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'));
const workspaceRoots = ['apps', 'packages', 'tools'];
const packageManifests = [];

for (const root of workspaceRoots) {
  const absoluteRoot = join(repositoryRoot, root);
  for (const entry of readdirSync(absoluteRoot)) {
    const manifestPath = join(absoluteRoot, entry, 'package.json');
    try {
      if (statSync(manifestPath).isFile()) {
        packageManifests.push(manifestPath);
      }
    } catch {
      // A non-workspace directory is ignored deliberately.
    }
  }
}

const packages = new Map();
for (const manifestPath of packageManifests) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (packages.has(manifest.name)) {
    throw new Error(`Duplicate workspace package name: ${manifest.name}`);
  }
  packages.set(manifest.name, { manifest, manifestPath });
}

const allowedInternalDependencies = new Map([
  ['@ufuq/astronomy-core', new Set()],
  ['@ufuq/assessment-core', new Set(['@ufuq/astronomy-core'])],
  ['@ufuq/bkt-core', new Set()],
  ['@ufuq/adaptive-policy', new Set(['@ufuq/bkt-core'])],
  ['@ufuq/contracts', new Set()],
  ['@ufuq/star-data', new Set()],
  ['@ufuq/catalogue-schema', new Set(['@ufuq/star-data'])],
  [
    '@ufuq/tutoring-core',
    new Set(['@ufuq/assessment-core', '@ufuq/bkt-core', '@ufuq/adaptive-policy']),
  ],
  ['@ufuq/astronomy-reference', new Set(['@ufuq/astronomy-core'])],
  ['@ufuq/catalogue-pipeline', new Set(['@ufuq/catalogue-schema', '@ufuq/star-data'])],
  ['@ufuq/catalogue', new Set(['@ufuq/catalogue-pipeline'])],
  ['@ufuq/api', new Set(['@ufuq/contracts'])],
  ['@ufuq/web', new Set(['@ufuq/contracts'])],
]);

const graph = new Map();
const errors = [];
const purePackageNames = new Set([
  '@ufuq/astronomy-core',
  '@ufuq/assessment-core',
  '@ufuq/bkt-core',
  '@ufuq/adaptive-policy',
  '@ufuq/tutoring-core',
  '@ufuq/contracts',
  '@ufuq/star-data',
  '@ufuq/catalogue-schema',
]);
const forbiddenPureDependency =
  /^(?:react|react-dom|three|@react-three\/fiber|express|mysql|mysql2|pg|postgres|sequelize|typeorm|knex|better-sqlite3|sqlite3|@prisma\/client|drizzle-orm)$/;

function packageName(specifier) {
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];
}

for (const [name, { manifest, manifestPath }] of packages) {
  const dependencies = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
    ...(manifest.peerDependencies ?? {}),
  };
  const internalDependencies = Object.keys(dependencies).filter((dependency) =>
    packages.has(dependency),
  );
  for (const dependency of Object.keys(dependencies)) {
    if (dependency.startsWith('@ufuq/') && !packages.has(dependency)) {
      errors.push(`Unknown workspace dependency ${dependency} declared by ${name}.`);
    }
  }
  graph.set(name, internalDependencies);

  const allowed = allowedInternalDependencies.get(name);
  if (!allowed) {
    errors.push(`No boundary policy is defined for ${name}.`);
    continue;
  }
  for (const dependency of internalDependencies) {
    if (!allowed.has(dependency)) {
      errors.push(
        `${name} may not depend on ${dependency} (${relative(repositoryRoot, manifestPath)}).`,
      );
    }
  }

  if (purePackageNames.has(name)) {
    for (const dependency of Object.keys(dependencies)) {
      if (forbiddenPureDependency.test(packageName(dependency))) {
        errors.push(
          `${name} may not declare framework or persistence dependency ${dependency} (${relative(repositoryRoot, manifestPath)}).`,
        );
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
const path = [];

function visit(name) {
  if (visiting.has(name)) {
    const cycleStart = path.indexOf(name);
    errors.push(`Workspace dependency cycle: ${[...path.slice(cycleStart), name].join(' -> ')}`);
    return;
  }
  if (visited.has(name)) return;
  visiting.add(name);
  path.push(name);
  for (const dependency of graph.get(name) ?? []) visit(dependency);
  path.pop();
  visiting.delete(name);
  visited.add(name);
}

for (const name of graph.keys()) visit(name);

function sourceFiles(directory) {
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name)) results.push(path);
  }
  return results;
}

const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const rootManifest = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
const rootTestDependencies = rootManifest.devDependencies ?? {};
const isTestFile = (file) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);

function publicEntry(manifest, specifier) {
  if (specifier === manifest.name) {
    if (manifest.exports === null) return false;
    if (typeof manifest.exports !== 'object' || Array.isArray(manifest.exports)) return true;
    if (Object.hasOwn(manifest.exports, '.')) return manifest.exports['.'] !== null;
    // A conditional root export has condition keys; a subpath map must expose '.'.
    const keys = Object.keys(manifest.exports);
    return keys.length > 0 && keys.every((entry) => !entry.startsWith('.'));
  }
  const subpath = `.${specifier.slice(manifest.name.length)}`;
  if (!manifest.exports || typeof manifest.exports !== 'object') return false;
  if (Object.hasOwn(manifest.exports, subpath)) return manifest.exports[subpath] !== null;
  // Node selects the most specific matching pattern before resolving its target.
  // A private (null) pattern must therefore beat a broader public pattern.
  const matches = Object.entries(manifest.exports)
    .filter(([entry]) => {
      const star = entry.indexOf('*');
      return (
        star >= 0 &&
        entry.lastIndexOf('*') === star &&
        subpath.startsWith(entry.slice(0, star)) &&
        subpath.endsWith(entry.slice(star + 1)) &&
        subpath.length >= entry.length
      );
    })
    .sort(
      ([left], [right]) => right.indexOf('*') - left.indexOf('*') || right.length - left.length,
    );
  return matches.length > 0 && matches[0][1] !== null;
}

function importSpecifiers(syntaxTree) {
  const imports = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      imports.push(node.moduleReference.expression.text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      imports.push(node.argument.literal.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) imports.push(argument.text);
      else
        errors.push(
          `Non-literal module load cannot be boundary-checked in ${relative(repositoryRoot, syntaxTree.fileName)}.`,
        );
    }
    ts.forEachChild(node, visit);
  }
  visit(syntaxTree);
  return imports;
}

// Check actual source edges, including re-exports and literal dynamic imports.
// Manifest-only checks miss undeclared hoisted imports and relative source bypasses.
for (const [name, { manifest, manifestPath }] of packages) {
  const workspaceDirectory = resolve(manifestPath, '..');
  const dependencies = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
    ...(manifest.peerDependencies ?? {}),
  };
  for (const file of sourceFiles(join(workspaceDirectory, 'src'))) {
    const tree = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const specifier of importSpecifiers(tree)) {
      const location = relative(repositoryRoot, file);
      if (specifier.startsWith('.')) {
        const destination = relative(workspaceDirectory, resolve(file, '..', specifier));
        if (
          destination === '..' ||
          destination.startsWith('../') ||
          destination.startsWith('..\\')
        ) {
          errors.push(
            `Cross-workspace relative import ${specifier} in ${location}; use a public package entry.`,
          );
        }
        continue;
      }
      const dependency = packageName(specifier);
      if (specifier.startsWith('node:') || builtins.has(specifier)) {
        if (purePackageNames.has(name) && !isTestFile(file)) {
          errors.push(
            `Pure package ${name} may not import Node module ${specifier} (${location}).`,
          );
        }
        continue;
      }
      if (purePackageNames.has(name) && forbiddenPureDependency.test(dependency)) {
        errors.push(`Forbidden framework/persistence import ${specifier} in ${location}.`);
      }
      if (
        dependency !== name &&
        !Object.hasOwn(dependencies, dependency) &&
        !(isTestFile(file) && Object.hasOwn(rootTestDependencies, dependency))
      ) {
        errors.push(`Undeclared dependency ${dependency} imported in ${location}.`);
      }
      if (dependency.startsWith('@ufuq/')) {
        const target = packages.get(dependency);
        if (!target) errors.push(`Unknown workspace ${dependency} imported in ${location}.`);
        else {
          if (dependency !== name && !allowedInternalDependencies.get(name)?.has(dependency)) {
            errors.push(`Forbidden workspace import ${specifier} in ${location}.`);
          }
          if (!publicEntry(target.manifest, specifier)) {
            errors.push(`Non-public workspace entry ${specifier} imported in ${location}.`);
          }
        }
      }
    }
  }
}

const serverOnlyPackages = new Set([
  '@ufuq/api',
  '@ufuq/assessment-core',
  '@ufuq/bkt-core',
  '@ufuq/adaptive-policy',
  '@ufuq/tutoring-core',
]);
function checkBrowserDependencies(name, seen = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);
  if (serverOnlyPackages.has(name)) {
    errors.push(`Browser dependency graph reaches server-only package ${name}.`);
  }
  for (const dependency of graph.get(name) ?? []) checkBrowserDependencies(dependency, seen);
}
checkBrowserDependencies('@ufuq/web');

for (const typeOnlyPackage of ['contracts', 'star-data', 'catalogue-schema']) {
  const src = join(repositoryRoot, 'packages', typeOnlyPackage, 'src');
  for (const sourceFile of sourceFiles(src)) {
    if (isTestFile(sourceFile)) continue;
    const source = readFileSync(sourceFile, 'utf8');
    const syntaxTree = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true);
    for (const statement of syntaxTree.statements) {
      const isTypeOnlyDeclaration =
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        (ts.isImportDeclaration(statement) &&
          (statement.importClause?.isTypeOnly === true ||
            (!statement.importClause?.name &&
              statement.importClause?.namedBindings &&
              ts.isNamedImports(statement.importClause.namedBindings) &&
              statement.importClause.namedBindings.elements.length > 0 &&
              statement.importClause.namedBindings.elements.every((entry) => entry.isTypeOnly)))) ||
        (ts.isExportDeclaration(statement) &&
          (statement.isTypeOnly ||
            (statement.exportClause &&
              ts.isNamedExports(statement.exportClause) &&
              statement.exportClause.elements.length > 0 &&
              statement.exportClause.elements.every((entry) => entry.isTypeOnly))));
      if (!isTypeOnlyDeclaration) {
        errors.push(
          `Runtime statement is forbidden in type-only package: ${relative(repositoryRoot, sourceFile)}.`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Boundary check passed for ${packages.size} workspaces; dependency graph is acyclic.`,
  );
}
