/**
 * Loads generated runtime artifacts from disk, verifies each canonical payload hash, and
 * maps them to astronomy-core domain states. A missing file maps to UNAVAILABLE and a
 * hash or structure failure to INTEGRITY_FAILURE; neither is ever replaced by a default.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  ApprovedLeapState,
  CatalogueStarState,
  EopBundle,
  EopDailySample,
  ObserverPreset,
  DisplayStarInput,
  ScientificApproval,
  SkyDisplayField,
  SupportedTimeDomain,
} from '@ufuq/astronomy-core';
import {
  type LessonContentPayload,
  type RuntimeArtifactEnvelope,
  validateArtifactEnvelope,
  validateLessonContent,
} from '@ufuq/catalogue-schema';
import {
  type LearningConfigurationPayload,
  validateLearningConfiguration,
} from '@ufuq/tutoring-core';

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

export interface LoadedArtifact<T> {
  readonly status: 'AVAILABLE' | 'UNAVAILABLE' | 'INTEGRITY_FAILURE';
  readonly artifactId: string;
  readonly approvalState: string;
  /** The approval's own scope (SCIENTIFIC_PROFILE_V1 or SYNTHETIC_TECHNICAL_FIXTURE). */
  readonly approvalScope?: string;
  readonly payloadSha256: string | null;
  readonly value?: T;
  readonly reason?: string;
}

function loadEnvelope(path: string, type: string): LoadedArtifact<RuntimeArtifactEnvelope> {
  const artifactId = path.replace(/^.*[\\/]/, '').replace(/\.json$/, '');
  if (!existsSync(path)) {
    return {
      status: 'UNAVAILABLE',
      artifactId,
      approvalState: 'UNAVAILABLE',
      payloadSha256: null,
      reason: 'File absent.',
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {
      status: 'INTEGRITY_FAILURE',
      artifactId,
      approvalState: 'UNKNOWN',
      payloadSha256: null,
      reason: 'Not JSON.',
    };
  }
  const result = validateArtifactEnvelope(parsed, type, sha256);
  if (!result.ok) {
    return {
      status: 'INTEGRITY_FAILURE',
      artifactId,
      approvalState: 'UNKNOWN',
      payloadSha256: null,
      reason: result.reason,
    };
  }
  return {
    status: 'AVAILABLE',
    artifactId: result.envelope.artifactId,
    approvalState: result.envelope.approval.state,
    approvalScope: result.envelope.approval.scope,
    payloadSha256: result.envelope.payloadSha256,
    value: result.envelope,
  };
}

function identity(envelope: RuntimeArtifactEnvelope) {
  return {
    artifactId: envelope.artifactId,
    artifactVersion: envelope.artifactVersion,
    payloadSha256: envelope.payloadSha256,
  };
}

function approval(record: RuntimeArtifactEnvelope['approval']): ScientificApproval {
  return { ...record };
}

function mapped<T>(
  loaded: LoadedArtifact<RuntimeArtifactEnvelope>,
  map: (envelope: RuntimeArtifactEnvelope) => T,
): LoadedArtifact<T> {
  if (loaded.status !== 'AVAILABLE' || loaded.value === undefined)
    return { ...loaded, value: undefined } as LoadedArtifact<T>;
  try {
    return { ...loaded, value: map(loaded.value) };
  } catch (error) {
    return {
      ...loaded,
      status: 'INTEGRITY_FAILURE',
      value: undefined,
      reason: String(error),
    } as LoadedArtifact<T>;
  }
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError(`${label} must be a finite number.`);
  return value;
}

type StarPayload = {
  epoch: { nativeNotation: string; julianDate: { part1: number; part2: number } };
  stars: {
    starId: string;
    crosswalk: { source: string; hip: number | null };
    normalized: {
      rightAscensionRadians: number;
      declinationRadians: number;
      parallaxMas: number;
      muAlphaStarMasPerYear: number;
      muDeltaMasPerYear: number;
      visualMagnitude: number | null;
    };
    radialVelocity: {
      state: 'RADIAL_VELOCITY_OMITTED_WITH_BOUND';
      boundMilliarcsecondsPerKmPerSecond: number;
      boundHorizonJulianEpoch: number;
      evidenceId: string;
    };
  }[];
};

export function mapStars(envelope: RuntimeArtifactEnvelope): Map<string, CatalogueStarState> {
  const payload = envelope.payload as StarPayload;
  const stars = new Map<string, CatalogueStarState>();
  for (const star of payload.stars) {
    if (star.radialVelocity.state !== 'RADIAL_VELOCITY_OMITTED_WITH_BOUND') {
      throw new TypeError(`Star ${star.starId} has an unsupported radial-velocity state.`);
    }
    stars.set(star.starId, {
      starId: star.starId,
      sourceRecordId:
        star.crosswalk.hip === null
          ? `${star.crosswalk.source}:${star.starId}`
          : `${star.crosswalk.source}:HIP ${star.crosswalk.hip}`,
      rightAscensionRadians: requireNumber(star.normalized.rightAscensionRadians, 'RA'),
      declinationRadians: requireNumber(star.normalized.declinationRadians, 'Dec'),
      epoch: {
        nativeNotation: payload.epoch.nativeNotation,
        scale: 'TT',
        julianDate: {
          scale: 'TT',
          splitConvention: 'MJD_ZERO_PLUS_OFFSET',
          part1: requireNumber(payload.epoch.julianDate.part1, 'epoch part1'),
          part2: requireNumber(payload.epoch.julianDate.part2, 'epoch part2'),
        },
      },
      properMotion: {
        muAlphaStarMasPerYear: requireNumber(star.normalized.muAlphaStarMasPerYear, 'pmRA'),
        muDeltaMasPerYear: requireNumber(star.normalized.muDeltaMasPerYear, 'pmDE'),
        durationUnit: 'JULIAN_YEAR',
        derivativeScale: 'TT',
      },
      parallax: {
        state: 'APPROVED_USABLE_DISTANCE',
        parallaxMas: requireNumber(star.normalized.parallaxMas, 'Plx'),
      },
      radialVelocity: {
        state: 'RADIAL_VELOCITY_OMITTED_WITH_BOUND',
        omittedTerm: 'SECOND_ORDER_PERSPECTIVE_ACCELERATION',
        boundMilliarcsecondsPerKmPerSecond: star.radialVelocity.boundMilliarcsecondsPerKmPerSecond,
        boundHorizonJulianEpoch: star.radialVelocity.boundHorizonJulianEpoch,
        evidenceId: star.radialVelocity.evidenceId,
      },
      visualMagnitude: star.normalized.visualMagnitude,
      identity: identity(envelope),
      availability: 'AVAILABLE',
      approval: approval(envelope.approval),
    });
  }
  return stars;
}

export function mapLeap(envelope: RuntimeArtifactEnvelope): ApprovedLeapState {
  const payload = envelope.payload as {
    transport: { publisherIntegrity: 'VERIFIED' | 'MISMATCH' };
    bulletinC: { consistency: 'CONSISTENT' | 'INCONSISTENT' };
    expiryMjd: number;
    transitions: { effectiveMjd: number; taiMinusUtcSeconds: number }[];
  };
  return {
    identity: identity(envelope),
    availability: 'AVAILABLE',
    publisherIntegrity: payload.transport.publisherIntegrity,
    bulletinCConsistency: payload.bulletinC.consistency,
    expiryMjd: requireNumber(payload.expiryMjd, 'expiryMjd'),
    transitions: payload.transitions.map((t) => ({
      effectiveMjd: requireNumber(t.effectiveMjd, 'effectiveMjd'),
      taiMinusUtcSeconds: requireNumber(t.taiMinusUtcSeconds, 'taiMinusUtcSeconds'),
    })),
    approval: approval(envelope.approval),
  };
}

export function mapEop(envelope: RuntimeArtifactEnvelope): EopBundle {
  const payload = envelope.payload as {
    sourceProductId: string;
    coherentSeries: { seriesId: string };
    restorationConfigurationId: string;
    publisherValidity: 'NOT_DECLARED';
    samples: EopDailySample[];
  };
  const fields = envelope.fieldApprovals;
  const policy = (name: 'UT1_MINUS_UTC' | 'XP' | 'YP') => {
    const record = fields?.[name];
    if (record === undefined) throw new TypeError(`EOP field approval ${name} missing.`);
    return { approval: approval(record), publisherValidity: payload.publisherValidity };
  };
  return {
    identity: identity(envelope),
    availability: 'AVAILABLE',
    sourceProductId: payload.sourceProductId,
    coherentSeriesId: payload.coherentSeries.seriesId,
    restorationConfigurationId: payload.restorationConfigurationId,
    fieldPolicies: { UT1_MINUS_UTC: policy('UT1_MINUS_UTC'), XP: policy('XP'), YP: policy('YP') },
    samples: payload.samples,
  };
}

export function mapObserver(envelope: RuntimeArtifactEnvelope): ObserverPreset {
  const payload = envelope.payload as Omit<
    ObserverPreset,
    'identity' | 'availability' | 'approval'
  >;
  return {
    ...payload,
    identity: identity(envelope),
    availability: 'AVAILABLE',
    approval: approval(envelope.approval),
  };
}

export function mapDomain(envelope: RuntimeArtifactEnvelope): SupportedTimeDomain {
  const payload = envelope.payload as Omit<SupportedTimeDomain, 'approval'>;
  return { ...payload, approval: approval(envelope.approval) };
}

type SkyFieldRow = [
  number,
  'FULL_SOLUTION' | 'COARSE_POSITION_NO_SOLUTION',
  number,
  number,
  number,
  number,
  number,
  number,
  number | null,
];

/** The display-only background field (SkyDisplayPolicyV1). */
export function mapSkyField(envelope: RuntimeArtifactEnvelope): SkyDisplayField {
  const payload = envelope.payload as {
    policyId: string;
    columns: readonly string[];
    epoch: { julianDate: { part1: number; part2: number } };
    stars: SkyFieldRow[];
  };
  const expected = 'hip,astrometry,raRad,decRad,plxMas,pmRaMasYr,pmDeMasYr,vmag,bv';
  if (payload.policyId !== 'SKY_DISPLAY_POLICY_V1' || payload.columns.join(',') !== expected) {
    throw new TypeError('Unsupported sky field layout.');
  }
  const stars: DisplayStarInput[] = payload.stars.map((row) => ({
    starId: `hip-${requireNumber(row[0], 'hip')}`,
    astrometry: row[1],
    rightAscensionRadians: requireNumber(row[2], 'raRad'),
    declinationRadians: requireNumber(row[3], 'decRad'),
    parallaxMas: requireNumber(row[4], 'plx'),
    muAlphaStarMasPerYear: requireNumber(row[5], 'pmRA'),
    muDeltaMasPerYear: requireNumber(row[6], 'pmDE'),
    visualMagnitude: requireNumber(row[7], 'vmag'),
    colorIndexBV: row[8] === null ? null : requireNumber(row[8], 'bv'),
  }));
  return {
    identity: identity(envelope),
    approval: approval(envelope.approval),
    epoch: {
      scale: 'TT',
      splitConvention: 'MJD_ZERO_PLUS_OFFSET',
      part1: requireNumber(payload.epoch.julianDate.part1, 'epoch part1'),
      part2: requireNumber(payload.epoch.julianDate.part2, 'epoch part2'),
    },
    stars,
  };
}

export interface SkyCulturePayload {
  readonly cultureId: string;
  readonly title: string;
  readonly layer: string;
  readonly starFieldArtifact: { readonly artifactId: string; readonly payloadSha256: string };
  readonly sources: Record<string, unknown>;
  readonly constellations: readonly {
    readonly abbreviation: string;
    readonly name: string;
    readonly polylines: readonly (readonly number[])[];
  }[];
  readonly starNames: readonly {
    readonly hip: number;
    readonly name: string;
    readonly designation: string;
    readonly constellation: string;
    readonly language: string;
    readonly origin: string;
    readonly arabicScriptFromEtymology: string | null;
  }[];
}

/** Cited text in the Arabic sky culture (note or recorded conflict). */
export interface ArabicSkyCitedText {
  readonly text: string;
  readonly sourceId: string;
  readonly locator: string;
}

interface ArabicSkyRecord {
  readonly arabic: string;
  readonly transliteration: string;
  readonly alternativeNames: readonly {
    readonly arabic: string;
    readonly transliteration: string | null;
  }[];
  readonly evidence: string;
  readonly attestation: readonly { readonly sourceId: string; readonly locator: string }[];
  readonly notes: readonly ArabicSkyCitedText[];
  readonly conflicts: readonly ArabicSkyCitedText[];
}

/** UFUQ_ARABIC_SKY_CULTURE payload (tools/catalogue/src/generate/arabic-sky.ts). */
export interface ArabicSkyPayload {
  readonly cultureId: string;
  readonly title: string;
  readonly layer: string;
  readonly starFieldArtifact: { readonly artifactId: string; readonly payloadSha256: string };
  readonly lineRule: { readonly ruleId: string; readonly layer: string };
  readonly sources: readonly { readonly sourceId: string; readonly role: string }[];
  readonly figures: readonly (ArabicSkyRecord & {
    readonly figureId: string;
    readonly parentId: string | null;
    readonly style: 'FIGURE' | 'GROUP';
    readonly members: readonly number[];
    readonly segments: readonly (readonly [number, number])[];
    readonly membershipCitations: readonly {
      readonly sourceId: string;
      readonly locator: string;
    }[];
  })[];
  readonly stars: readonly (ArabicSkyRecord & {
    readonly hip: number;
    readonly labelOnSky: boolean;
  })[];
}

export interface DatasetFiles {
  readonly stars: string;
  readonly leap: string;
  readonly eop: string;
  readonly observer: string;
  readonly domain: string;
  readonly content: string;
  readonly learning: string;
  readonly skyField: string;
  readonly skyCulture: string;
  readonly arabicSky: string;
}

export interface LoadedDataset {
  readonly stars: LoadedArtifact<Map<string, CatalogueStarState>>;
  readonly leap: LoadedArtifact<ApprovedLeapState>;
  readonly eop: LoadedArtifact<EopBundle>;
  readonly observer: LoadedArtifact<ObserverPreset>;
  readonly domain: LoadedArtifact<SupportedTimeDomain>;
  readonly content: LoadedArtifact<LessonContentPayload>;
  readonly learning: LoadedArtifact<LearningConfigurationPayload>;
  readonly skyField: LoadedArtifact<SkyDisplayField>;
  readonly skyCulture: LoadedArtifact<SkyCulturePayload>;
  readonly arabicSky: LoadedArtifact<ArabicSkyPayload>;
  /** Hipparcos number to route-star id, so the background never duplicates a route star. */
  readonly routeStarByHip: ReadonlyMap<number, string>;
}

export function loadDataset(directory: string, files: DatasetFiles): LoadedDataset {
  const path = (name: string) => join(directory, name);
  const stars = mapped(loadEnvelope(path(files.stars), 'UFUQ_ROUTE_STAR_ASTROMETRY'), mapStars);
  const content = mapped(loadEnvelope(path(files.content), 'UFUQ_LESSON_CONTENT'), (envelope) => {
    const payload = envelope.payload as LessonContentPayload;
    const starIds = new Set(stars.value?.keys() ?? []);
    const errors = validateLessonContent(payload, starIds);
    if (errors.length > 0) throw new TypeError(errors.join(' '));
    if (
      stars.payloadSha256 !== null &&
      payload.starArtifact.payloadSha256 !== stars.payloadSha256
    ) {
      throw new TypeError('Lesson content was generated against a different star artifact.');
    }
    return payload;
  });
  const skyField = mapped(
    loadEnvelope(path(files.skyField), 'UFUQ_SKY_DISPLAY_FIELD'),
    mapSkyField,
  );
  const skyCulture = mapped(
    loadEnvelope(path(files.skyCulture), 'UFUQ_SKY_CULTURE'),
    (envelope) => {
      const payload = envelope.payload as SkyCulturePayload;
      if (
        skyField.payloadSha256 !== null &&
        payload.starFieldArtifact.payloadSha256 !== skyField.payloadSha256
      ) {
        throw new TypeError('Sky culture was generated against a different star field.');
      }
      return payload;
    },
  );
  const arabicSky = mapped(
    loadEnvelope(path(files.arabicSky), 'UFUQ_ARABIC_SKY_CULTURE'),
    (envelope) => {
      const payload = envelope.payload as ArabicSkyPayload;
      if (
        skyField.payloadSha256 !== null &&
        payload.starFieldArtifact.payloadSha256 !== skyField.payloadSha256
      ) {
        throw new TypeError('Arabic sky culture was generated against a different star field.');
      }
      if (!Array.isArray(payload.figures) || !Array.isArray(payload.stars))
        throw new TypeError('Arabic sky culture payload is malformed.');
      return payload;
    },
  );
  const routeStarByHip = new Map<number, string>();
  for (const star of stars.value?.values() ?? []) {
    const hip = /:HIP (\d+)$/.exec(star.sourceRecordId)?.[1];
    if (hip !== undefined) routeStarByHip.set(Number(hip), star.starId);
  }
  return {
    stars,
    skyField,
    skyCulture,
    arabicSky,
    routeStarByHip,
    leap: mapped(loadEnvelope(path(files.leap), 'UFUQ_LEAP_SECOND_STATE'), mapLeap),
    eop: mapped(loadEnvelope(path(files.eop), 'UFUQ_EOP_DAILY_BUNDLE'), mapEop),
    observer: mapped(loadEnvelope(path(files.observer), 'UFUQ_OBSERVER_PRESET'), mapObserver),
    domain: mapped(loadEnvelope(path(files.domain), 'UFUQ_SUPPORTED_TIME_DOMAIN'), mapDomain),
    content,
    learning: mapped(
      loadEnvelope(path(files.learning), 'UFUQ_LEARNING_CONFIGURATION'),
      (envelope) => {
        const payload = envelope.payload as LearningConfigurationPayload;
        const errors = validateLearningConfiguration(payload);
        if (errors.length > 0) throw new TypeError(errors.join(' '));
        return payload;
      },
    ),
  };
}
