// BKT sensitivity evidence (TUTORING_BKT_SPEC.md "Sensitivity and validation plan",
// items 2-4 and 7). Sweeps a CANDIDATE grid of parameters and thresholds with the built
// production tutoring-core and writes a deterministic JSON record plus a Markdown
// summary. Exact enumeration only: no random sampling, so no seed is involved.
//
// The grid describes model behaviour to inform BKT-002/BKT-003; it selects and approves
// nothing. Run after a build:
//   node scripts/evidence/bkt-sensitivity.mjs          # write
//   node scripts/evidence/bkt-sensitivity.mjs --check  # byte-compare (CI)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..', '..');
const core = await import(
  pathToFileURL(join(root, 'packages', 'tutoring-core', 'dist', 'index.js')).href
);
const {
  attemptsToThreshold,
  crossingsCausedByTransition,
  falseMasteryProbability,
  incorrectEvidenceLowerFixedPoint,
  meetsThreshold,
  recoveryAfterErrors,
  runSequence,
} = core;

const GRID = {
  initialMastery: [0.1, 0.2, 0.3],
  learn: [0.05, 0.1, 0.2],
  guess: [0.1, 0.2, 0.3],
  slip: [0.05, 0.1, 0.2],
  threshold: [0.85, 0.95],
};
const MAX_ATTEMPTS = 20;
const ASSISTED_ATTEMPTS = 3;
const REPORT_EXAMPLE = { initialMastery: 0.2, learn: 0.1, guess: 0.2, slip: 0.1 };

const round = (value) => (value === null ? null : Number(value.toFixed(12)));

/** DEV-006 candidate treatments of assisted correct answers, compared before BKT-001. */
const ASSISTED_OPTIONS = {
  ASSISTED_AS_OBSERVATION: 'CORRECT',
  ASSISTED_TRANSITION_ONLY: 'TRANSITION_ONLY',
  ASSISTED_NO_UPDATE: 'NO_MODEL_UPDATE',
};

function assistedComparison(parameters, policy) {
  const result = {};
  for (const [option, step] of Object.entries(ASSISTED_OPTIONS)) {
    const assisted = runSequence(parameters, Array(ASSISTED_ATTEMPTS).fill(step));
    const afterAssisted = assisted.at(-1).next;
    result[option] = {
      masteryAfterAssisted: round(afterAssisted),
      meetsThresholdWithoutIndependentEvidence: meetsThreshold(afterAssisted, policy),
      independentCorrectToThreshold: attemptsToThreshold(
        parameters,
        policy,
        'CORRECT',
        MAX_ATTEMPTS,
        afterAssisted,
      ),
    };
  }
  return result;
}

const rows = [];
for (const initialMastery of GRID.initialMastery)
  for (const learn of GRID.learn)
    for (const guess of GRID.guess)
      for (const slip of GRID.slip)
        for (const threshold of GRID.threshold) {
          const parameters = {
            parameterSetId: 'candidate-grid',
            parameterSetVersion: '1',
            status: 'REVIEW_REQUIRED',
            initialMastery,
            learn,
            guess,
            slip,
          };
          const policy = {
            policyId: 'candidate-threshold',
            policyVersion: '1',
            status: 'REVIEW_REQUIRED',
            threshold,
            comparison: 'AT_OR_ABOVE',
          };
          const allCorrect = runSequence(parameters, Array(MAX_ATTEMPTS).fill('CORRECT'));
          const reached = attemptsToThreshold(parameters, policy, 'CORRECT', MAX_ATTEMPTS);
          rows.push({
            parameters: { initialMastery, learn, guess, slip },
            threshold,
            correctObservationsToThreshold: reached,
            falseMasteryWithin5: round(falseMasteryProbability(parameters, policy, 5)),
            falseMasteryWithin10: round(falseMasteryProbability(parameters, policy, 10)),
            correctAfterTwoErrorsToThreshold: recoveryAfterErrors(
              parameters,
              policy,
              2,
              MAX_ATTEMPTS,
            ),
            thresholdCrossingsCausedByTransition: crossingsCausedByTransition(
              reached === null ? allCorrect : allCorrect.slice(0, reached),
              policy,
            ),
            incorrectEvidenceLowerFixedPoint: round(incorrectEvidenceLowerFixedPoint(parameters)),
            assistedEvidence: assistedComparison(parameters, policy),
          });
        }

const isReport = (row) =>
  Object.entries(REPORT_EXAMPLE).every(([key, value]) => row.parameters[key] === value);
const record = {
  evidenceType: 'UFUQ_BKT_SENSITIVITY',
  schemaVersion: 1,
  generator: 'scripts/evidence/bkt-sensitivity.mjs v1',
  model: 'STANDARD_BKT_FOUR_PARAMETER v1 (packages/tutoring-core)',
  status: 'CANDIDATE_GRID_NOT_APPROVED',
  method:
    'Exact enumeration; false mastery enumerates all 2^n outcomes of a learner who never masters and answers correctly with probability G. No random sampling.',
  grid: GRID,
  thresholdComparison: 'AT_OR_ABOVE',
  maximumAttempts: MAX_ATTEMPTS,
  assistedAttempts: ASSISTED_ATTEMPTS,
  rows,
};
const json = `${JSON.stringify(record, null, 2)}\n`;

const pct = (value) => `${(value * 100).toFixed(1)}%`;
const report = rows.filter(isReport);
const by = (threshold) => rows.filter((row) => row.threshold === threshold);
const lines = [
  '# BKT sensitivity evidence (candidate grid, not approved)',
  '',
  'Generated by `node scripts/evidence/bkt-sensitivity.mjs` from the production',
  '`packages/tutoring-core` build; do not edit by hand. The machine record is',
  '`docs/evidence/bkt-sensitivity.v1.json`. It describes model behaviour to inform BKT-002',
  'and BKT-003. It selects, calibrates and approves nothing.',
  '',
  `Grid: P(L0) in {${GRID.initialMastery.join(', ')}}, P(T) in {${GRID.learn.join(', ')}}, P(G) in {${GRID.guess.join(', ')}}, P(S) in {${GRID.slip.join(', ')}}; thresholds {${GRID.threshold.join(', ')}}, met when mastery is at or above the value. ${rows.length} rows. The method is exact enumeration, so no random seed is involved.`,
  '',
  '## Report example parameters (L0 .20, T .10, G .20, S .10)',
  '',
  '| Threshold | Correct to threshold | False mastery in 5 | False mastery in 10 | Correct after 2 errors | Lower fixed point |',
  '|---|---:|---:|---:|---:|---:|',
  ...report.map(
    (row) =>
      `| ${row.threshold} | ${row.correctObservationsToThreshold} | ${pct(row.falseMasteryWithin5)} | ${pct(row.falseMasteryWithin10)} | ${row.correctAfterTwoErrorsToThreshold} | ${row.incorrectEvidenceLowerFixedPoint?.toFixed(6)} |`,
  ),
  '',
  `### Assisted evidence after ${ASSISTED_ATTEMPTS} assisted correct answers (DEV-006 candidates)`,
  '',
  '| Threshold | Option | Mastery after assisted phase | Meets threshold with no independent evidence | Independent correct to threshold |',
  '|---|---|---:|---|---:|',
  ...report.flatMap((row) =>
    Object.entries(row.assistedEvidence).map(
      ([option, value]) =>
        `| ${row.threshold} | ${option} | ${value.masteryAfterAssisted.toFixed(4)} | ${value.meetsThresholdWithoutIndependentEvidence ? 'yes' : 'no'} | ${value.independentCorrectToThreshold} |`,
    ),
  ),
  '',
  '## Across the grid',
  '',
  '| Threshold | Rows | Met within 2 correct | Max false mastery in 10 | Rows with a transition-caused crossing | Baseline option meets threshold with no independent evidence |',
  '|---|---:|---:|---:|---:|---:|',
  ...GRID.threshold.map((threshold) => {
    const subset = by(threshold);
    const quick = subset.filter(
      (row) =>
        row.correctObservationsToThreshold !== null && row.correctObservationsToThreshold <= 2,
    ).length;
    const maxFalse = Math.max(...subset.map((row) => row.falseMasteryWithin10));
    const crossings = subset.filter((row) => row.thresholdCrossingsCausedByTransition > 0).length;
    const baseline = subset.filter(
      (row) =>
        row.assistedEvidence.ASSISTED_AS_OBSERVATION.meetsThresholdWithoutIndependentEvidence,
    ).length;
    return `| ${threshold} | ${subset.length} | ${quick} | ${pct(maxFalse)} | ${crossings} | ${baseline} |`;
  }),
  '',
  '## Reading the evidence',
  '',
  '- Counting assisted correct answers as ordinary observations (the report baseline) can reach the threshold before any independent evidence exists, which is why BKT-001 must choose an assisted-evidence policy and why threshold status stays separate from independent confirmation.',
  '- A higher guess parameter raises false-mastery risk for a pure guesser; the threshold choice (BKT-003) trades that risk against the number of correct answers required.',
  '- Below the lower fixed point an incorrect answer still finishes higher after the learning transition (DEV-008).',
  '- The values are expert-set candidates, not estimates from learner data; calibration needs participant data under an approved protocol (BKT-002).',
  '',
  `Record SHA-256: \`${createHash('sha256').update(json, 'utf8').digest('hex')}\``,
  '',
];
const markdown = lines.join('\n');

const outputs = [
  [join(root, 'docs', 'evidence', 'bkt-sensitivity.v1.json'), json],
  [join(root, 'docs', 'evidence', 'BKT_SENSITIVITY.md'), markdown],
];
if (process.argv.includes('--check')) {
  const stale = outputs.filter(
    ([path, text]) => !existsSync(path) || readFileSync(path, 'utf8') !== text,
  );
  for (const [path] of stale) console.error(`Not reproduced: ${path}`);
  if (stale.length > 0) process.exit(1);
  console.log(`BKT sensitivity evidence reproduced byte-identically (${rows.length} rows).`);
} else {
  for (const [path, text] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf8');
  }
  console.log(`Wrote BKT sensitivity evidence (${rows.length} rows).`);
}
