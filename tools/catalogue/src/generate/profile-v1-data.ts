/**
 * Milestone 2E deterministic generation of the ScientificProfileV1 runtime artifacts
 * from the hash-verified 2D raw evidence. Every raw file is checked against its 2D
 * manifest before parsing; any mismatch, schema drift, or gate C difference aborts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  type ApprovalRecord,
  type ArtifactEnvelope,
  canonicalJson,
  envelope,
  REVIEW_REQUIRED_PROFILE_V1,
  sha256Hex,
} from '../canonical-json.js';
import {
  type GateCExpectation,
  normalizeHipMainRow,
  parseHipMainCsv,
  radialVelocityOmissionBound,
  verifyGateC,
} from '../parsers/hipparcos-esa-1997.js';
import {
  type BulletinBRow,
  bulletinCConsistency,
  parseBulletinBSection1,
  parseBulletinC,
  parseNtpLeapList,
} from '../parsers/iers.js';

export interface RepositoryPaths {
  readonly root: string;
}

export interface RawFileRecord {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly role?: string;
}

export function readJson<T>(root: string, path: string): T {
  return JSON.parse(readFileSync(join(root, path), 'utf8')) as T;
}

/** Reads a raw evidence file and verifies its byte length and SHA-256. */
export function readVerified(root: string, record: RawFileRecord): Buffer {
  const bytes = readFileSync(join(root, record.path));
  const digest = sha256Hex(bytes);
  if (bytes.byteLength !== record.byteLength || digest !== record.sha256) {
    throw new Error(`Raw evidence ${record.path} does not match its manifest hash.`);
  }
  return bytes;
}

/** Approval records live in data/approvals/<artifactId>.approval.v1.json. */
export function loadApproval(
  root: string,
  artifactId: string,
  payloadSha256: string,
): { approval: ApprovalRecord; fieldApprovals?: Record<string, ApprovalRecord> } {
  const path = join(root, 'data', 'approvals', `${artifactId}.approval.v1.json`);
  if (!existsSync(path)) return { approval: REVIEW_REQUIRED_PROFILE_V1 };
  const record = JSON.parse(readFileSync(path, 'utf8')) as {
    approvalType: string;
    artifactId: string;
    payloadSha256: string;
    approval: ApprovalRecord;
    fieldApprovals?: Record<string, ApprovalRecord>;
  };
  if (
    record.approvalType !== 'UFUQ_SCIENTIFIC_APPROVAL_RECORD' ||
    record.artifactId !== artifactId
  ) {
    throw new Error(`Approval record ${path} is malformed.`);
  }
  if (record.payloadSha256 !== payloadSha256) {
    throw new Error(
      `Approval record ${path} is stale: it approves payload ${record.payloadSha256}.`,
    );
  }
  const named = [record.approval, ...Object.values(record.fieldApprovals ?? {})];
  for (const approval of named) {
    if (
      approval.state === 'APPROVED' &&
      (!approval.reviewer || !approval.decisionDate || !approval.decisionReference)
    ) {
      throw new Error(
        `Approval record ${path} lacks a named reviewer, date, or decision reference.`,
      );
    }
  }
  return record.fieldApprovals === undefined
    ? { approval: record.approval }
    : { approval: record.approval, fieldApprovals: record.fieldApprovals };
}

function withApproval<P>(
  root: string,
  artifactType: string,
  artifactId: string,
  payload: P,
  fieldNames?: readonly string[],
): ArtifactEnvelope<P> {
  const payloadSha256 = sha256Hex(canonicalJson(payload));
  const { approval, fieldApprovals } = loadApproval(root, artifactId, payloadSha256);
  const fields =
    fieldNames === undefined
      ? undefined
      : Object.fromEntries(fieldNames.map((name) => [name, fieldApprovals?.[name] ?? approval]));
  return envelope(artifactType, artifactId, '1', payload, approval, fields);
}

const HIPPARCOS_MANIFEST =
  'data/manifests/hipparcos-esa-1997-hip-screen-v1/acquisition-manifest.v1.json';
const LEAP_EOP_MANIFEST = 'data/manifests/iers-leap-eop-v1/acquisition-manifest.v1.json';
const OBSERVER_MANIFEST = 'data/manifests/observer-umpsa-pekan-v1/acquisition-manifest.v1.json';
const CROSSWALK = 'data/curation/stars/route-star-crosswalk.v1.json';
const SOURCE_JULIAN_EPOCH = 1991.25;
const RV_BOUND_HORIZON = 2040.0;

/** Route-star astrometry (Hipparcos 1997, Amendment A1). Tracked: CC BY-NC 3.0 IGO with credit. */
export function generateRouteStars(root: string) {
  const manifest = readJson<{
    manifestId: string;
    release: Record<string, string>;
    rawEvidence: { files: RawFileRecord[] };
  }>(root, HIPPARCOS_MANIFEST);
  const csvRecord = manifest.rawEvidence.files.find((file) =>
    file.path.endsWith('hip-main-source.csv'),
  );
  if (!csvRecord) throw new Error('Hipparcos manifest lists no hip-main-source.csv.');
  const rows = parseHipMainCsv(readVerified(root, csvRecord).toString('utf8'));
  const crosswalk = readJson<{
    crosswalkId: string;
    stars: { starId: string; source: string; hip: number; gateC: Omit<GateCExpectation, 'hip'> }[];
  }>(root, CROSSWALK);
  const byHip = new Map(rows.map((row) => [Number(row.HIP), row]));
  const stars = crosswalk.stars.map((entry) => {
    const row = byHip.get(entry.hip);
    if (row === undefined)
      throw new Error(`Crosswalk HIP ${entry.hip} is absent from the response.`);
    verifyGateC(row, { hip: entry.hip, ...entry.gateC });
    const normalized = normalizeHipMainRow(row);
    if (!(normalized.parallaxMas > 0)) throw new Error(`HIP ${entry.hip} has no usable parallax.`);
    return {
      starId: entry.starId,
      crosswalk: {
        source: entry.source,
        hip: entry.hip,
        henryDraper: normalized.henryDraperNumber,
      },
      native: row,
      normalized: {
        rightAscensionDegrees: normalized.rightAscensionDegrees,
        declinationDegrees: normalized.declinationDegrees,
        rightAscensionRadians: normalized.rightAscensionRadians,
        declinationRadians: normalized.declinationRadians,
        parallaxMas: normalized.parallaxMas,
        muAlphaStarMasPerYear: normalized.muAlphaStarMasPerYear,
        muDeltaMasPerYear: normalized.muDeltaMasPerYear,
        standardErrors: normalized.standardErrors,
        covariance: normalized.covariance,
        visualMagnitude: normalized.visualMagnitude,
      },
      radialVelocity: {
        state: 'RADIAL_VELOCITY_OMITTED_WITH_BOUND',
        omittedTerm: 'SECOND_ORDER_PERSPECTIVE_ACCELERATION',
        boundMilliarcsecondsPerKmPerSecond: radialVelocityOmissionBound(
          normalized,
          SOURCE_JULIAN_EPOCH,
          RV_BOUND_HORIZON,
        ),
        boundHorizonJulianEpoch: RV_BOUND_HORIZON,
        evidenceId: 'data/manifests/hipparcos-esa-1997-hip-screen-v1/',
      },
    };
  });
  const payload = {
    profileId: 'ScientificProfileV1',
    crosswalkId: crosswalk.crosswalkId,
    source: {
      manifestId: manifest.manifestId,
      catalogue: manifest.release.catalogue,
      table: manifest.release.table,
      citation: manifest.release.citation,
      credit: 'Credit: ESA',
      licence: 'CC BY-NC 3.0 IGO',
      useDecision:
        'Noncommercial academic derived artifact, tracked and deployable with credit (2D.1D)',
      rawFiles: [
        { path: csvRecord.path, byteLength: csvRecord.byteLength, sha256: csvRecord.sha256 },
      ],
    },
    epoch: {
      nativeNotation: 'J1991.25(TT)',
      julianEpoch: SOURCE_JULIAN_EPOCH,
      scale: 'TT',
      julianDate: {
        part1: 2400000.5,
        part2: 2451545.0 - 2400000.5 + (SOURCE_JULIAN_EPOCH - 2000) * 365.25,
      },
      source: 'ESA SP-1200 Vol. 1 section 1.2.6',
    },
    referenceFrame: 'ICRS',
    properMotionConvention: {
      raComponent: 'MU_ALPHA_STAR',
      durationUnit: 'JULIAN_YEAR',
      derivativeScale: 'TT',
      tdbRateAdapter: 'TT_RATE_EQUALS_TDB_RATE_IAU2006_B3',
    },
    stars,
  };
  return withApproval(root, 'UFUQ_ROUTE_STAR_ASTROMETRY', 'route-stars-hipparcos1997-v1', payload);
}

interface LeapEopManifest {
  manifestId: string;
  selection: {
    leapTransport: { file: string; url: string };
    eopSeries: { bulletinBIssues: number[]; seriesLabel: string };
    restorationSource: Record<string, unknown>;
  };
  rawEvidence: { files: RawFileRecord[] };
}

function rawByName(manifest: LeapEopManifest, name: string): RawFileRecord {
  const record = manifest.rawEvidence.files.find((file) => file.path.endsWith(`/${name}`));
  if (!record) throw new Error(`Leap/EOP manifest lists no ${name}.`);
  return record;
}

/** Leap-second state (IERS NTP transport, Bulletin C authority). Tracked: public domain. */
export function generateLeapState(root: string) {
  const manifest = readJson<LeapEopManifest>(root, LEAP_EOP_MANIFEST);
  const transport = rawByName(manifest, manifest.selection.leapTransport.file);
  const list = parseNtpLeapList(readVerified(root, transport).toString('latin1'));
  if (list.publisherIntegrity !== 'VERIFIED')
    throw new Error('Leap list publisher SHA-1 mismatch.');
  const bulletins = manifest.rawEvidence.files
    .filter((file) => /\/bulletinc\.\d+$/.test(file.path))
    .map((file) => parseBulletinC(readVerified(root, file).toString('latin1')))
    .sort((a, b) => a.issue - b.issue);
  const consistency = bulletinCConsistency(list, bulletins);
  if (consistency !== 'CONSISTENT') throw new Error('Leap list is inconsistent with Bulletin C.');
  const payload = {
    authority: 'IERS Bulletin C',
    transport: {
      file: manifest.selection.leapTransport.file,
      url: manifest.selection.leapTransport.url,
      byteLength: transport.byteLength,
      sha256: transport.sha256,
      updateNtp: list.updateNtp,
      expiryNtp: list.expiryNtp,
      publisherSha1: list.declaredSha1,
      publisherIntegrity: list.publisherIntegrity,
      publicDomainStatement: list.publicDomainStatement,
    },
    bulletinC: {
      issues: bulletins.map((bulletin) => bulletin.issue),
      consistency,
    },
    expiryMjd: list.expiryMjd,
    transitions: list.transitions,
    manifestId: manifest.manifestId,
  };
  return withApproval(root, 'UFUQ_LEAP_SECOND_STATE', 'leap-seconds-iers-v1', payload);
}

/**
 * Bulletin B 453-461 final daily EOP bundle. LOCAL ONLY: IERS redistribution terms for
 * Bulletin B values are unconfirmed, so this artifact is written to the ignored
 * data/generated/local-only/ directory.
 */
export function generateEopBundle(root: string) {
  const manifest = readJson<LeapEopManifest>(root, LEAP_EOP_MANIFEST);
  const issues = manifest.selection.eopSeries.bulletinBIssues;
  const sections = issues.map((issue) =>
    parseBulletinBSection1(
      readVerified(root, rawByName(manifest, `bulletinb.${issue}`)).toString('latin1'),
    ),
  );
  const label = manifest.selection.eopSeries.seriesLabel;
  for (const section of sections) {
    if (section.seriesLabel !== label) {
      throw new Error(
        `Bulletin B ${section.issue} series label "${section.seriesLabel}" breaks the coherent series.`,
      );
    }
  }
  const samples: { issue: number; row: BulletinBRow }[] = sections.flatMap((section) =>
    section.finals.map((row) => ({ issue: section.issue, row })),
  );
  samples.forEach((sample, index) => {
    if (
      index > 0 &&
      sample.row.mjd !== (samples[index - 1] as (typeof samples)[number]).row.mjd + 1
    ) {
      throw new Error(`Bulletin B final series is not contiguous at MJD ${sample.row.mjd}.`);
    }
  });
  const uncertainty = (value: number, unit: 'MILLIARCSECOND' | 'MILLISECOND') => ({
    value,
    unit,
    meaning: 'Bulletin B Section 1 formal error (source-declared)',
  });
  const seriesId = `iers-bulletin-b-${issues[0]}-${issues.at(-1)}-itrf2014`;
  const payload = {
    sourceProductId: 'IERS_BULLETIN_B_SECTION1_FINAL',
    coherentSeries: { seriesId, label, issues },
    restorationConfigurationId:
      'IERS_CONVENTIONS_2010_V1_0_0_ORTHO_EOP_PMSDNUT2_IBAND1_UTLIBR_TT_ARGUMENT_V1',
    publisherValidity: 'NOT_DECLARED',
    manifestId: manifest.manifestId,
    rawFiles: issues.map((issue) => {
      const record = rawByName(manifest, `bulletinb.${issue}`);
      return { path: record.path, byteLength: record.byteLength, sha256: record.sha256 };
    }),
    samples: samples.map(({ issue, row }) => {
      const [x, y, ut1, , , xErr, yErr, ut1Err] = row.values as number[];
      return {
        sampleId: `bulletinb.${issue}#${row.mjd}`,
        mjdUtc: row.mjd,
        seriesId,
        fields: {
          UT1_MINUS_UTC: {
            nativeValue: ut1,
            quality: 'FINAL',
            uncertainty: uncertainty(ut1Err as number, 'MILLISECOND'),
          },
          XP: {
            nativeValue: x,
            quality: 'FINAL',
            uncertainty: uncertainty(xErr as number, 'MILLIARCSECOND'),
          },
          YP: {
            nativeValue: y,
            quality: 'FINAL',
            uncertainty: uncertainty(yErr as number, 'MILLIARCSECOND'),
          },
        },
      };
    }),
  };
  return withApproval(root, 'UFUQ_EOP_DAILY_BUNDLE', 'eop-bulletinb-453-461-v1', payload, [
    'UT1_MINUS_UTC',
    'XP',
    'YP',
  ]);
}

interface ObserverCandidate {
  presetId: string;
  displayLabel: string;
  siteIdentity: string;
  referencePointDescription: string;
  geodeticLatitude: { value: number };
  geodeticLongitude: { value: number };
  referenceSystem: { id: string };
  coordinateReferenceEpoch: { basis: string };
  height: { kind: string; value: number };
  heightConversion: unknown;
  coordinateAccuracy: { horizontal: { upperBoundMetres: number; meaning: string; method: string } };
  provenance: { referencePoint: string; orthometricHeight: string; geoidUndulation: string };
}

/** Observer preset (2D.3 candidate). Tracked: one derived point with OSM attribution. */
export function generateObserver(root: string) {
  const manifest = readJson<{
    manifestId: string;
    candidatePreset: ObserverCandidate;
    rawEvidence: { files: RawFileRecord[] };
  }>(root, OBSERVER_MANIFEST);
  for (const file of manifest.rawEvidence.files) {
    if (existsSync(join(root, file.path))) readVerified(root, file);
  }
  const c = manifest.candidatePreset;
  if (c.referenceSystem.id !== 'WGS 84' || c.height.kind !== 'ELLIPSOIDAL') {
    throw new Error('Observer candidate is not a WGS 84 ellipsoidal record.');
  }
  const payload = {
    schemaVersion: 1,
    presetId: c.presetId,
    displayLabel: c.displayLabel,
    siteIdentity: c.siteIdentity,
    referencePointDescription: c.referencePointDescription,
    geodeticLatitudeDegrees: c.geodeticLatitude.value,
    geodeticLongitudeDegrees: c.geodeticLongitude.value,
    referenceSystem: { kind: 'GEODETIC_DATUM', identifier: 'WGS 84', realization: null },
    referenceEllipsoid: {
      ellipsoidId: 'WGS 84',
      equatorialRadiusMetres: 6378137.0,
      inverseFlattening: 298.257223563,
      source: 'WGS 84 defining parameters (NIMA TR8350.2), as in SOFA 2023-10-11 eform',
    },
    coordinateReferenceEpoch: {
      state: 'NOT_REQUIRED',
      basis: `Proposed 2D.3 disposition, accepted only through this artifact's approval: ${c.coordinateReferenceEpoch.basis}`,
    },
    height: { kind: 'ELLIPSOIDAL', valueMetres: c.height.value, ellipsoidId: 'WGS 84' },
    heightConversion: c.heightConversion,
    coordinateAccuracy: {
      horizontal: {
        state: 'DERIVED',
        boundMetres: c.coordinateAccuracy.horizontal.upperBoundMetres,
        meaning: c.coordinateAccuracy.horizontal.meaning,
        method: c.coordinateAccuracy.horizontal.method,
      },
      vertical: {
        state: 'UNKNOWN_UNBOUNDED',
        reason: 'DEM surface-model cell; no vertical bound for the Faculty point',
      },
    },
    provenance: [
      c.provenance.referencePoint,
      c.provenance.orthometricHeight,
      c.provenance.geoidUndulation,
      'Data © OpenStreetMap contributors, ODbL 1.0',
      `Evidence manifest ${manifest.manifestId}`,
    ],
    dataVersionId: manifest.manifestId,
  };
  return withApproval(root, 'UFUQ_OBSERVER_PRESET', 'observer-umpsa-pekan-v1', payload);
}

function mjdToCanonicalUtc(mjd: number): string {
  const date = new Date((mjd - 40587) * 86400000);
  return `${date.toISOString().slice(0, 19)}Z`;
}

/**
 * Profile activation: the SupportedTimeDomain is the intersection of four-point EOP
 * support for all three fields, leap validity, the epv00 1900-2100 range, and the
 * Amendment A1 bound horizon. Tracked: it contains only dates and identities.
 */
export function generateSupportedTimeDomain(
  root: string,
  eop: ArtifactEnvelope<{ samples: { mjdUtc: number }[] }>,
  leap: ArtifactEnvelope<{ expiryMjd: number }>,
  stars: ArtifactEnvelope<unknown>,
  observer: ArtifactEnvelope<unknown>,
) {
  const samples = eop.payload.samples;
  const firstMjd = (samples[0] as { mjdUtc: number }).mjdUtc;
  const lastMjd = (samples.at(-1) as { mjdUtc: number }).mjdUtc;
  // Full support i-1..i+2: earliest supported instant is sample 1 (inclusive); the
  // latest is strictly before the second-to-last sample.
  const eopEarliest = firstMjd + 1;
  const eopLatestExclusive = lastMjd - 1;
  const leapLatestExclusive = leap.payload.expiryMjd;
  const epvLatestExclusive = 88069; // 2100-01-01
  const a1LatestExclusive = 66154; // J2040.0 = 2040-01-01T12:00 TT; 2040-01-01 0h UTC bound
  const latestExclusive = Math.min(
    eopLatestExclusive,
    leapLatestExclusive,
    epvLatestExclusive,
    a1LatestExclusive,
  );
  const earliest = Math.max(eopEarliest, 15020); // epv00 lower range 1900-01-01
  if (!(earliest < latestExclusive)) throw new Error('Supported time domain is empty.');
  const payload = {
    profileId: 'ScientificProfileV1',
    executionScope: 'SCIENTIFIC_PROFILE_V1',
    domainVersion: `time-domain-profile-v1-${mjdToCanonicalUtc(earliest).slice(0, 10)}-${mjdToCanonicalUtc(latestExclusive).slice(0, 10)}`,
    earliest: { canonicalUtc: mjdToCanonicalUtc(earliest), boundary: 'INCLUSIVE' },
    latest: { canonicalUtc: mjdToCanonicalUtc(latestExclusive), boundary: 'EXCLUSIVE' },
    inputResolution: 'WHOLE_SECOND',
    contributingDomainIdentities: [
      `EOP four-point support ${mjdToCanonicalUtc(eopEarliest)} inclusive to ${mjdToCanonicalUtc(eopLatestExclusive)} exclusive (${eop.artifactId} ${eop.payloadSha256})`,
      `Leap validity before ${mjdToCanonicalUtc(leapLatestExclusive)} (${leap.artifactId} ${leap.payloadSha256})`,
      'epv00-derived model status 0 for 1900-2100',
      `Amendment A1 bound horizon J2040.0 (${stars.artifactId} ${stars.payloadSha256})`,
      `Observer preset has no time limit (${observer.artifactId} ${observer.payloadSha256})`,
    ],
    requiredLeapAndEopPolicyIdentities: [
      'ScientificProfileV1 final-only leap/EOP policy (2C.6)',
      'LAGRANGE_FOUR_POINT_V1 via continuous UT1-TAI',
      'IERS_CONVENTIONS_2010_V1_0_0_ORTHO_EOP_PMSDNUT2_IBAND1_UTLIBR_TT_ARGUMENT_V1',
    ],
    requiredArtifactManifestIdentities: [
      eop.payloadSha256,
      leap.payloadSha256,
      stars.payloadSha256,
      observer.payloadSha256,
    ],
    requiredFieldCoverage: ['UT1_MINUS_UTC', 'XP', 'YP'],
    interpolationSupportRequirements:
      'Samples i-1, i, i+1, i+2 for every field, contiguous, FINAL, one coherent series',
    derivationMethodAndVersion: 'tools/catalogue generateSupportedTimeDomain v1',
  };
  return withApproval(root, 'UFUQ_SUPPORTED_TIME_DOMAIN', 'time-domain-profile-v1', payload);
}
