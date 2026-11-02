// IMP-004 validation: the browser bundle must not contain authoritative scoring,
// tolerance, route-eligibility or astronomy-evaluation code. Markers are string
// literals and coefficients that survive minification.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const assets = resolve(import.meta.dirname, '..', 'apps', 'web', 'dist', 'assets');
const forbidden = [
  ['WITHIN_APPROVED_TOLERANCE', 'assessment-core tolerance classification'],
  ['OUTSIDE_APPROVED_TOLERANCE', 'assessment-core tolerance classification'],
  ['REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED', 'astronomy-core profile evaluation'],
  ['LAGRANGE_FOUR_POINT_V1', 'astronomy-core EOP interpolation'],
  ['-172064161', 'IAU 2000A nutation series'],
  ['ELIGIBLE_BUT_GLOBAL_FAILURE', 'astronomy-core profile evaluation'],
  ['below the geometric horizon', 'API route eligibility'],
];
const files = readdirSync(assets).filter((file) => file.endsWith('.js'));
const errors = [];
for (const file of files) {
  const text = readFileSync(join(assets, file), 'utf8');
  for (const [marker, meaning] of forbidden) {
    if (text.includes(marker)) errors.push(`${file} contains ${meaning} (${marker}).`);
  }
}
if (files.length === 0) errors.push('No web bundle found; run the web build first.');
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Web bundle authority check passed: ${files.length} bundle file(s) contain no scoring, tolerance, eligibility or astronomy-evaluation code.`,
  );
}
