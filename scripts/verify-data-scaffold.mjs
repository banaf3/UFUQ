import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const scaffoldDirectories = new Map([
  [
    'data/manifests',
    new Set([
      'README.md',
      'gaia-dr3-hip-screen-v1',
      'hipparcos-esa-1997-hip-screen-v1',
      'iers-leap-eop-v1',
      'observer-umpsa-pekan-v1',
    ]),
  ],
  ['data/manifests/iers-leap-eop-v1', new Set(['README.md', 'acquisition-manifest.v1.json'])],
  [
    'data/manifests/observer-umpsa-pekan-v1',
    new Set(['README.md', 'acquisition-manifest.v1.json']),
  ],
  [
    'data/manifests/hipparcos-esa-1997-hip-screen-v1',
    new Set([
      'README.md',
      'acquisition-manifest.v1.json',
      'hip-main-source.v1.adql',
      'tap-schema.v1.adql',
    ]),
  ],
  [
    'data/manifests/gaia-dr3-hip-screen-v1',
    new Set([
      'README.md',
      'acquisition-manifest.v1.json',
      'best-neighbour-source.v1.adql',
      'neighbourhood.v1.adql',
      'tap-schema.v1.adql',
    ]),
  ],
  ['data/curation/patterns', new Set(['README.md', 'patterns.v1.json'])],
  ['data/curation/relationships', new Set(['README.md', 'relationships.v1.json'])],
  ['data/curation/routes', new Set(['README.md', 'routes.v1.json'])],
  ['data/curation/scenarios', new Set(['scenarios.v1.json'])],
  ['data/curation/stars', new Set(['route-star-crosswalk.v1.json'])],
  ['data/curation/tutoring', new Set(['learning-configuration.v1.json'])],
  [
    'data/generated',
    new Set([
      'README.md',
      'MANIFEST.v1.json',
      'route-stars-hipparcos1997-v1.json',
      'leap-seconds-iers-v1.json',
      'observer-umpsa-pekan-v1.json',
      'time-domain-profile-v1.json',
      'lesson-content-v1.json',
      'learning-configuration-v1.json',
      'synthetic',
      // Ignored local-only output (Bulletin B values; redistribution unconfirmed).
      'local-only',
    ]),
  ],
  [
    'data/generated/synthetic',
    new Set([
      'synthetic-stars-v1.json',
      'synthetic-leap-seconds-v1.json',
      'synthetic-eop-v1.json',
      'synthetic-observer-v1.json',
      'synthetic-time-domain-v1.json',
      'synthetic-lesson-content-v1.json',
      'synthetic-learning-configuration-v1.json',
    ]),
  ],
]);
const errors = [];
const rawDirectory = 'data/raw';
let localGaiaResponseStatus = 'absent; original response bytes were not verified';

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

for (const [directory, allowedEntries] of scaffoldDirectories) {
  const absoluteDirectory = join(repositoryRoot, directory);
  if (!existsSync(absoluteDirectory)) {
    errors.push(`Missing scaffold directory: ${directory}`);
    continue;
  }
  const unexpected = readdirSync(absoluteDirectory).filter((entry) => !allowedEntries.has(entry));
  if (unexpected.length > 0) {
    errors.push(`${directory} contains non-scaffold files: ${unexpected.join(', ')}`);
  }
}

const gaiaManifestPath = join(
  repositoryRoot,
  'data/manifests/gaia-dr3-hip-screen-v1/acquisition-manifest.v1.json',
);
let gaiaManifest;
try {
  gaiaManifest = JSON.parse(readFileSync(gaiaManifestPath, 'utf8'));
} catch (error) {
  errors.push(`Cannot parse Gaia query evidence manifest: ${error.message}`);
}

if (gaiaManifest) {
  const expectedHipIds = [
    746, 3179, 4427, 6686, 8886, 11767, 53910, 54061, 58001, 59774, 62956, 65378, 67301, 72607,
    75097, 77055, 79822, 82080, 85822,
  ];
  const expectedQueryPaths = [
    'data/manifests/gaia-dr3-hip-screen-v1/best-neighbour-source.v1.adql',
    'data/manifests/gaia-dr3-hip-screen-v1/neighbourhood.v1.adql',
    'data/manifests/gaia-dr3-hip-screen-v1/tap-schema.v1.adql',
  ];

  if (
    gaiaManifest.manifestType !== 'UFUQ_GAIA_TAP_QUERY_EVIDENCE_MANIFEST' ||
    gaiaManifest.schemaVersion !== 1
  ) {
    errors.push('Gaia query evidence manifest type/version is not the approved V1 contract');
  }
  if (gaiaManifest.authorityStatus !== 'QUERY_EVIDENCE_VERIFIED') {
    errors.push('Gaia query evidence manifest has an unexpected authority status');
  }
  if (gaiaManifest.rowScientificApproval !== 'NONE') {
    errors.push('Gaia query evidence must not approve scientific rows');
  }
  if (gaiaManifest.canonicalExtraction?.status !== 'NOT_PRODUCED') {
    errors.push('Milestone 2D.1B must not contain a canonical scientific row extraction');
  }
  if (
    gaiaManifest.release?.datasetVersion !== '1.1' ||
    gaiaManifest.release?.schema !== 'gaiadr3' ||
    gaiaManifest.service?.syncUrl !== 'https://gea.esac.esa.int/tap-server/tap/sync'
  ) {
    errors.push('Gaia query evidence is not pinned to the approved DR3 V1.1 TAP boundary');
  }
  if (
    JSON.stringify(gaiaManifest.queryConstruction?.candidateHipIds) !==
    JSON.stringify(expectedHipIds)
  ) {
    errors.push('Gaia query evidence candidate HIP set or ordering changed');
  }

  const manifestQueries = gaiaManifest.queryConstruction?.queries ?? [];
  if (
    JSON.stringify(manifestQueries.map((query) => query.path)) !==
    JSON.stringify(expectedQueryPaths)
  ) {
    errors.push('Gaia query evidence must contain exactly the three approved query files');
  }

  for (const query of manifestQueries) {
    if (!query.path.startsWith('data/manifests/gaia-dr3-hip-screen-v1/')) {
      errors.push(`Gaia query path escapes its tracked evidence directory: ${query.path}`);
      continue;
    }
    const absolutePath = join(repositoryRoot, query.path);
    if (!existsSync(absolutePath)) {
      errors.push(`Missing tracked Gaia query: ${query.path}`);
      continue;
    }
    const byteLength = statSync(absolutePath).size;
    const digest = sha256(absolutePath);
    if (byteLength !== query.byteLength || digest !== query.sha256) {
      errors.push(`Tracked Gaia query identity mismatch: ${query.path}`);
    }
  }

  const rawFiles = gaiaManifest.rawEvidence?.files ?? [];
  if (
    gaiaManifest.rawEvidence?.repositoryPolicy !== 'IGNORED_LOCAL_ONLY_RIGHTS_REVIEW_PENDING' ||
    rawFiles.length !== 10
  ) {
    errors.push('Gaia response evidence must remain the complete ten-file ignored local set');
  }
  if (
    gaiaManifest.structuralResults?.candidateCount !== 19 ||
    gaiaManifest.structuralResults?.bestNeighbourRowCount !== 8 ||
    gaiaManifest.structuralResults?.neighbourhoodRowCount !== 8
  ) {
    errors.push('Gaia query evidence structural inventory changed without a new version');
  }
  const rawPresence = rawFiles.map((file) => existsSync(join(repositoryRoot, file.path)));
  const presentRawCount = rawPresence.filter(Boolean).length;
  if (presentRawCount > 0 && presentRawCount !== rawFiles.length) {
    errors.push(
      `Local Gaia query evidence is incomplete: ${presentRawCount}/${rawFiles.length} files present`,
    );
  }
  if (presentRawCount === rawFiles.length) {
    localGaiaResponseStatus = 'complete and byte/hash verified';
    for (const file of rawFiles) {
      if (!file.path.startsWith('data/raw/')) {
        errors.push(`Gaia raw evidence path escapes data/raw: ${file.path}`);
        continue;
      }
      const absolutePath = join(repositoryRoot, file.path);
      const byteLength = statSync(absolutePath).size;
      const digest = sha256(absolutePath);
      if (byteLength !== file.byteLength || digest !== file.sha256) {
        errors.push(`Local Gaia response identity mismatch: ${file.path}`);
      }
    }

    const responseColumnChecks = new Map([
      ['best-neighbour-source.csv', gaiaManifest.responseColumns?.bestNeighbourSource],
      ['neighbourhood.csv', gaiaManifest.responseColumns?.neighbourhood],
      ['tap-schema.csv', gaiaManifest.responseColumns?.tapSchema],
    ]);
    for (const [filename, expectedColumns] of responseColumnChecks) {
      const file = rawFiles.find((candidate) => candidate.path.endsWith(`/${filename}`));
      if (!file || !Array.isArray(expectedColumns)) {
        errors.push(`Gaia response-column evidence is incomplete for ${filename}`);
        continue;
      }
      const header = readFileSync(join(repositoryRoot, file.path), 'utf8').split(/\r?\n/, 1)[0];
      if (JSON.stringify(header.split(',')) !== JSON.stringify(expectedColumns)) {
        errors.push(`Gaia response columns do not match the raw CSV header: ${filename}`);
      }
    }
  }
}

// Milestone 2D.1D: ESA Hipparcos 1997 bounded query evidence (same contract style).
let localHipparcosResponseStatus = 'absent; original response bytes were not verified';
const hipparcosDirectory = 'data/manifests/hipparcos-esa-1997-hip-screen-v1';
let hipparcosManifest;
try {
  hipparcosManifest = JSON.parse(
    readFileSync(join(repositoryRoot, hipparcosDirectory, 'acquisition-manifest.v1.json'), 'utf8'),
  );
} catch (error) {
  errors.push(`Cannot parse Hipparcos 1997 query evidence manifest: ${error.message}`);
}

if (hipparcosManifest) {
  const expectedHipIds = [
    746, 3179, 4427, 6686, 8886, 11767, 53910, 54061, 58001, 59774, 62956, 65378, 67301, 72607,
    75097, 77055, 79822, 82080, 85822,
  ];
  const expectedQueryPaths = [
    `${hipparcosDirectory}/hip-main-source.v1.adql`,
    `${hipparcosDirectory}/tap-schema.v1.adql`,
  ];
  if (
    hipparcosManifest.manifestType !== 'UFUQ_HIPPARCOS1997_TAP_QUERY_EVIDENCE_MANIFEST' ||
    hipparcosManifest.schemaVersion !== 1 ||
    hipparcosManifest.authorityStatus !== 'QUERY_EVIDENCE_VERIFIED' ||
    hipparcosManifest.rowScientificApproval !== 'NONE'
  ) {
    errors.push('Hipparcos 1997 query evidence manifest violates the V1 evidence contract');
  }
  if (
    hipparcosManifest.release?.table !== 'hipparcos1.hip_main' ||
    hipparcosManifest.release?.catalogueEpoch !== 'J1991.25(TT)' ||
    hipparcosManifest.service?.syncUrl !==
      'https://esaskylegacy.esac.esa.int/esasky-legacy-sl-tap/tap/sync'
  ) {
    errors.push('Hipparcos 1997 query evidence is not pinned to the ESA hip_main TAP boundary');
  }
  if (
    JSON.stringify(hipparcosManifest.queryConstruction?.candidateHipIds) !==
    JSON.stringify(expectedHipIds)
  ) {
    errors.push('Hipparcos 1997 query evidence candidate HIP set or ordering changed');
  }
  const queries = hipparcosManifest.queryConstruction?.queries ?? [];
  if (JSON.stringify(queries.map((query) => query.path)) !== JSON.stringify(expectedQueryPaths)) {
    errors.push('Hipparcos 1997 query evidence must contain exactly the two approved query files');
  }
  for (const query of queries) {
    const absolutePath = join(repositoryRoot, query.path);
    if (!query.path.startsWith(`${hipparcosDirectory}/`) || !existsSync(absolutePath)) {
      errors.push(`Missing or escaping tracked Hipparcos 1997 query: ${query.path}`);
      continue;
    }
    if (statSync(absolutePath).size !== query.byteLength || sha256(absolutePath) !== query.sha256) {
      errors.push(`Tracked Hipparcos 1997 query identity mismatch: ${query.path}`);
    }
  }
  const structural = hipparcosManifest.structuralResults ?? {};
  if (
    structural.candidateCount !== 19 ||
    structural.responseRowCount !== 19 ||
    structural.routeStarRowsPresent !== 13
  ) {
    errors.push('Hipparcos 1997 structural inventory changed without a new version');
  }
  const rawFiles = hipparcosManifest.rawEvidence?.files ?? [];
  if (rawFiles.length !== 5 || rawFiles.some((file) => !file.path.startsWith('data/raw/'))) {
    errors.push('Hipparcos 1997 raw evidence must be the five-file ignored data/raw set');
  }
  const present = rawFiles.filter((file) => existsSync(join(repositoryRoot, file.path))).length;
  if (present > 0 && present !== rawFiles.length) {
    errors.push(`Local Hipparcos 1997 evidence is incomplete: ${present}/${rawFiles.length} files`);
  }
  if (rawFiles.length > 0 && present === rawFiles.length) {
    localHipparcosResponseStatus = 'complete and byte/hash verified';
    for (const file of rawFiles) {
      const absolutePath = join(repositoryRoot, file.path);
      if (statSync(absolutePath).size !== file.byteLength || sha256(absolutePath) !== file.sha256) {
        errors.push(`Local Hipparcos 1997 response identity mismatch: ${file.path}`);
      }
    }
    const csvFile = rawFiles.find((file) => file.path.endsWith('/hip-main-source.csv'));
    const header = csvFile
      ? readFileSync(join(repositoryRoot, csvFile.path), 'utf8').split(/\r?\n/, 1)[0].split(',')
      : [];
    const columns = hipparcosManifest.responseColumns ?? {};
    const missing = (columns.requiredAstrometryColumns ?? []).filter(
      (column) => !header.includes(column),
    );
    if (header.length !== columns.hipMainSourceColumnCount || missing.length > 0) {
      errors.push(
        `Hipparcos 1997 response columns do not match the manifest: ${missing.join(', ')}`,
      );
    }
  }
}

// Shared all-or-nothing raw-set check for the Milestone 2D.2/2D.3 evidence manifests.
function verifyRawSet(label, files, expectedCount, directoryPrefix) {
  if (
    files.length !== expectedCount ||
    files.some((file) => !file.path?.startsWith(`${directoryPrefix}/`))
  ) {
    errors.push(`${label} raw evidence must be the ${expectedCount}-file ignored set`);
    return 'invalid';
  }
  const present = files.filter((file) => existsSync(join(repositoryRoot, file.path))).length;
  if (present === 0) return 'absent; original bytes were not verified';
  if (present !== files.length) {
    errors.push(`Local ${label} evidence is incomplete: ${present}/${files.length} files`);
    return 'incomplete';
  }
  for (const file of files) {
    const absolutePath = join(repositoryRoot, file.path);
    if (statSync(absolutePath).size !== file.byteLength || sha256(absolutePath) !== file.sha256) {
      errors.push(`Local ${label} evidence identity mismatch: ${file.path}`);
    }
  }
  return 'complete and byte/hash verified';
}

function readManifest(directory, label) {
  try {
    return JSON.parse(
      readFileSync(join(repositoryRoot, directory, 'acquisition-manifest.v1.json'), 'utf8'),
    );
  } catch (error) {
    errors.push(`Cannot parse ${label} manifest: ${error.message}`);
    return undefined;
  }
}

// Milestone 2D.2: IERS leap/EOP/restoration source evidence.
let localLeapEopStatus = 'absent; original bytes were not verified';
const leapEopManifest = readManifest('data/manifests/iers-leap-eop-v1', 'IERS leap/EOP evidence');
if (leapEopManifest) {
  const expectedIssues = [453, 454, 455, 456, 457, 458, 459, 460, 461];
  if (
    leapEopManifest.manifestType !== 'UFUQ_LEAP_EOP_SOURCE_EVIDENCE_MANIFEST' ||
    leapEopManifest.schemaVersion !== 1 ||
    leapEopManifest.authorityStatus !== 'SOURCE_EVIDENCE_VERIFIED' ||
    leapEopManifest.scientificApproval !== 'REVIEW_REQUIRED'
  ) {
    errors.push('IERS leap/EOP manifest violates the V1 evidence contract');
  }
  const selection = leapEopManifest.selection ?? {};
  if (
    selection.leapTransport?.file !== 'leap-seconds.3992312697' ||
    selection.leapTransport?.publisherIntegrity !== 'VERIFIED' ||
    selection.leapTransport?.bulletinCConsistency !== 'CONSISTENT' ||
    JSON.stringify(selection.eopSeries?.bulletinBIssues) !== JSON.stringify(expectedIssues) ||
    selection.eopSeries?.sourceQuality !== 'FINAL' ||
    selection.restorationSource?.package !== 'iersconventions_v1_0_0.tar.gz'
  ) {
    errors.push('IERS leap/EOP selection changed without a new manifest version');
  }
  localLeapEopStatus = verifyRawSet(
    'IERS leap/EOP',
    leapEopManifest.rawEvidence?.files ?? [],
    45,
    'data/raw/iers-leap-eop',
  );
  if (localLeapEopStatus.startsWith('complete')) {
    const { parseNtpLeapList } = await import('./evidence/screen-iers-leap-eop-v1.mjs');
    const transport = leapEopManifest.rawEvidence.files.find((file) =>
      file.path.endsWith('/leap-seconds.3992312697'),
    );
    const parsed = parseNtpLeapList(readFileSync(join(repositoryRoot, transport.path), 'latin1'));
    if (parsed.publisherIntegrity !== 'VERIFIED') {
      errors.push('Selected leap transport fails its publisher SHA-1 integrity code');
    }
  }
}

// Milestone 2D.3: observer-preset candidate evidence.
let localObserverStatus = 'absent; original bytes were not verified';
const observerManifest = readManifest(
  'data/manifests/observer-umpsa-pekan-v1',
  'observer-preset evidence',
);
if (observerManifest) {
  const preset = observerManifest.candidatePreset ?? {};
  if (
    observerManifest.manifestType !== 'UFUQ_OBSERVER_PRESET_EVIDENCE_MANIFEST' ||
    observerManifest.schemaVersion !== 1 ||
    observerManifest.scientificApproval !== 'REVIEW_REQUIRED' ||
    preset.presetId !== 'umpsa-pekan-faculty-of-computing' ||
    preset.referenceSystem?.id !== 'WGS 84' ||
    preset.height?.kind !== 'ELLIPSOIDAL' ||
    preset.coordinateAccuracy?.vertical?.state !== 'UNKNOWN_UNBOUNDED' ||
    preset.scientificApproval?.state !== 'REVIEW_REQUIRED'
  ) {
    errors.push('Observer-preset manifest violates the V1 ObserverPreset evidence contract');
  }
  if (/"(user|uid)"\s*:/.test(JSON.stringify(observerManifest))) {
    errors.push('Observer-preset manifest must not track contributor identities');
  }
  localObserverStatus = verifyRawSet(
    'observer-preset',
    observerManifest.rawEvidence?.files ?? [],
    5,
    'data/raw/observer-umpsa-pekan',
  );
}

if (!existsSync(join(repositoryRoot, rawDirectory))) {
  errors.push(`Missing scaffold directory: ${rawDirectory}`);
} else {
  const trackedRawFiles = execFileSync('git', ['ls-files', '--', rawDirectory], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const allowedTrackedRawFiles = new Set(['data/raw/.gitignore', 'data/raw/README.md']);
  const prohibitedTrackedRawFiles = trackedRawFiles.filter(
    (file) => !allowedTrackedRawFiles.has(file),
  );
  if (prohibitedTrackedRawFiles.length > 0) {
    errors.push(`Tracked raw data is prohibited: ${prohibitedTrackedRawFiles.join(', ')}`);
  }

  const unignoredRawFiles = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '--', rawDirectory],
    { cwd: repositoryRoot, encoding: 'utf8' },
  )
    .split(/\r?\n/)
    .filter(Boolean);
  if (unignoredRawFiles.length > 0) {
    errors.push(`Unignored raw data is prohibited: ${unignoredRawFiles.join(', ')}`);
  }
}

for (const obsoleteDirectory of ['data/sources']) {
  if (existsSync(join(repositoryRoot, obsoleteDirectory))) {
    errors.push(`Obsolete data directory remains: ${obsoleteDirectory}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Data boundary verified: the Gaia, Hipparcos 1997, IERS leap/EOP, and observer-preset manifests are intact; local Gaia response set ${localGaiaResponseStatus}; local Hipparcos 1997 response set ${localHipparcosResponseStatus}; local IERS leap/EOP set ${localLeapEopStatus}; local observer-preset set ${localObserverStatus}; curation and generated data are checked by verify-generated-data.mjs; local raw data is ignored and untracked.`,
  );
}
