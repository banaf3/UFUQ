// Verifies the generated runtime artifacts (Milestone 2E, Phase 2) without raw data:
// every MANIFEST entry's byte hash, every canonical payload hash, approval scopes, and
// the rule that IERS Bulletin B values stay in the ignored local-only directory.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const errors = [];

function canonicalize(value) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Object.is(value, -0) ? 0 : value;
  if (typeof value === 'string') return value.normalize('NFC');
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key.normalize('NFC'), canonicalize(value[key])]),
  );
}
const canonicalText = (value) => `${JSON.stringify(canonicalize(value), null, 2)}\n`;
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

let checked = 0;
let localOnlyPresent = 0;
const manifest = JSON.parse(
  readFileSync(join(repositoryRoot, 'data/generated/MANIFEST.v1.json'), 'utf8'),
);
if (manifest.manifestType !== 'UFUQ_GENERATED_DATA_MANIFEST' || manifest.schemaVersion !== 1) {
  errors.push('Generated data manifest has an unexpected type or version.');
}
for (const entry of manifest.artifacts ?? []) {
  const absolute = join(repositoryRoot, entry.path);
  if (!entry.tracked) {
    if (!entry.path.startsWith('data/generated/local-only/')) {
      errors.push(`Untracked artifact outside local-only: ${entry.path}`);
    }
    if (!existsSync(absolute)) continue;
    localOnlyPresent += 1;
  }
  if (!existsSync(absolute)) {
    errors.push(`Generated artifact missing: ${entry.path}`);
    continue;
  }
  const text = readFileSync(absolute, 'utf8');
  if (sha256(text) !== entry.sha256) errors.push(`Byte hash mismatch: ${entry.path}`);
  const artifact = JSON.parse(text);
  const payloadHash = sha256(canonicalText(artifact.payload));
  if (payloadHash !== artifact.payloadSha256 || payloadHash !== entry.payloadSha256) {
    errors.push(`Payload hash mismatch: ${entry.path}`);
  }
  const synthetic = entry.path.startsWith('data/generated/synthetic/');
  const expectedScope = synthetic ? 'SYNTHETIC_TECHNICAL_FIXTURE' : 'SCIENTIFIC_PROFILE_V1';
  if (artifact.approval?.scope !== expectedScope) {
    errors.push(`${entry.path} approval scope must be ${expectedScope}.`);
  }
  if (
    entry.tracked &&
    artifact.artifactType === 'UFUQ_EOP_DAILY_BUNDLE' &&
    artifact.payload.sourceProductId !== 'SYNTHETIC'
  ) {
    errors.push(`IERS Bulletin B values must stay local-only: ${entry.path}`);
  }
  if (
    !synthetic &&
    artifact.approval?.state === 'APPROVED' &&
    !(
      artifact.approval.reviewer &&
      artifact.approval.decisionDate &&
      artifact.approval.decisionReference
    )
  ) {
    errors.push(`${entry.path} is APPROVED without a named reviewer, date and reference.`);
  }
  checked += 1;
}
const trackedLocalOnly = execFileSync('git', ['ls-files', '--', 'data/generated/local-only'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim();
if (trackedLocalOnly !== '') errors.push('data/generated/local-only must never be tracked.');

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Generated data verified: ${checked} artifacts match MANIFEST byte and canonical payload hashes (${localOnlyPresent} local-only present); approval scopes are consistent; Bulletin B values are untracked.`,
  );
}
