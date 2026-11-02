// Reviewer support for the remaining human gates.
//
//   node scripts/approvals/status.mjs                 # list every artifact and content review state
//   node scripts/approvals/status.mjs --template <id> # print an approval-record template for an artifact
//
// Approval is a named reviewer's decision. This script never approves anything: a
// template is printed to stdout with state REVIEW_REQUIRED and empty reviewer fields.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'data/generated/MANIFEST.v1.json'), 'utf8'));
const args = process.argv.slice(2);

if (args[0] === '--template') {
  const entry = manifest.artifacts.find((artifact) => artifact.artifactId === args[1]);
  if (!entry) {
    console.error(`Unknown artifact ${args[1]}.`);
    process.exit(1);
  }
  const fields = entry.artifactId.startsWith('eop-') ? ['UT1_MINUS_UTC', 'XP', 'YP'] : [];
  const pending = {
    state: 'REVIEW_REQUIRED',
    scope: 'SCIENTIFIC_PROFILE_V1',
    reviewer: null,
    decisionDate: null,
    decisionReference: null,
  };
  const template = {
    approvalType: 'UFUQ_SCIENTIFIC_APPROVAL_RECORD',
    schemaVersion: 1,
    artifactId: entry.artifactId,
    payloadSha256: entry.payloadSha256,
    approval: pending,
    ...(fields.length > 0
      ? { fieldApprovals: Object.fromEntries(fields.map((f) => [f, pending])) }
      : {}),
  };
  console.log(JSON.stringify(template, null, 2));
  console.error(
    `Save as data/approvals/${entry.artifactId}.approval.v1.json only after the named reviewer decides; then run npm run data:generate.`,
  );
  process.exit(0);
}

console.log('Generated artifacts (ScientificProfileV1 needs APPROVED for real execution):');
for (const artifact of manifest.artifacts) {
  if (artifact.path.startsWith('data/generated/synthetic/')) continue;
  const approvalFile = join(root, 'data', 'approvals', `${artifact.artifactId}.approval.v1.json`);
  console.log(
    `  ${artifact.artifactId.padEnd(34)} ${artifact.approvalState.padEnd(16)} ${existsSync(approvalFile) ? 'approval record present' : 'no approval record'}`,
  );
}

const content = JSON.parse(
  readFileSync(join(root, 'data/generated/lesson-content-v1.json'), 'utf8'),
);
console.log('\nLesson content records (each needs its listed review kinds):');
const records = [
  ...content.payload.patterns.map((r) => ['pattern', r.stableId, r.review]),
  ...content.payload.directions.map((r) => ['direction', r.stableId, r.review]),
  ...content.payload.relationships.map((r) => ['relationship', r.stableId, r.review]),
  ...content.payload.routes.map((r) => ['route', r.stableId, r.review]),
  ...content.payload.scenarios.map((r) => ['scenario', r.scenarioId, r.review]),
];
for (const [kind, id, review] of records) {
  console.log(
    `  ${kind.padEnd(12)} ${id.padEnd(34)} ${review.state.padEnd(16)} needs ${review.requiredReviewKinds.join(', ')}`,
  );
}
