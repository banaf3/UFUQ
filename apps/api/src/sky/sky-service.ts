/**
 * Sky explorer (report UC-102 "Manage Celestial Environment"): the whole naked-eye sky for
 * a dataset, scope and instant, through the same gated ScientificProfileV1 evaluation as
 * lessons. Route stars keep the full profile; every other star is a display-only result
 * (SkyDisplayPolicyV1). Not an assessment, so stars may be named and figures drawn.
 */
import {
  type DisplayStarResult,
  type ExecutionScope,
  evaluateProfile,
  type GeometricHorizontalDirection,
} from '@ufuq/astronomy-core';
import type { ContentReview, CulturalLabel } from '@ufuq/catalogue-schema';
import {
  type OverlayLabelV2,
  SKY_CONTRACT_VERSION,
  type SkyCultureV1,
  type SkyRequestV1,
  type SkyStarNameV1,
  type SkyViewV1,
} from '@ufuq/contracts';

import type { LoadedArtifact } from '../data/artifacts.js';
import {
  contentAccepted,
  type DatasetRegistration,
  LessonError,
} from '../lesson/lesson-service.js';

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** An artifact is usable for a scope on the same terms as every other artifact. */
export function artifactAccepted(loaded: LoadedArtifact<unknown>, scope: ExecutionScope): boolean {
  if (loaded.status !== 'AVAILABLE') return false;
  const approvalScope =
    scope === 'SYNTHETIC_TECHNICAL_FIXTURE'
      ? 'SYNTHETIC_TECHNICAL_FIXTURE'
      : 'SCIENTIFIC_PROFILE_V1';
  if (loaded.approvalScope !== approvalScope) return false;
  if (loaded.approvalState === 'APPROVED') return true;
  return scope === 'REVIEW_PREVIEW' && loaded.approvalState === 'REVIEW_REQUIRED';
}

function labelsOf(labels: readonly CulturalLabel[]): OverlayLabelV2[] {
  return labels.map((label) => ({
    languageTag: label.languageTag,
    script: label.script,
    transliteration: label.transliteration,
    gloss: label.gloss,
    layer: label.layer,
  }));
}

function reviewSummary(reviews: readonly ContentReview[]): string {
  if (reviews.length === 0) return 'NONE';
  if (reviews.every((review) => review.state === 'APPROVED')) return 'APPROVED';
  return reviews.some((review) => review.state === 'NOT_APPROVED')
    ? 'NOT_APPROVED'
    : 'REVIEW_REQUIRED';
}

export interface ComputedSky {
  readonly utc: string;
  readonly profileId: string;
  readonly routeDirections: ReadonlyMap<string, GeometricHorizontalDirection>;
  readonly background: readonly DisplayStarResult[];
  readonly omittedStarCount: number;
}

/**
 * Evaluates route stars (ScientificProfileV1) and the background field (display only).
 * Background stars that are route stars are left out, so no star appears twice.
 */
export function computeSky(
  registration: DatasetRegistration,
  scope: ExecutionScope,
  utc: string,
  observerPresetId: string,
): ComputedSky {
  const data = registration.dataset;
  const observer = data.observer.value;
  const evaluation = evaluateProfile(
    {
      executionScope: scope,
      utc,
      observerPresetId,
      starIds:
        [...(data.stars.value?.keys() ?? [])].length > 0
          ? [...(data.stars.value?.keys() ?? [])]
          : undefined,
      includeDisplayField: true,
    },
    {
      ...(data.leap.value ? { leap: data.leap.value } : {}),
      ...(data.domain.value ? { domain: data.domain.value } : {}),
      ...(data.eop.value ? { eop: data.eop.value } : {}),
      ...(data.skyField.value ? { displayField: data.skyField.value } : {}),
      observers: new Map(observer ? [[observer.presetId, observer]] : []),
      stars: data.stars.value ?? new Map(),
    },
  );
  if (evaluation.outcome !== 'GEOMETRIC_RESULT_PENDING_VALIDATION') {
    throw new LessonError(422, evaluation.outcome, evaluation.detail, evaluation.outcome);
  }
  const display = evaluation.display;
  if (!display || display.status !== 'ACCEPTED') {
    throw new LessonError(
      422,
      'SKY_FIELD_NOT_ACCEPTED',
      display?.status === 'NOT_ACCEPTED' ? display.reason : 'No sky field.',
      'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED',
    );
  }
  const routeDirections = new Map<string, GeometricHorizontalDirection>();
  for (const star of evaluation.stars)
    if (star.kind === 'DIRECTION') routeDirections.set(star.starId, star.direction);
  const routeHip = new Set([...data.routeStarByHip.keys()].map((hip) => `hip-${hip}`));
  return {
    utc: evaluation.time.utc,
    profileId: evaluation.profileId,
    routeDirections,
    background: display.stars.filter((star) => !routeHip.has(star.starId)),
    omittedStarCount: display.omittedStarIds.length,
  };
}

export class SkyService {
  private readonly cache = new Map<string, SkyViewV1>();
  private readonly maxEntries = 24;

  constructor(private readonly datasets: ReadonlyMap<string, DatasetRegistration>) {}

  view(request: SkyRequestV1): SkyViewV1 {
    const registration = this.datasets.get(request.datasetId);
    if (!registration)
      throw new LessonError(404, 'UNKNOWN_DATASET', `Unknown dataset ${request.datasetId}.`);
    const scope = request.executionScope;
    if (!registration.scopes.includes(scope)) {
      throw new LessonError(
        403,
        'SCOPE_NOT_ENABLED',
        `Execution scope ${scope} is not enabled for ${request.datasetId}.`,
      );
    }
    const data = registration.dataset;
    const content = data.content.value;
    let utc = request.utc;
    let scenarioId: string | null = null;
    if (request.scenarioId !== undefined) {
      const scenario = content?.scenarios.find((s) => s.scenarioId === request.scenarioId);
      if (!scenario)
        throw new LessonError(404, 'UNKNOWN_SCENARIO', `Unknown scenario ${request.scenarioId}.`);
      if (!contentAccepted(scenario.review, scope)) {
        throw new LessonError(
          422,
          'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED',
          `Scenario review is ${scenario.review.state}.`,
          'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED',
        );
      }
      utc = scenario.utc;
      scenarioId = scenario.scenarioId;
    }
    const observer = data.observer.value;
    if (!observer) {
      throw new LessonError(422, 'REQUIRED_ARTIFACT_UNAVAILABLE', 'Observer preset unavailable.');
    }
    const key = `${request.datasetId}|${scope}|${utc}|${scenarioId ?? ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const sky = computeSky(registration, scope, utc as string, observer.presetId);
    const ids: string[] = [];
    const enu: number[] = [];
    const visualMagnitudes: number[] = [];
    const colorIndices: (number | null)[] = [];
    const indexOf = new Map<string, number>();
    const push = (id: string, direction: readonly number[], vmag: number, bv: number | null) => {
      indexOf.set(id, ids.length);
      ids.push(id);
      enu.push(
        round6(direction[0] as number),
        round6(direction[1] as number),
        round6(direction[2] as number),
      );
      visualMagnitudes.push(vmag);
      colorIndices.push(bv);
    };
    const fieldByHip = new Map(
      (data.skyField.value?.stars ?? []).map((star) => [star.starId, star.colorIndexBV]),
    );
    for (const [starId, direction] of sky.routeDirections) {
      const hip = [...data.routeStarByHip.entries()].find(([, id]) => id === starId)?.[0];
      push(
        starId,
        direction.enu,
        direction.visualMagnitude ?? 6.5,
        hip === undefined ? null : (fieldByHip.get(`hip-${hip}`) ?? null),
      );
    }
    for (const star of sky.background)
      push(star.starId, star.enu, star.visualMagnitude, star.colorIndexBV);
    const indexForHip = (hip: number): number | undefined => {
      const route = data.routeStarByHip.get(hip);
      return route === undefined ? indexOf.get(`hip-${hip}`) : indexOf.get(route);
    };

    const cultures: SkyCultureV1[] = [];
    // The project's curated Arabic patterns (lesson content), when accepted for the scope.
    if (content) {
      const patterns = content.patterns.filter((pattern) => contentAccepted(pattern.review, scope));
      cultures.push({
        cultureId: 'arabic-ufuq',
        title: 'Arabic star patterns (UFUQ curated)',
        layer: 'OLD_ARABIAN',
        reviewState: reviewSummary(patterns.map((pattern) => pattern.review)),
        attribution:
          "UFUQ curation from the owner's Arabic sources (Kunitzsch 1961, Ibn Qutayba, al-Marzuqi and others), cited per pattern; line figures are UFUQ teaching aids.",
        figures: patterns.map((pattern) => {
          const members = pattern.memberStarIds
            .map((id) => indexOf.get(id))
            .filter((index): index is number => index !== undefined);
          const label = pattern.labels[0];
          return {
            figureId: pattern.stableId,
            name: label?.transliteration ?? label?.script ?? pattern.stableId,
            labels: labelsOf(pattern.labels),
            segments: pattern.lineSegments.flatMap((segment) => {
              const a = indexOf.get(segment.fromStarId);
              const b = indexOf.get(segment.toStarId);
              return a === undefined || b === undefined ? [] : [[a, b] as const];
            }),
            memberIndices: members,
          };
        }),
      });
    }
    const culture = data.skyCulture.value;
    let starNames: SkyStarNameV1[] = [];
    if (culture && artifactAccepted(data.skyCulture, scope)) {
      cultures.push({
        cultureId: culture.cultureId,
        title: culture.title,
        layer: culture.layer,
        reviewState: data.skyCulture.approvalState,
        attribution:
          'Figures: M. van der Sluys, ConstellationLines v1.4 (CC BY 4.0). Names: the 88 IAU constellations.',
        figures: culture.constellations.map((constellation) => {
          const segments: (readonly [number, number])[] = [];
          const members = new Set<number>();
          for (const polyline of constellation.polylines) {
            for (let i = 1; i < polyline.length; i += 1) {
              const a = indexForHip(polyline[i - 1] as number);
              const b = indexForHip(polyline[i] as number);
              if (a === undefined || b === undefined) continue;
              segments.push([a, b]);
              members.add(a);
              members.add(b);
            }
          }
          return {
            figureId: `iau-${constellation.abbreviation}`,
            name: constellation.name,
            labels: [
              {
                languageTag: 'la',
                script: constellation.name,
                transliteration: null,
                gloss: constellation.abbreviation,
                layer: culture.layer,
              },
            ],
            segments,
            memberIndices: [...members],
          };
        }),
      });
      starNames = culture.starNames.flatMap((entry) => {
        const index = indexForHip(entry.hip);
        return index === undefined
          ? []
          : [
              {
                starIndex: index,
                name: entry.name,
                designation: entry.designation,
                language: entry.language,
                arabicScript: entry.arabicScriptFromEtymology,
                origin: entry.origin,
              },
            ];
      });
    }

    const view: SkyViewV1 = {
      contractVersion: SKY_CONTRACT_VERSION,
      datasetId: request.datasetId,
      executionScope: scope,
      utc: sky.utc,
      scenarioId,
      observer: {
        label: observer.displayLabel,
        latitudeDegrees: observer.geodeticLatitudeDegrees,
        longitudeDegrees: observer.geodeticLongitudeDegrees,
      },
      stars: { count: ids.length, ids, enu, visualMagnitudes, colorIndices },
      cultures,
      starNames,
      provenance: {
        profileId: sky.profileId,
        displayPolicyId: 'SKY_DISPLAY_POLICY_V1',
        scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION',
        artifacts: [
          data.stars,
          data.skyField,
          data.skyCulture,
          data.leap,
          data.eop,
          data.observer,
          data.domain,
        ].map((artifact) => ({
          artifactId: artifact.artifactId,
          approvalState: artifact.status === 'AVAILABLE' ? artifact.approvalState : artifact.status,
        })),
        omittedStarCount: sky.omittedStarCount,
        notices: [registration.notice],
        attributions: [
          ...registration.attributions,
          'Constellation figures: M. van der Sluys, ConstellationLines v1.4, DOI 10.5281/zenodo.10397192 (CC BY 4.0). Cross-reference: Bright Star Catalogue, 5th ed. (CDS V/50).',
          'Star names and etymologies: IAU Working Group on Star Names (WGSN), IAU Catalog of Star Names; etymology texts CC BY (IAU WGSN).',
          'Constellation names: the 88 IAU constellations (NAOJ table).',
        ],
      },
    };
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, view);
    return view;
  }
}
