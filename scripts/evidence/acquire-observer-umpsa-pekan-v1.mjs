// Milestone 2D.3 acquisition of public, reproducible evidence for the V1 observer
// candidate `umpsa-pekan-faculty-of-computing` into an ignored, never-reused
// evidence directory under data/raw/observer-umpsa-pekan/.
//
// Usage: node scripts/evidence/acquire-observer-umpsa-pekan-v1.mjs
//
// Sources: the OpenStreetMap API 0.6 records for the Faculty node and the campus
// way, the Open-Meteo elevation API (Copernicus DEM GLO-90), and the GeographicLib
// GeoidEval service (EGM2008/EGM96/EGM84). The script records bytes and hashes only;
// it approves nothing.
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..', '..');
const userAgent = 'UFUQ-FYP-evidence/1 (+https://github.com/banaf3/UFUQ)';
export const facultyNodeId = 12825444378;
export const campusWayId = 1147355347;

function utcStamp(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

async function get(url) {
  const requestStartedUtc = new Date().toISOString();
  const response = await fetch(url, { headers: { 'User-Agent': userAgent }, redirect: 'error' });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (response.status !== 200) throw new Error(`${url} returned HTTP ${response.status}`);
  return { url, requestStartedUtc, response, bytes };
}

async function main() {
  const started = new Date();
  const evidenceId = `2d3-observer-umpsa-pekan-v1-${utcStamp(started)}`;
  const directory = join(repositoryRoot, 'data/raw/observer-umpsa-pekan', evidenceId);
  if (existsSync(directory)) throw new Error(`Refusing to reuse ${directory}`);
  mkdirSync(directory, { recursive: true });

  const files = [];
  const save = (name, role, result) => {
    writeFileSync(join(directory, name), result.bytes, { flag: 'wx' });
    files.push({
      name,
      role,
      url: result.url,
      requestStartedUtc: result.requestStartedUtc,
      httpStatus: result.response.status,
      contentType: result.response.headers.get('content-type'),
      byteLength: result.bytes.length,
      sha256: createHash('sha256').update(result.bytes).digest('hex'),
    });
  };

  const node = await get(`https://api.openstreetmap.org/api/0.6/node/${facultyNodeId}`);
  save('osm-node.xml', 'REFERENCE_POINT_SOURCE', node);
  const nodeText = node.bytes.toString('utf8');
  const lat = /\blat="(-?\d+\.\d+)"/.exec(nodeText)?.[1];
  const lon = /\blon="(-?\d+\.\d+)"/.exec(nodeText)?.[1];
  if (!lat || !lon) throw new Error('OSM node response carries no lat/lon');

  save(
    'osm-campus-way-full.xml',
    'SITE_EXTENT_SOURCE',
    await get(`https://api.openstreetmap.org/api/0.6/way/${campusWayId}/full`),
  );
  save(
    'open-meteo-elevation.json',
    'ORTHOMETRIC_HEIGHT_SOURCE',
    await get(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`),
  );
  save(
    'geographiclib-geoideval.html',
    'GEOID_UNDULATION_SOURCE',
    await get(`https://geographiclib.sourceforge.io/cgi-bin/GeoidEval?input=${lat}+${lon}`),
  );

  const log = {
    evidenceId,
    startedUtc: started.toISOString(),
    completedUtc: new Date().toISOString(),
    tool: `node ${process.version} fetch`,
    userAgent,
    authentication: 'ANONYMOUS',
    redirects: 'REJECTED',
    queriedPoint: { source: `osm node ${facultyNodeId}`, lat, lon },
    files,
  };
  writeFileSync(join(directory, 'acquisition-log.json'), `${JSON.stringify(log, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(`Acquired ${files.length} files into data/raw/observer-umpsa-pekan/${evidenceId}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await main();
}
