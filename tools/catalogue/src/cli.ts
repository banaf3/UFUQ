/**
 * `npm run data:generate` (write) and `npm run data:generate -- --check` (byte-identical
 * rebuild check) for the ScientificProfileV1 runtime artifacts and lesson content.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson, sha256Hex } from './canonical-json.js';
import { generateLessonContent, generateSyntheticTechnicalDataset } from './generate/content.js';
import {
  generateEopBundle,
  generateLeapState,
  generateObserver,
  generateRouteStars,
  generateSupportedTimeDomain,
} from './generate/profile-v1-data.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const check = process.argv.includes('--check');
const outputs: { path: string; text: string; tracked: boolean }[] = [];

function emit(path: string, value: unknown, tracked = true) {
  outputs.push({ path, text: canonicalJson(value), tracked });
}

const hipparcosRaw = existsSync(
  join(
    root,
    'data/raw/hipparcos-esa-1997/2d1d-hip-main-screen-v1-20261101T102758Z/hip-main-source.csv',
  ),
);
const iersRaw = existsSync(
  join(root, 'data/raw/iers-leap-eop/2d2-leap-eop-v1-20261101T154026Z/leap-seconds.3992312697'),
);
if (!hipparcosRaw || !iersRaw) {
  console.error(
    'Raw 2D evidence is absent (data/raw is local-only); real artifacts cannot be regenerated here.',
  );
  process.exit(2);
}

const stars = generateRouteStars(root);
const leap = generateLeapState(root);
const eop = generateEopBundle(root);
const observer = generateObserver(root);
const domain = generateSupportedTimeDomain(root, eop, leap, stars, observer);
const content = generateLessonContent(root, stars);
emit('data/generated/route-stars-hipparcos1997-v1.json', stars);
emit('data/generated/leap-seconds-iers-v1.json', leap);
emit('data/generated/observer-umpsa-pekan-v1.json', observer);
emit('data/generated/time-domain-profile-v1.json', domain);
emit('data/generated/lesson-content-v1.json', content);
emit('data/generated/local-only/eop-bulletinb-453-461-v1.json', eop, false);
for (const artifact of generateSyntheticTechnicalDataset(root)) {
  emit(`data/generated/synthetic/${artifact.artifactId}.json`, artifact);
}

const manifest = {
  manifestType: 'UFUQ_GENERATED_DATA_MANIFEST',
  schemaVersion: 1,
  generator: 'tools/catalogue data:generate v1',
  canonicalSerialization: 'CATALOGUE_CANONICAL_SERIALIZATION_V1',
  artifacts: outputs.map(({ path, text, tracked }) => {
    const parsed = JSON.parse(text) as {
      artifactId: string;
      payloadSha256: string;
      approval: { state: string };
    };
    return {
      path,
      tracked,
      artifactId: parsed.artifactId,
      byteLength: Buffer.byteLength(text, 'utf8'),
      sha256: sha256Hex(text),
      payloadSha256: parsed.payloadSha256,
      approvalState: parsed.approval.state,
    };
  }),
};
emit('data/generated/MANIFEST.v1.json', manifest);

let differences = 0;
for (const { path, text } of outputs) {
  const target = join(root, path);
  if (check) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : undefined;
    if (current !== text) {
      differences += 1;
      console.error(`Not byte-identical: ${path}`);
    }
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, 'utf8');
  }
}
if (check && differences > 0) process.exit(1);
console.log(
  `${check ? 'Verified byte-identical rebuild of' : 'Wrote'} ${outputs.length} artifacts; domain ${
    domain.payload.earliest.canonicalUtc
  } (inclusive) to ${domain.payload.latest.canonicalUtc} (exclusive).`,
);
