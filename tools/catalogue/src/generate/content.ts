/**
 * Lesson content generation (Phase 2) and the visibly synthetic technical dataset used by
 * browser and API tests without restricted or unreviewed data.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type LessonContentPayload, validateLessonContent } from '@ufuq/catalogue-schema';

import {
  type ApprovalRecord,
  type ArtifactEnvelope,
  canonicalJson,
  envelope,
  sha256Hex,
} from '../canonical-json.js';
import { loadApproval } from './profile-v1-data.js';

function readCuration<T>(root: string, path: string): T {
  return JSON.parse(readFileSync(join(root, path), 'utf8')) as T;
}

/** Builds and validates the real ScientificProfileV1 lesson content artifact. */
export function generateLessonContent(
  root: string,
  stars: ArtifactEnvelope<{ stars: { starId: string }[] }>,
): ArtifactEnvelope<LessonContentPayload> {
  const patterns = readCuration<{ patterns: LessonContentPayload['patterns'] }>(
    root,
    'data/curation/patterns/patterns.v1.json',
  );
  const guidance = readCuration<{
    directions: LessonContentPayload['directions'];
    relationships: LessonContentPayload['relationships'];
  }>(root, 'data/curation/relationships/relationships.v1.json');
  const routes = readCuration<{ routes: LessonContentPayload['routes'] }>(
    root,
    'data/curation/routes/routes.v1.json',
  );
  const scenarios = readCuration<{ scenarios: LessonContentPayload['scenarios'] }>(
    root,
    'data/curation/scenarios/scenarios.v1.json',
  );
  const payload: LessonContentPayload = {
    contentVersion: '1',
    contentScope: 'SCIENTIFIC_PROFILE_V1',
    starArtifact: { artifactId: stars.artifactId, payloadSha256: stars.payloadSha256 },
    patterns: patterns.patterns,
    directions: guidance.directions,
    relationships: guidance.relationships,
    routes: routes.routes,
    scenarios: scenarios.scenarios,
  };
  const errors = validateLessonContent(
    payload,
    new Set(stars.payload.stars.map((star) => star.starId)),
  );
  if (errors.length > 0) throw new Error(`Lesson content is invalid:\n${errors.join('\n')}`);
  const { approval } = loadApproval(root, 'lesson-content-v1', sha256Hex(canonicalJson(payload)));
  return envelope('UFUQ_LESSON_CONTENT', 'lesson-content-v1', '1', payload, approval);
}

const SYNTHETIC: ApprovalRecord = {
  state: 'APPROVED',
  scope: 'SYNTHETIC_TECHNICAL_FIXTURE',
  reviewer: 'NOT_APPLICABLE_SYNTHETIC',
  decisionDate: '2026-11-02',
  decisionReference: 'IMP-011/IMP-012 visibly synthetic technical fixture; never learner content',
};
const SYNTHETIC_REVIEW = {
  state: 'APPROVED' as const,
  scope: 'SYNTHETIC_TECHNICAL_FIXTURE' as const,
  requiredReviewKinds: [],
  reviewer: SYNTHETIC.reviewer,
  decisionDate: SYNTHETIC.decisionDate,
  decisionReference: SYNTHETIC.decisionReference,
};

/** Synthetic star positions (degrees): invented technical values, not sky data. */
const SYNTHETIC_STARS: readonly (readonly [string, number, number, number])[] = [
  ['synthetic-star-a1', 10, 58, 2.3],
  ['synthetic-star-a2', 18, 61, 2.2],
  ['synthetic-star-a3', 24, 59, 2.4],
  ['synthetic-star-a4', 30, 62, 2.7],
  ['synthetic-star-a5', 38, 60, 3.4],
  ['synthetic-star-target', 40, 89.2, 2.0],
  ['synthetic-star-b1', 165, 56, 2.4],
  ['synthetic-star-b2', 166, 62, 1.8],
  ['synthetic-star-b3', 178, 54, 2.4],
  ['synthetic-star-b4', 184, 57, 3.3],
  ['synthetic-star-b5', 193, 56, 1.8],
  ['synthetic-star-b6', 201, 55, 2.2],
  ['synthetic-star-b7', 207, 49, 1.9],
];

const LEAP_STEPS: readonly (readonly [number, number])[] = [
  [41317, 10],
  [41499, 11],
  [41683, 12],
  [42048, 13],
  [42413, 14],
  [42778, 15],
  [43144, 16],
  [43509, 17],
  [43874, 18],
  [44239, 19],
  [44786, 20],
  [45151, 21],
  [45516, 22],
  [46247, 23],
  [47161, 24],
  [47892, 25],
  [48257, 26],
  [48804, 27],
  [49169, 28],
  [49534, 29],
  [50083, 30],
  [50630, 31],
  [51179, 32],
  [53736, 33],
  [54832, 34],
  [56109, 35],
  [57204, 36],
  [57754, 37],
];

const review = (kinds: string[] = []) => ({
  ...SYNTHETIC_REVIEW,
  requiredReviewKinds: kinds as [],
});
const label = (text: string) => ({
  languageTag: 'en',
  script: text,
  transliteration: null,
  gloss: 'synthetic technical label',
  layer: 'SYNTHETIC_TECHNICAL' as const,
  citations: [],
});

/** Generates the visibly synthetic technical dataset (all records SYNTHETIC_TECHNICAL_FIXTURE). */
export function generateSyntheticTechnicalDataset(root: string): ArtifactEnvelope<unknown>[] {
  void root;
  const firstMjd = 61041; // 2026-01-01
  const sampleCount = 365;
  const stars = envelope(
    'UFUQ_ROUTE_STAR_ASTROMETRY',
    'synthetic-stars-v1',
    '1',
    {
      profileId: 'SyntheticTechnicalProfileV1',
      note: 'SYNTHETIC TECHNICAL FIXTURE: invented star positions for software tests. Not sky data.',
      epoch: {
        nativeNotation: 'J1991.25(TT)',
        julianEpoch: 1991.25,
        scale: 'TT',
        julianDate: { part1: 2400000.5, part2: 48348.5625 },
      },
      stars: SYNTHETIC_STARS.map(([starId, raDeg, decDeg, vmag]) => ({
        starId,
        crosswalk: { source: 'SYNTHETIC', hip: null, henryDraper: null },
        normalized: {
          rightAscensionDegrees: raDeg,
          declinationDegrees: decDeg,
          rightAscensionRadians: (raDeg * Math.PI) / 180,
          declinationRadians: (decDeg * Math.PI) / 180,
          parallaxMas: 10,
          muAlphaStarMasPerYear: 0,
          muDeltaMasPerYear: 0,
          visualMagnitude: vmag,
        },
        radialVelocity: {
          state: 'RADIAL_VELOCITY_OMITTED_WITH_BOUND',
          omittedTerm: 'SECOND_ORDER_PERSPECTIVE_ACCELERATION',
          boundMilliarcsecondsPerKmPerSecond: 0,
          boundHorizonJulianEpoch: 2040,
          evidenceId: 'synthetic',
        },
      })),
    },
    SYNTHETIC,
  );
  const leap = envelope(
    'UFUQ_LEAP_SECOND_STATE',
    'synthetic-leap-seconds-v1',
    '1',
    {
      note: 'SYNTHETIC TECHNICAL FIXTURE copying the published TAI-UTC steps for tests.',
      transport: { publisherIntegrity: 'VERIFIED' },
      bulletinC: { consistency: 'CONSISTENT' },
      expiryMjd: 61584,
      transitions: LEAP_STEPS.map(([effectiveMjd, taiMinusUtcSeconds]) => ({
        effectiveMjd,
        taiMinusUtcSeconds,
      })),
    },
    SYNTHETIC,
  );
  const samples = Array.from({ length: sampleCount }, (_, k) => {
    const mjd = firstMjd + k;
    const phase = (2 * Math.PI * k) / 365;
    const round = (value: number, digits: number) => Number(value.toFixed(digits));
    return {
      sampleId: `synthetic#${mjd}`,
      mjdUtc: mjd,
      seriesId: 'synthetic-series',
      fields: {
        UT1_MINUS_UTC: {
          nativeValue: round(80 - 0.05 * k + 3 * Math.sin(phase), 4),
          quality: 'FINAL',
          uncertainty: null,
        },
        XP: {
          nativeValue: round(150 + 50 * Math.cos(phase), 3),
          quality: 'FINAL',
          uncertainty: null,
        },
        YP: {
          nativeValue: round(300 + 50 * Math.sin(phase), 3),
          quality: 'FINAL',
          uncertainty: null,
        },
      },
    };
  });
  const eop = envelope(
    'UFUQ_EOP_DAILY_BUNDLE',
    'synthetic-eop-v1',
    '1',
    {
      note: 'SYNTHETIC TECHNICAL FIXTURE: invented smooth daily values. Not IERS data.',
      sourceProductId: 'SYNTHETIC',
      coherentSeries: { seriesId: 'synthetic-series', label: 'synthetic', issues: [] },
      restorationConfigurationId:
        'IERS_CONVENTIONS_2010_V1_0_0_ORTHO_EOP_PMSDNUT2_IBAND1_UTLIBR_TT_ARGUMENT_V1',
      publisherValidity: 'NOT_DECLARED',
      samples,
    },
    SYNTHETIC,
    { UT1_MINUS_UTC: SYNTHETIC, XP: SYNTHETIC, YP: SYNTHETIC },
  );
  const observer = envelope(
    'UFUQ_OBSERVER_PRESET',
    'synthetic-observer-v1',
    '1',
    {
      schemaVersion: 1,
      presetId: 'synthetic-observer-tropical',
      displayLabel: 'Synthetic tropical observer (technical fixture)',
      siteIdentity: 'Synthetic technical site',
      referencePointDescription: 'Invented point for software tests',
      geodeticLatitudeDegrees: 3.5,
      geodeticLongitudeDegrees: 103.4,
      referenceSystem: { kind: 'GEODETIC_DATUM', identifier: 'WGS 84', realization: null },
      referenceEllipsoid: {
        ellipsoidId: 'WGS 84',
        equatorialRadiusMetres: 6378137.0,
        inverseFlattening: 298.257223563,
        source: 'synthetic',
      },
      coordinateReferenceEpoch: { state: 'NOT_REQUIRED', basis: 'synthetic' },
      height: { kind: 'ELLIPSOIDAL', valueMetres: 10, ellipsoidId: 'WGS 84' },
      coordinateAccuracy: {
        horizontal: { state: 'UNKNOWN_UNBOUNDED', reason: 'synthetic' },
        vertical: { state: 'UNKNOWN_UNBOUNDED', reason: 'synthetic' },
      },
      provenance: ['synthetic'],
      dataVersionId: 'synthetic-observer-v1',
    },
    SYNTHETIC,
  );
  const domain = envelope(
    'UFUQ_SUPPORTED_TIME_DOMAIN',
    'synthetic-time-domain-v1',
    '1',
    {
      profileId: 'SyntheticTechnicalProfileV1',
      executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
      domainVersion: 'synthetic-time-domain-2026',
      earliest: { canonicalUtc: '2026-01-02T00:00:00Z', boundary: 'INCLUSIVE' },
      latest: { canonicalUtc: '2026-12-30T00:00:00Z', boundary: 'EXCLUSIVE' },
      inputResolution: 'WHOLE_SECOND',
      contributingDomainIdentities: ['synthetic'],
      requiredLeapAndEopPolicyIdentities: ['LAGRANGE_FOUR_POINT_V1 via continuous UT1-TAI'],
      requiredArtifactManifestIdentities: [
        stars.payloadSha256,
        leap.payloadSha256,
        eop.payloadSha256,
        observer.payloadSha256,
      ],
      requiredFieldCoverage: ['UT1_MINUS_UTC', 'XP', 'YP'],
      interpolationSupportRequirements: 'Samples i-1..i+2',
      derivationMethodAndVersion: 'synthetic',
    },
    SYNTHETIC,
  );
  const helperA = [
    'synthetic-star-a1',
    'synthetic-star-a2',
    'synthetic-star-a3',
    'synthetic-star-a4',
    'synthetic-star-a5',
  ];
  const helperB = [
    'synthetic-star-b1',
    'synthetic-star-b2',
    'synthetic-star-b3',
    'synthetic-star-b4',
    'synthetic-star-b5',
    'synthetic-star-b6',
    'synthetic-star-b7',
  ];
  const chain = (ids: string[]) =>
    ids.slice(1).map((id, i) => ({ fromStarId: ids[i] as string, toStarId: id }));
  const step = (
    stepId: string,
    taskKind: 'IDENTIFY_PATTERN_MEMBER' | 'IDENTIFY_TARGET_STAR' | 'INDICATE_DIRECTION',
    patternId: string | null,
    guidanceRelationshipId: string | null,
    prompt: string,
  ) => ({
    stepId,
    taskKind,
    patternId,
    directionId: taskKind === 'INDICATE_DIRECTION' ? 'direction-true-north' : null,
    guidanceRelationshipId,
    prompt,
    successFeedback: 'Accepted (synthetic technical fixture).',
    retryFeedback: 'Not correct (synthetic technical fixture).',
  });
  const content: LessonContentPayload = {
    contentVersion: 'synthetic-1',
    contentScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
    starArtifact: { artifactId: stars.artifactId, payloadSha256: stars.payloadSha256 },
    patterns: [
      {
        stableId: 'synthetic-pattern-helper-a',
        contentVersion: '1',
        patternKind: 'ASTERISM',
        labels: [label('Synthetic helper A')],
        memberStarIds: helperA,
        membershipCitations: [],
        lineSegments: chain(helperA),
        lineSegmentLayer: 'SYNTHETIC_TECHNICAL',
        shapeHint: 'Synthetic zigzag of five stars.',
        review: review(),
      },
      {
        stableId: 'synthetic-pattern-helper-b',
        contentVersion: '1',
        patternKind: 'ASTERISM',
        labels: [label('Synthetic helper B')],
        memberStarIds: helperB,
        membershipCitations: [],
        lineSegments: chain(helperB),
        lineSegmentLayer: 'SYNTHETIC_TECHNICAL',
        shapeHint: 'Synthetic curve of seven stars.',
        review: review(),
      },
      {
        stableId: 'synthetic-pattern-target',
        contentVersion: '1',
        patternKind: 'SINGLE_STAR',
        labels: [label('Synthetic target star')],
        memberStarIds: ['synthetic-star-target'],
        membershipCitations: [],
        lineSegments: [],
        lineSegmentLayer: 'NONE',
        shapeHint: 'Synthetic star near the pole.',
        review: review(),
      },
    ],
    directions: [
      {
        stableId: 'direction-true-north',
        contentVersion: '1',
        labels: [label('True North (synthetic fixture)')],
        definition: { kind: 'TERRESTRIAL_TRUE_NORTH', azimuthRadians: 0 },
        review: review(),
      },
    ],
    relationships: [
      {
        stableId: 'synthetic-guide-a',
        relationshipVersion: '1',
        source: { kind: 'pattern', stableId: 'synthetic-pattern-helper-a' },
        target: { kind: 'pattern', stableId: 'synthetic-pattern-target' },
        relationshipType: 'LEADS_TO_TARGET_STAR',
        instruction: {
          kind: 'GREAT_CIRCLE_ARC',
          fromStarId: 'synthetic-star-a3',
          toStarId: 'synthetic-star-target',
        },
        layer: 'SYNTHETIC_TECHNICAL',
        explanation: 'Synthetic guide line.',
        historicalContext: null,
        citations: [],
        review: review(),
      },
      {
        stableId: 'synthetic-guide-b',
        relationshipVersion: '1',
        source: { kind: 'pattern', stableId: 'synthetic-pattern-helper-b' },
        target: { kind: 'pattern', stableId: 'synthetic-pattern-target' },
        relationshipType: 'LEADS_TO_TARGET_STAR',
        instruction: {
          kind: 'POINTER_EXTENSION',
          fromStarId: 'synthetic-star-b1',
          throughStarId: 'synthetic-star-b2',
          toStarId: 'synthetic-star-target',
        },
        layer: 'SYNTHETIC_TECHNICAL',
        explanation: 'Synthetic pointer line.',
        historicalContext: null,
        citations: [],
        review: review(),
      },
      {
        stableId: 'synthetic-guide-north',
        relationshipVersion: '1',
        source: { kind: 'pattern', stableId: 'synthetic-pattern-target' },
        target: { kind: 'direction', stableId: 'direction-true-north' },
        relationshipType: 'LEADS_TO_DIRECTION',
        instruction: { kind: 'VERTICAL_TO_HORIZON', fromStarId: 'synthetic-star-target' },
        layer: 'SYNTHETIC_TECHNICAL',
        explanation: 'Synthetic vertical to the horizon.',
        historicalContext: null,
        citations: [],
        review: review(),
      },
    ],
    routes: [
      {
        stableId: 'synthetic-route-a',
        routeVersion: '1',
        title: 'Synthetic route A',
        selectionPriority: 1,
        requiredStarIds: [...helperA, 'synthetic-star-target'],
        steps: [
          step(
            'step-1',
            'IDENTIFY_PATTERN_MEMBER',
            'synthetic-pattern-helper-a',
            null,
            'Select a star of synthetic helper A.',
          ),
          step(
            'step-2',
            'IDENTIFY_TARGET_STAR',
            'synthetic-pattern-target',
            'synthetic-guide-a',
            'Select the synthetic target star.',
          ),
          step(
            'step-3',
            'INDICATE_DIRECTION',
            null,
            'synthetic-guide-north',
            'Face True North and confirm.',
          ),
        ],
        allowedAlternativeRouteIds: ['synthetic-route-b'],
        review: review(),
      },
      {
        stableId: 'synthetic-route-b',
        routeVersion: '1',
        title: 'Synthetic route B',
        selectionPriority: 2,
        requiredStarIds: [...helperB, 'synthetic-star-target'],
        steps: [
          step(
            'step-1',
            'IDENTIFY_PATTERN_MEMBER',
            'synthetic-pattern-helper-b',
            null,
            'Select a star of synthetic helper B.',
          ),
          step(
            'step-2',
            'IDENTIFY_TARGET_STAR',
            'synthetic-pattern-target',
            'synthetic-guide-b',
            'Select the synthetic target star.',
          ),
          step(
            'step-3',
            'INDICATE_DIRECTION',
            null,
            'synthetic-guide-north',
            'Face True North and confirm.',
          ),
        ],
        allowedAlternativeRouteIds: ['synthetic-route-a'],
        review: review(),
      },
    ],
    scenarios: [
      {
        scenarioId: 'synthetic-scenario-a',
        label: 'Synthetic scenario A (route A)',
        utc: '2026-11-15T13:00:00Z',
        observerPresetId: 'synthetic-observer-tropical',
        purpose: 'technical test',
        review: review(),
      },
      {
        scenarioId: 'synthetic-scenario-b',
        label: 'Synthetic scenario B (route B)',
        utc: '2026-05-15T14:00:00Z',
        observerPresetId: 'synthetic-observer-tropical',
        purpose: 'technical test',
        review: review(),
      },
    ],
  };
  const errors = validateLessonContent(content, new Set(SYNTHETIC_STARS.map(([id]) => id)));
  if (errors.length > 0) throw new Error(`Synthetic content is invalid:\n${errors.join('\n')}`);
  const contentEnvelope = envelope(
    'UFUQ_LESSON_CONTENT',
    'synthetic-lesson-content-v1',
    '1',
    content,
    SYNTHETIC,
  );
  return [stars, leap, eop, observer, domain, contentEnvelope];
}
