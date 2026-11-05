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
import {
  SKY_CONTRACT_VERSION,
  type SkyArabicNameV2,
  type SkyCitedTextV2,
  type SkyCultureV2,
  type SkyEvidenceV2,
  type SkyModernNameV2,
  type SkyRequestV1,
  type SkyViewV2,
} from '@ufuq/contracts';

import type { ArabicSkyCitedText, LoadedArtifact } from '../data/artifacts.js';
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

/** Short titles for the citations shown in the explorer. */
const SOURCE_TITLES: Readonly<Record<string, string>> = {
  'IBN-QUTAYBA-ANWA': 'Ibn Qutayba, Kitāb al-Anwāʾ',
  'AL-MARZUQI-AZMINA': 'al-Marzūqī, al-Azmina wa-l-Amkina',
  'IBN-ASIM-ANWA': 'Ibn ʿĀṣim, al-Anwāʾ wa-l-Azmina',
  'HAFEZ-2010': 'Hafez 2010 (al-Ṣūfī crosswalk)',
  'KUNITZSCH-1961': 'Kunitzsch 1961',
  'IAU-WGSN-CSN': 'IAU WGSN',
  'STELLARIUM-ARABIC-ANCIENT': 'Stellarium Arabic (Ancient) compilation (K. al-Ajaji)',
  SYNTHETIC: 'Synthetic technical fixture',
};
const sourceTitle = (sourceId: string) => SOURCE_TITLES[sourceId] ?? sourceId;
const cited = (entry: ArabicSkyCitedText): SkyCitedTextV2 => ({
  text: entry.text,
  source: `${sourceTitle(entry.sourceId)}, ${entry.locator}`,
});
const sourceList = (
  pointers: readonly { readonly sourceId: string; readonly locator: string }[],
): string[] => [
  ...new Set(pointers.map((pointer) => `${sourceTitle(pointer.sourceId)}, ${pointer.locator}`)),
];

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
  private readonly cache = new Map<string, SkyViewV2>();
  private readonly maxEntries = 24;

  constructor(private readonly datasets: ReadonlyMap<string, DatasetRegistration>) {}

  view(request: SkyRequestV1): SkyViewV2 {
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

    // The Arabic (anwāʾ) culture: the only sky culture the explorer teaches.
    let culture: SkyCultureV2 | null = null;
    let arabicNames: SkyArabicNameV2[] = [];
    const arabic = data.arabicSky.value;
    if (arabic && artifactAccepted(data.arabicSky, scope)) {
      culture = {
        cultureId: arabic.cultureId,
        title: arabic.title,
        layer: arabic.layer,
        reviewState: data.arabicSky.approvalState,
        attribution:
          'Names and memberships: the Stellarium Arabic (Ancient) compilation (K. al-Ajaji, CC BY-ND 4.0), checked against Ibn Qutayba, al-Marzuqi and Ibn Asim; notes are UFUQ paraphrases with locators; lines are UFUQ teaching aids (UFUQ_TREE_V1).',
        lineRule: arabic.lineRule.ruleId,
        figures: arabic.figures.map((figure) => ({
          figureId: figure.figureId,
          parentId: figure.parentId,
          arabic: figure.arabic,
          transliteration: figure.transliteration,
          alternativeNames: figure.alternativeNames.map((name) => ({
            arabic: name.arabic,
            transliteration: name.transliteration,
          })),
          style: figure.style,
          segments: figure.segments.flatMap(([from, to]) => {
            const a = indexForHip(from);
            const b = indexForHip(to);
            return a === undefined || b === undefined ? [] : [[a, b] as const];
          }),
          memberIndices: figure.members
            .map(indexForHip)
            .filter((index): index is number => index !== undefined),
          evidence: figure.evidence as SkyEvidenceV2,
          notes: figure.notes.map(cited),
          conflicts: figure.conflicts.map(cited),
          sources: sourceList([...figure.membershipCitations, ...figure.attestation]),
        })),
      };
      arabicNames = arabic.stars.flatMap((star) => {
        const index = indexForHip(star.hip);
        return index === undefined
          ? []
          : [
              {
                starIndex: index,
                arabic: star.arabic,
                transliteration: star.transliteration,
                alternativeNames: star.alternativeNames.map((name) => ({
                  arabic: name.arabic,
                  transliteration: name.transliteration,
                })),
                labelOnSky: star.labelOnSky,
                evidence: star.evidence as SkyEvidenceV2,
                notes: star.notes.map(cited),
                conflicts: star.conflicts.map(cited),
                sources: sourceList(star.attestation),
              },
            ];
      });
    }
    // Modern IAU WGSN names: origin information for a picked star, never sky labels.
    const modern = data.skyCulture.value;
    let modernNames: SkyModernNameV2[] = [];
    if (modern && artifactAccepted(data.skyCulture, scope)) {
      modernNames = modern.starNames.flatMap((entry) => {
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

    const view: SkyViewV2 = {
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
      culture,
      arabicNames,
      modernNames,
      provenance: {
        profileId: sky.profileId,
        displayPolicyId: 'SKY_DISPLAY_POLICY_V1',
        scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION',
        artifacts: [
          data.stars,
          data.skyField,
          data.arabicSky,
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
          'Arabic sky: names and memberships from the Stellarium Arabic (Ancient) compilation by Khalid al-Ajaji (CC BY-ND 4.0, cited per record; its figure lines are not used), checked against Ibn Qutayba, al-Marzuqi and Ibn Asim. Cross-reference: Bright Star Catalogue, 5th ed. (CDS V/50).',
          'Modern star names and etymologies (origin information only): IAU Working Group on Star Names (WGSN), IAU Catalog of Star Names; etymology texts CC BY (IAU WGSN).',
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
