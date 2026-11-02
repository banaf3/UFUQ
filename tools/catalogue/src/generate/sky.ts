/**
 * Sky-explorer artifacts: the display-only background star field (every Hipparcos star
 * with Vmag <= 6.5 plus the fainter figure stars) and the modern IAU sky culture (88
 * constellation figures, IAU names, IAU WGSN star names). Visibly synthetic equivalents
 * are generated for tests. Nothing here is approved: real artifacts take their approval
 * from data/approvals like every other artifact.
 */
import { gunzipSync } from 'node:zlib';

import {
  type ApprovalRecord,
  type ArtifactEnvelope,
  canonicalJson,
  envelope,
  sha256Hex,
} from '../canonical-json.js';
import { parseHipMainCsv } from '../parsers/hipparcos-esa-1997.js';
import {
  arabicScriptFromEtymology,
  type BscRow,
  parseBscCatalog,
  parseConstellationLines,
  parseNaojConstellations,
  parseWgsnNames,
  type SkyFieldRow,
  skyFieldRow,
} from '../parsers/sky-sources.js';
import { loadApproval, type RawFileRecord, readJson, readVerified } from './profile-v1-data.js';

const SKY_MANIFEST = 'data/manifests/sky-catalogue-v1/acquisition-manifest.v1.json';
const SOURCE_JULIAN_EPOCH = 1991.25;
const EPOCH = {
  julianEpoch: SOURCE_JULIAN_EPOCH,
  scale: 'TT',
  julianDate: {
    part1: 2400000.5,
    part2: 2451545.0 - 2400000.5 + (SOURCE_JULIAN_EPOCH - 2000) * 365.25,
  },
  source: 'ESA SP-1200 Vol. 1 section 1.2.6',
} as const;
/** Largest accepted BSC-to-Hipparcos separation for the double-star fallback (arcsec). */
const POSITION_MATCH_LIMIT_ARCSEC = 120;

export const SKY_FIELD_COLUMNS = [
  'hip',
  'astrometry',
  'raRad',
  'decRad',
  'plxMas',
  'pmRaMasYr',
  'pmDeMasYr',
  'vmag',
  'bv',
] as const;

interface SkyManifest {
  readonly manifestId: string;
  readonly sources: Record<string, Record<string, string>>;
  readonly rawEvidence: { readonly files: (RawFileRecord & { role: string })[] };
}

function file(root: string, manifest: SkyManifest, role: string): Buffer {
  const record = manifest.rawEvidence.files.find((entry) => entry.role === role);
  if (!record) throw new Error(`Sky manifest lists no ${role}.`);
  return readVerified(root, record);
}

const round = (value: number) => Number(value.toPrecision(15));

function fieldRows(rows: readonly SkyFieldRow[]) {
  return rows.map((row) => [
    row.hip,
    row.astrometry,
    round(row.rightAscensionRadians),
    round(row.declinationRadians),
    row.parallaxMas,
    row.muAlphaStarMasPerYear,
    row.muDeltaMasPerYear,
    row.visualMagnitude,
    row.colorIndexBV,
  ]);
}

function separationArcsec(a: [number, number], b: [number, number]): number {
  const [ra1, de1] = a;
  const [ra2, de2] = b;
  const s =
    Math.sin((de2 - de1) / 2) ** 2 + Math.cos(de1) * Math.cos(de2) * Math.sin((ra2 - ra1) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s))) * (648000 / Math.PI);
}

export function generateSkyArtifacts(root: string): {
  field: ArtifactEnvelope<unknown>;
  culture: ArtifactEnvelope<unknown>;
} {
  const manifest = readJson<SkyManifest>(root, SKY_MANIFEST);
  const hipRows = [
    ...parseHipMainCsv(file(root, manifest, 'HIPPARCOS_NAKED_EYE_ROWS').toString('utf8')),
    ...parseHipMainCsv(
      file(root, manifest, 'HIPPARCOS_FIGURE_STARS_FAINTER_THAN_6_5').toString('utf8'),
    ),
  ];
  const stars = hipRows.map(skyFieldRow).sort((a, b) => a.hip - b.hip);
  if (new Set(stars.map((star) => star.hip)).size !== stars.length)
    throw new Error('Duplicate HIP in the sky field.');
  const byHip = new Map(stars.map((star) => [star.hip, star]));

  const fieldPayload = {
    policyId: 'SKY_DISPLAY_POLICY_V1',
    use: 'DISPLAY_ONLY_NEVER_ASSESSED',
    source: {
      manifestId: manifest.manifestId,
      catalogue: manifest.sources.hipparcos?.citation,
      selection:
        'Every hip_main star with Vmag <= 6.5, plus the fainter stars used by the IAU figures',
      licence: manifest.sources.hipparcos?.licence,
    },
    referenceFrame: 'ICRS',
    epoch: EPOCH,
    radialVelocity: 'OMITTED_DISPLAY_ONLY',
    columns: SKY_FIELD_COLUMNS,
    counts: {
      stars: stars.length,
      fullSolution: stars.filter((star) => star.astrometry === 'FULL_SOLUTION').length,
      coarsePositionNoSolution: stars.filter((star) => star.astrometry !== 'FULL_SOLUTION').length,
      nonPositiveParallax: stars.filter(
        (star) => star.astrometry === 'FULL_SOLUTION' && !(star.parallaxMas > 0),
      ).length,
    },
    stars: fieldRows(stars),
  };
  const fieldApproval = loadApproval(
    root,
    'sky-field-hipparcos1997-v1',
    sha256Hex(canonicalJson(fieldPayload)),
  ).approval;
  const field = envelope(
    'UFUQ_SKY_DISPLAY_FIELD',
    'sky-field-hipparcos1997-v1',
    '1',
    fieldPayload,
    fieldApproval,
  );

  // Figures: HR -> HD -> HIP, with a recorded position fallback for double stars.
  const bsc = parseBscCatalog(
    gunzipSync(file(root, manifest, 'BSC_CATALOG_FIXED_WIDTH_GZIP')).toString('latin1'),
  );
  const byHd = new Map<number, SkyFieldRow[]>();
  for (const star of stars) {
    if (star.henryDraperNumber === null) continue;
    byHd.set(star.henryDraperNumber, [...(byHd.get(star.henryDraperNumber) ?? []), star]);
  }
  const positionMatches: { hr: number; hip: number; separationArcsec: number }[] = [];
  const unmatched: number[] = [];
  const hipForHr = (hr: number): number | null => {
    const row = bsc.get(hr) as BscRow | undefined;
    if (!row) return null;
    const byHdMatches = row.hd === null ? [] : (byHd.get(row.hd) ?? []);
    if (byHdMatches.length === 1) return (byHdMatches[0] as SkyFieldRow).hip;
    if (row.rightAscensionRadians === null || row.declinationRadians === null) return null;
    const target: [number, number] = [row.rightAscensionRadians, row.declinationRadians];
    let best: { hip: number; separation: number } | null = null;
    for (const star of stars) {
      const separation = separationArcsec(target, [
        star.rightAscensionRadians,
        star.declinationRadians,
      ]);
      if (separation <= POSITION_MATCH_LIMIT_ARCSEC && (!best || separation < best.separation))
        best = { hip: star.hip, separation };
    }
    if (!best) return null;
    positionMatches.push({
      hr,
      hip: best.hip,
      separationArcsec: Number(best.separation.toFixed(1)),
    });
    return best.hip;
  };
  const lines = parseConstellationLines(
    file(root, manifest, 'CONSTELLATION_LINES_CC_BY_4_0').toString('utf8'),
  );
  const names = parseNaojConstellations(
    file(root, manifest, 'IAU_CONSTELLATION_NAMES_TABLE').toString('utf8'),
  );
  const hipCache = new Map<number, number | null>();
  const figures = new Map<string, number[][]>();
  for (const line of lines) {
    if (!names.has(line.abbreviation))
      throw new Error(`Line abbreviation ${line.abbreviation} is not an IAU constellation.`);
    const hips = line.hr.map((hr) => {
      if (!hipCache.has(hr)) {
        const hip = hipForHr(hr);
        if (hip === null) unmatched.push(hr);
        hipCache.set(hr, hip);
      }
      return hipCache.get(hr) ?? null;
    });
    // Break the polyline at an unmatched star rather than invent a connection.
    let run: number[] = [];
    const runs: number[][] = [];
    for (const hip of hips) {
      if (hip === null) {
        if (run.length > 1) runs.push(run);
        run = [];
      } else run.push(hip);
    }
    if (run.length > 1) runs.push(run);
    figures.set(line.abbreviation, [...(figures.get(line.abbreviation) ?? []), ...runs]);
  }
  const constellations = [...names.entries()]
    .map(([abbreviation, name]) => ({
      abbreviation,
      name,
      polylines: figures.get(abbreviation) ?? [],
    }))
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
  const wgsn = parseWgsnNames(file(root, manifest, 'IAU_WGSN_STAR_NAMES_PAGE').toString('utf8'));
  const starNames = wgsn
    .filter((entry) => byHip.has(entry.hip))
    .map((entry) => ({
      ...entry,
      arabicScriptFromEtymology:
        entry.language === 'Arabic' ? arabicScriptFromEtymology(entry.origin) : null,
    }))
    .sort((a, b) => a.hip - b.hip || a.name.localeCompare(b.name));
  const culturePayload = {
    cultureId: 'iau-modern',
    title: 'Modern IAU constellations',
    layer: 'MODERN_ASTRONOMICAL',
    starFieldArtifact: { artifactId: field.artifactId, payloadSha256: field.payloadSha256 },
    sources: {
      lines: manifest.sources.constellationLines,
      constellationNames: manifest.sources.constellationNames,
      starNames: manifest.sources.starNames,
      crossReference: manifest.sources.brightStarCatalogue,
    },
    crossmatch: {
      method:
        'BSC HR -> HD -> Hipparcos HD; a position match within 120 arcsec only when HD gives no single star',
      positionMatches: positionMatches.sort((a, b) => a.hr - b.hr),
      unmatchedHr: [...new Set(unmatched)].sort((a, b) => a - b),
    },
    constellations,
    starNames,
  };
  const cultureApproval = loadApproval(
    root,
    'sky-culture-iau-v1',
    sha256Hex(canonicalJson(culturePayload)),
  ).approval;
  const culture = envelope(
    'UFUQ_SKY_CULTURE',
    'sky-culture-iau-v1',
    '1',
    culturePayload,
    cultureApproval,
  );
  return { field, culture };
}

/** Deterministic pseudo-random generator for the synthetic field (mulberry32). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Visibly synthetic background field (400 invented stars, magnitudes 3.6 to 6.5) and a
 * synthetic culture with two invented figures and names. Never the real sky.
 */
export function generateSyntheticSkyArtifacts(approval: ApprovalRecord): {
  field: ArtifactEnvelope<unknown>;
  culture: ArtifactEnvelope<unknown>;
} {
  const random = mulberry32(20261102);
  const stars: SkyFieldRow[] = Array.from({ length: 400 }, (_, index) => {
    const ra = random() * 2 * Math.PI;
    const dec = Math.asin(2 * random() - 1);
    return {
      hip: 900001 + index,
      astrometry: 'FULL_SOLUTION',
      rightAscensionRadians: ra,
      declinationRadians: dec,
      parallaxMas: Number((1 + random() * 50).toFixed(2)),
      muAlphaStarMasPerYear: 0,
      muDeltaMasPerYear: 0,
      visualMagnitude: Number((3.6 + random() * 2.9).toFixed(2)),
      colorIndexBV: Number((-0.2 + random() * 1.9).toFixed(2)),
      henryDraperNumber: null,
    };
  });
  const fieldPayload = {
    policyId: 'SKY_DISPLAY_POLICY_V1',
    use: 'DISPLAY_ONLY_NEVER_ASSESSED',
    source: { note: 'SYNTHETIC TECHNICAL FIXTURE: invented background stars, not the real sky.' },
    referenceFrame: 'ICRS',
    epoch: EPOCH,
    radialVelocity: 'OMITTED_DISPLAY_ONLY',
    columns: SKY_FIELD_COLUMNS,
    counts: {
      stars: stars.length,
      fullSolution: stars.length,
      coarsePositionNoSolution: 0,
      nonPositiveParallax: 0,
    },
    stars: fieldRows(stars),
  };
  const field = envelope(
    'UFUQ_SKY_DISPLAY_FIELD',
    'synthetic-sky-field-v1',
    '1',
    fieldPayload,
    approval,
  );
  const figure = (offset: number) => [
    900001 + offset,
    900002 + offset,
    900003 + offset,
    900004 + offset,
  ];
  const culturePayload = {
    cultureId: 'synthetic-culture',
    title: 'Synthetic culture (technical fixture)',
    layer: 'SYNTHETIC_TECHNICAL',
    starFieldArtifact: { artifactId: field.artifactId, payloadSha256: field.payloadSha256 },
    sources: { note: 'SYNTHETIC TECHNICAL FIXTURE' },
    crossmatch: { method: 'NONE', positionMatches: [], unmatchedHr: [] },
    constellations: [
      { abbreviation: 'Sya', name: 'Synthetic Alpha', polylines: [figure(0)] },
      { abbreviation: 'Syb', name: 'Synthetic Beta', polylines: [figure(10)] },
    ],
    starNames: [
      {
        hip: 900001,
        name: 'Synthetica',
        designation: 'synthetic',
        constellation: 'Sya',
        language: 'Synthetic',
        origin: 'Invented name for a synthetic technical fixture.',
        arabicScriptFromEtymology: null,
      },
    ],
  };
  const culture = envelope(
    'UFUQ_SKY_CULTURE',
    'synthetic-sky-culture-v1',
    '1',
    culturePayload,
    approval,
  );
  return { field, culture };
}
