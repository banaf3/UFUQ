// Milestone 2D.2 acquisition of official leap-second, Earth-orientation, and
// IERS Conventions (2010) restoration-source bytes into an ignored, never-reused
// evidence directory under data/raw/iers-leap-eop/.
//
// Usage: node scripts/evidence/acquire-iers-leap-eop-v1.mjs
//
// The script only downloads and hashes bytes. It parses nothing and approves
// nothing; see scripts/evidence/screen-iers-leap-eop-v1.mjs for the structural
// screen and data/manifests/iers-leap-eop-v1/ for the tracked manifest.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const userAgent = 'UFUQ-FYP-evidence/1 (+https://github.com/banaf3/UFUQ)';

const bulletinB = Array.from({ length: 12 }, (_, index) => 453 + index).map((issue) => ({
  name: `bulletinb.${issue}`,
  url: `https://hpiers.obspm.fr/iers/bul/bulb_new/bulletinb.${issue}`,
  role: 'EOP_FINAL_SOURCE',
}));
const bulletinC = Array.from({ length: 21 }, (_, index) => 52 + index).map((issue) => ({
  name: `bulletinc.${issue}`,
  url: `https://hpiers.obspm.fr/iers/bul/bulc/bulletinc.${issue}`,
  role: 'LEAP_EVENT_AUTHORITY',
}));

export const acquisitionTargets = [
  {
    name: 'leap-seconds.3992312697',
    url: 'https://hpiers.obspm.fr/iers/bul/bulc/ntp/leap-seconds.3992312697',
    role: 'LEAP_TRANSPORT_SELECTED',
  },
  {
    name: 'iana-tzdb-2026f-leap-seconds.list',
    url: 'https://data.iana.org/time-zones/tzdb-2026f/leap-seconds.list',
    role: 'LEAP_TRANSPORT_CONCORDANCE',
  },
  {
    name: 'Leap_Second.dat',
    url: 'https://hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat',
    role: 'LEAP_TRANSPORT_CONCORDANCE',
  },
  ...bulletinC,
  ...bulletinB,
  {
    name: 'bulletinb-explanatory.html',
    url: 'https://hpiers.obspm.fr/iers/bul/explanatory.html',
    role: 'EOP_PRODUCT_DOCUMENTATION',
  },
  {
    name: 'bulletinb.pdf',
    url: 'https://hpiers.obspm.fr/iers/bul/bulb_new/bulletinb.pdf',
    role: 'EOP_PRODUCT_DOCUMENTATION',
  },
  {
    name: 'iersconventions_v1_0_0.tar.gz',
    // Canonical location; /conventions/packaged_versions/ answers 302 to this URL.
    url: 'https://iers-conventions.obspm.fr/packaged_versions/iersconventions_v1_0_0.tar.gz',
    role: 'RESTORATION_SOURCE_OFFICIAL_2010',
  },
  ...['PMSDNUT2.F', 'UTLIBR.F', 'FUNDARG.F'].map((file) => ({
    name: `working-chapter5-${file}`,
    url: `https://iers-conventions.obspm.fr/content/chapter5/software/${file}`,
    role: 'RESTORATION_SOURCE_WORKING_COMPARISON',
  })),
  ...['ORTHO_EOP.F', 'CNMTX.F'].map((file) => ({
    name: `working-chapter8-${file}`,
    url: `https://iers-conventions.obspm.fr/content/chapter8/software/${file}`,
    role: 'RESTORATION_SOURCE_WORKING_COMPARISON',
  })),
];

function utcStamp(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

async function main() {
  const started = new Date();
  const evidenceId = `2d2-leap-eop-v1-${utcStamp(started)}`;
  const directory = join(repositoryRoot, 'data/raw/iers-leap-eop', evidenceId);
  if (existsSync(directory)) {
    throw new Error(`Refusing to reuse an existing evidence directory: ${directory}`);
  }
  mkdirSync(directory, { recursive: true });

  const files = [];
  for (const target of acquisitionTargets) {
    const requestStarted = new Date().toISOString();
    const response = await fetch(target.url, {
      headers: { 'User-Agent': userAgent },
      redirect: 'error',
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (response.status !== 200) {
      throw new Error(`${target.url} returned HTTP ${response.status}`);
    }
    writeFileSync(join(directory, target.name), bytes, { flag: 'wx' });
    files.push({
      name: target.name,
      role: target.role,
      url: target.url,
      requestStartedUtc: requestStarted,
      httpStatus: response.status,
      lastModified: response.headers.get('last-modified'),
      etag: response.headers.get('etag'),
      contentType: response.headers.get('content-type'),
      byteLength: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }

  const log = {
    evidenceId,
    startedUtc: started.toISOString(),
    completedUtc: new Date().toISOString(),
    tool: `node ${process.version} fetch`,
    userAgent,
    authentication: 'ANONYMOUS',
    redirects: 'REJECTED',
    files,
  };
  writeFileSync(join(directory, 'acquisition-log.json'), `${JSON.stringify(log, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(`Acquired ${files.length} files into data/raw/iers-leap-eop/${evidenceId}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await main();
}
