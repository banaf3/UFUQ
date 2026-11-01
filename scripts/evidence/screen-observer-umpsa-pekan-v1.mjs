// Milestone 2D.3 screen of the observer evidence acquired by
// acquire-observer-umpsa-pekan-v1.mjs.
//
// Usage: node scripts/evidence/screen-observer-umpsa-pekan-v1.mjs <evidence-directory>
//
// Prints the reference point, the site-extent containment and distance checks, the
// height derivation, and sensitivity figures as JSON. Contributor user names in the
// OpenStreetMap responses are never printed. Distances use a spherical haversine
// with the IUGG mean Earth radius; this is an evidence screen, not geodesy code.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MEAN_EARTH_RADIUS_M = 6371008.8;
const EARTH_ROTATION_RAD_PER_S = 7.292115e-5;
const SPEED_OF_LIGHT_M_PER_S = 299792458;
const RAD_TO_ARCSEC = 206264.80624709636;
// Owner-supplied campus point (message of 2026-11-01): "Kampus Pekan (Main/Pekan
// Campus)", 3.53959 N, 103.43148 E, with no stated datum, height, or source.
export const ownerCampusPoint = { lat: 3.53959, lon: 103.43148 };

const toRad = (deg) => (deg * Math.PI) / 180;
export function haversineMetres(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * MEAN_EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.lat > point.lat !== b.lat > point.lat &&
      point.lon < ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function attribute(element, name) {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(element)?.[1];
}

function screen(directory) {
  const read = (name) => readFileSync(join(directory, name));
  const log = JSON.parse(read('acquisition-log.json').toString('utf8'));
  const nodeXml = read('osm-node.xml').toString('utf8');
  const nodeElement = /<node [^>]*>/.exec(nodeXml)[0];
  const point = {
    lat: Number(attribute(nodeElement, 'lat')),
    lon: Number(attribute(nodeElement, 'lon')),
  };
  const name = /<tag k="name" v="([^"]*)"/.exec(nodeXml)?.[1];
  const website = /<tag k="website" v="([^"]*)"/.exec(nodeXml)?.[1];

  const wayXml = read('osm-campus-way-full.xml').toString('utf8');
  const nodes = new Map(
    [...wayXml.matchAll(/<node [^>]*\/?>/g)].map(([element]) => [
      attribute(element, 'id'),
      { lat: Number(attribute(element, 'lat')), lon: Number(attribute(element, 'lon')) },
    ]),
  );
  const wayElement = /<way [^>]*>/.exec(wayXml)[0];
  const refs = [...wayXml.matchAll(/<nd ref="(\d+)"\/>/g)].map((m) => m[1]);
  const ring = refs.map((ref) => nodes.get(ref));
  const closed = refs[0] === refs.at(-1);
  const wayName = /<tag k="name" v="([^"]*)"/.exec(wayXml)?.[1];
  const maxVertexDistance = Math.max(...ring.map((vertex) => haversineMetres(point, vertex)));
  let diameter = 0;
  for (const a of ring) for (const b of ring) diameter = Math.max(diameter, haversineMetres(a, b));

  const elevation = JSON.parse(read('open-meteo-elevation.json').toString('utf8')).elevation[0];
  const geoidText = read('geographiclib-geoideval.html')
    .toString('utf8')
    .replace(/<[^>]*>/g, ' ');
  const egm2008 = Number(/EGM2008\s*=\s*(-?\d+\.\d+)/.exec(geoidText)?.[1]);
  const geoidEvalVersion = /GeoidEval \(version ([\d.]+)\)/.exec(geoidText)?.[1];

  const horizontalSensitivityArcminPerKm = (1000 / MEAN_EARTH_RADIUS_M) * (RAD_TO_ARCSEC / 60);
  const diurnalAberrationArcsecPer100m =
    ((EARTH_ROTATION_RAD_PER_S * 100) / SPEED_OF_LIGHT_M_PER_S) * RAD_TO_ARCSEC;

  return {
    evidenceId: log.evidenceId,
    acquisition: {
      startedUtc: log.startedUtc,
      completedUtc: log.completedUtc,
      allHttp200: log.files.every((file) => file.httpStatus === 200),
      allHashesMatchBytes: log.files.every(
        (file) => createHash('sha256').update(read(file.name)).digest('hex') === file.sha256,
      ),
    },
    referencePoint: {
      source: 'OpenStreetMap node',
      id: Number(attribute(nodeElement, 'id')),
      version: Number(attribute(nodeElement, 'version')),
      changeset: Number(attribute(nodeElement, 'changeset')),
      timestamp: attribute(nodeElement, 'timestamp'),
      name,
      website,
      lat: point.lat,
      lon: point.lon,
    },
    siteExtent: {
      source: 'OpenStreetMap way',
      id: Number(attribute(wayElement, 'id')),
      version: Number(attribute(wayElement, 'version')),
      timestamp: attribute(wayElement, 'timestamp'),
      name: wayName,
      vertexCount: ring.length,
      closedRing: closed,
      allVerticesResolved: ring.every(Boolean),
      referencePointInside: pointInRing(point, ring),
      ownerCampusPointInside: pointInRing(ownerCampusPoint, ring),
      maxDistanceReferencePointToVertexMetres: Math.round(maxVertexDistance),
      siteDiameterMetres: Math.round(diameter),
    },
    ownerCampusPointCrossCheck: {
      point: ownerCampusPoint,
      distanceToReferencePointMetres: Math.round(haversineMetres(ownerCampusPoint, point)),
    },
    height: {
      orthometricMetres: elevation,
      orthometricSource: 'Open-Meteo elevation API (Copernicus DEM GLO-90)',
      egm2008UndulationMetres: egm2008,
      geoidEvalVersion,
      ellipsoidalMetres: Number((elevation + egm2008).toFixed(4)),
      relation: 'h = H + N (EGM2008 undulation above the WGS 84 ellipsoid)',
    },
    sensitivity: {
      localVerticalTiltArcminPerKmHorizontal: Number(horizontalSensitivityArcminPerKm.toFixed(3)),
      diurnalAberrationChangeArcsecPer100mHeight: Number(
        diurnalAberrationArcsecPer100m.toExponential(2),
      ),
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Usage: screen-observer-umpsa-pekan-v1.mjs <evidence-directory>');
  console.log(JSON.stringify(screen(resolve(directory)), null, 2));
}
