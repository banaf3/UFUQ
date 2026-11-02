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
  ScientificApproval,
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

export interface DatasetFiles {
  readonly stars: string;
  readonly leap: string;
  readonly eop: string;
  readonly observer: string;
  readonly domain: string;
  readonly content: string;
  readonly learning: string;
}

export interface LoadedDataset {
  readonly stars: LoadedArtifact<Map<string, CatalogueStarState>>;
  readonly leap: LoadedArtifact<ApprovedLeapState>;
  readonly eop: LoadedArtifact<EopBundle>;
  readonly observer: LoadedArtifact<ObserverPreset>;
  readonly domain: LoadedArtifact<SupportedTimeDomain>;
  readonly content: LoadedArtifact<LessonContentPayload>;
  readonly learning: LoadedArtifact<LearningConfigurationPayload>;
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
  return {
    stars,
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
