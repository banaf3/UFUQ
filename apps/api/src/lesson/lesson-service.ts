/**
 * Server-authoritative lesson flow (IMP-004, IMP-018; Phase 3): evaluates the scenario sky
 * with ScientificProfileV1 semantics, selects the first eligible route from data, issues
 * opaque star handles and per-step cue snapshots, scores raw learner evidence, and passes
 * each accepted attempt through the pure learner model (tutoring-core). Lesson presentation
 * state is in memory; learner models and attempts go through the LearnerStore port
 * (in memory for the development identity, MySQL for accounts).
 */
import { randomBytes, randomUUID } from 'node:crypto';

import {
  type DirectionMeasurement,
  measureDirectionAnswer,
  scoredOutcomeOf,
  scorePointedLocation,
  scoreStarSetSelection,
  type StarSetScore,
} from '@ufuq/assessment-core';
import {
  type ExecutionScope,
  evaluateProfile,
  type GeometricHorizontalDirection,
  PROFILE_V1_ALGORITHM_IDENTITY,
  sphericalInitialBearing,
} from '@ufuq/astronomy-core';
import type {
  ContentReview,
  CulturalLabel,
  DirectionTarget,
  GuidanceRelationship,
  LessonContentPayload,
  LessonRoute,
  LessonRouteStep,
  ScenarioPreset,
  SkyPattern,
} from '@ufuq/catalogue-schema';
import {
  LESSON_CONTRACT_VERSION,
  POINT_CIRCLE_RADIUS_SHARE,
  type LessonSessionV2,
  type LessonStepPromptV2,
  type OverlayLabelV2,
  type SessionPurposeV2,
  type SkyOverlayV2,
  type SkyStarV2,
  type StepAnswerV2,
  type StepFeedbackV2,
  type TutoringTraceV2,
  type WalkthroughFrameV2,
  type WalkthroughV2,
} from '@ufuq/contracts';
import {
  type AttemptDecisionRecord,
  configuredCues,
  type CueId,
  type IssuedTaskCues,
  type LearnerModelState,
  type LearningConfigurationPayload,
  learningModeOf,
  processAttempt,
  type ResponseStatus,
} from '@ufuq/tutoring-core';

import type { ArabicSkyPayload, LoadedArtifact, LoadedDataset } from '../data/artifacts.js';
import type { LearnerStore } from '../learners/learner-store.js';
import { artifactAccepted, references } from '../sky/sky-service.js';

export interface DatasetRegistration {
  readonly datasetId: string;
  readonly title: string;
  readonly scopes: readonly ExecutionScope[];
  readonly dataset: LoadedDataset;
  readonly notice: string;
  readonly attributions: readonly string[];
}

export class LessonError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly outcome?: string,
    readonly reissuedStep?: LessonStepPromptV2,
  ) {
    super(message);
  }
}

interface LearningBinding {
  readonly artifactId: string;
  readonly payloadSha256: string;
  readonly approvalState: string;
  readonly configuration: LearningConfigurationPayload;
}

interface IssuedTask {
  readonly stepId: string;
  /** Epoch milliseconds when the step was issued (time taken per attempt). */
  readonly issuedAt: number;
  readonly cues: IssuedTaskCues;
  /** Null for a step that credits no knowledge component. */
  readonly expectedMasteryRevision: number | null;
  readonly prompt: LessonStepPromptV2;
}

interface Session {
  readonly lessonId: string;
  readonly learnerId: string;
  readonly purpose: SessionPurposeV2;
  readonly datasetId: string;
  readonly scope: ExecutionScope;
  readonly context: SkyContext;
  readonly learning: LearningBinding;
  readonly handles: Handles;
  stepIndex: number;
  issued: IssuedTask | null;
  readonly attempts: Map<string, number>;
}

const approvalScopeOf = (scope: ExecutionScope) =>
  scope === 'SYNTHETIC_TECHNICAL_FIXTURE' ? 'SYNTHETIC_TECHNICAL_FIXTURE' : 'SCIENTIFIC_PROFILE_V1';

/** Content review acceptance mirrors scientific approval acceptance per execution scope. */
export function contentAccepted(review: ContentReview, scope: ExecutionScope): boolean {
  if (review.scope !== approvalScopeOf(scope)) return false;
  if (review.state === 'APPROVED') return true;
  return scope === 'REVIEW_PREVIEW' && review.state === 'REVIEW_REQUIRED';
}

/** The learning configuration is accepted on the same terms as any other artifact. */
export function learningAccepted(
  loaded: LoadedArtifact<LearningConfigurationPayload>,
  scope: ExecutionScope,
): boolean {
  if (loaded.status !== 'AVAILABLE' || !loaded.value) return false;
  if (loaded.value.configurationScope !== approvalScopeOf(scope)) return false;
  if (loaded.approvalState === 'APPROVED') return true;
  return scope === 'REVIEW_PREVIEW' && loaded.approvalState === 'REVIEW_REQUIRED';
}

export interface RouteEligibility {
  readonly routeId: string;
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}

/**
 * IMP-018 selection: a route is eligible only when its own record and every record it
 * uses are accepted for the scope, and every required star has a valid geometric
 * direction that is not below the geometric horizon. The lowest selectionPriority wins.
 */
export function evaluateRouteEligibility(
  content: LessonContentPayload,
  directions: ReadonlyMap<string, GeometricHorizontalDirection>,
  scope: ExecutionScope,
): RouteEligibility[] {
  const patterns = new Map(content.patterns.map((p) => [p.stableId, p]));
  const relationships = new Map(content.relationships.map((r) => [r.stableId, r]));
  const directionsById = new Map(content.directions.map((d) => [d.stableId, d]));
  return [...content.routes]
    .sort(
      (a, b) => a.selectionPriority - b.selectionPriority || a.stableId.localeCompare(b.stableId),
    )
    .map((route) => {
      const reasons: string[] = [];
      if (!contentAccepted(route.review, scope)) reasons.push(`route review ${route.review.state}`);
      for (const step of route.steps) {
        const pattern = step.patternId === null ? undefined : patterns.get(step.patternId);
        if (pattern && !contentAccepted(pattern.review, scope))
          reasons.push(`${pattern.stableId} review ${pattern.review.state}`);
        const relationship =
          step.guidanceRelationshipId === null
            ? undefined
            : relationships.get(step.guidanceRelationshipId);
        if (relationship && !contentAccepted(relationship.review, scope)) {
          reasons.push(`${relationship.stableId} review ${relationship.review.state}`);
        }
        const direction =
          step.directionId === null ? undefined : directionsById.get(step.directionId);
        if (direction && !contentAccepted(direction.review, scope))
          reasons.push(`${direction.stableId} review ${direction.review.state}`);
      }
      for (const starId of route.requiredStarIds) {
        const result = directions.get(starId);
        if (!result) reasons.push(`${starId} has no valid direction`);
        else if (result.horizonClassification === 'BELOW_GEOMETRIC_HORIZON')
          reasons.push(`${starId} below the geometric horizon`);
      }
      return { routeId: route.stableId, eligible: reasons.length === 0, reasons };
    });
}

function labelsOf(labels: readonly CulturalLabel[]): OverlayLabelV2[] {
  return labels.map((l) => ({
    languageTag: l.languageTag,
    script: l.script,
    transliteration: l.transliteration,
    gloss: l.gloss,
    layer: l.layer,
  }));
}

const degrees = (radians: number) => ((radians * 180) / Math.PI).toFixed(1);

/** Transport rounding (about 0.2 arcsec); the server keeps full precision for scoring. */
const roundedEnu = (enu: readonly number[]): [number, number, number] => [
  Math.round((enu[0] as number) * 1e6) / 1e6,
  Math.round((enu[1] as number) * 1e6) / 1e6,
  Math.round((enu[2] as number) * 1e6) / 1e6,
];

function traceOf(
  record: AttemptDecisionRecord,
  response: ResponseStatus,
  attemptKind: string,
): TutoringTraceV2 {
  const model = record.model;
  const before =
    model.kind === 'NO_MODEL_UPDATE'
      ? { mastery: model.masteryUnchanged, revision: model.revisionUnchanged }
      : { mastery: model.priorMastery, revision: model.priorRevision };
  const after =
    model.kind === 'NO_MODEL_UPDATE'
      ? before
      : { mastery: model.nextMasteryAfterTransition, revision: model.nextRevision };
  const scaffold = record.scaffold;
  const adaptive = scaffold.kind !== 'SCAFFOLD_NOT_ADAPTIVE';
  return {
    knowledgeComponentId: record.knowledgeComponentId,
    mode: record.mode,
    responseStatus: response,
    attemptKind,
    observationDecision: record.observation.decision,
    observationReasonCode:
      'ruleId' in record.observation
        ? record.observation.instruction.reasonCode
        : record.observation.reasonCode,
    modelDecision: model.kind,
    modelReasonCode: model.reasonCode,
    masteryBefore: before.mastery,
    masteryAfter: after.mastery,
    revisionBefore: before.revision,
    revisionAfter: after.revision,
    scaffoldDecision: scaffold.kind,
    scaffoldFrom: adaptive ? scaffold.fromState : null,
    scaffoldTo: adaptive ? scaffold.toState : null,
    scaffoldReasonCode: scaffold.reasonCode,
    masteryThresholdStatus: record.masteryThreshold.status,
    independentConfirmationStatus: record.independentConfirmation.status,
  };
}

const DEG = Math.PI / 180;

/** "292° 07′" from radians, for learner-facing bearings. */
export function degreesMinutes(radians: number): string {
  const totalMinutes = Math.round((radians / DEG) * 60);
  const whole = Math.floor(totalMinutes / 60);
  return `${whole}° ${String(totalMinutes - whole * 60).padStart(2, '0')}′`;
}

const horizonEnu = (azimuth: number): [number, number, number] =>
  roundedEnu([Math.sin(azimuth), Math.cos(azimuth), 0]);

/** Everything a lesson or a walkthrough needs about one scenario's sky. */
interface SkyContext {
  readonly registration: DatasetRegistration;
  readonly content: LessonContentPayload;
  readonly scenario: ScenarioPreset;
  readonly observerLabel: string;
  readonly profileId: string;
  readonly artifactHashes: readonly string[];
  readonly directions: ReadonlyMap<string, GeometricHorizontalDirection>;
  readonly background: readonly {
    readonly starId: string;
    readonly enu: readonly number[];
    readonly visualMagnitude: number | null;
    readonly colorIndexBV: number | null;
    readonly altitudeRadians: number;
  }[];
  readonly colorOf: ReadonlyMap<string, number | null>;
  readonly hipOfRoute: ReadonlyMap<string, number>;
  readonly routeStarByHip: ReadonlyMap<number, string>;
  readonly route: LessonRoute;
  /** Server-side target azimuth of every direction record (rad, clockwise from north). */
  readonly targetAzimuths: ReadonlyMap<string, number>;
  /** The Arabic sky culture when its artifact is accepted for the scope, else null. */
  readonly culture: ArabicSkyPayload | null;
}

interface Handles {
  readonly handleOf: ReadonlyMap<string, string>;
  readonly starOf: ReadonlyMap<string, string>;
}

function allocateHandles(starIds: readonly string[]): Handles {
  const handleOf = new Map<string, string>();
  const starOf = new Map<string, string>();
  for (const starId of [...starIds].sort()) {
    let handle: string;
    do handle = `h-${randomBytes(6).toString('hex')}`;
    while (starOf.has(handle));
    handleOf.set(starId, handle);
    starOf.set(handle, starId);
  }
  return { handleOf, starOf };
}

function skyStars(context: SkyContext, handles: Handles): SkyStarV2[] {
  return [
    ...[...context.directions.entries()].map(([starId, direction]) => ({
      handle: handles.handleOf.get(starId) as string,
      enu: roundedEnu(direction.enu),
      visualMagnitude: direction.visualMagnitude,
      colorIndexBV: context.colorOf.get(`hip-${context.hipOfRoute.get(starId)}`) ?? null,
      belowGeometricHorizon: direction.horizonClassification === 'BELOW_GEOMETRIC_HORIZON',
    })),
    ...context.background.map((star) => ({
      handle: handles.handleOf.get(star.starId) as string,
      enu: roundedEnu(star.enu),
      visualMagnitude: star.visualMagnitude,
      colorIndexBV: star.colorIndexBV,
      belowGeometricHorizon: star.altitudeRadians < 0,
    })),
  ].sort((a, b) => a.handle.localeCompare(b.handle)); // list position reveals nothing
}

/** Maps the culture's HIP numbers to this lesson's handles (route stars or display stars). */
function cultureHandle(context: SkyContext, handles: Handles, hip: number): string | undefined {
  return handles.handleOf.get(context.routeStarByHip.get(hip) ?? `hip-${hip}`);
}

function figureLines(
  context: SkyContext,
  handles: Handles,
  figures: ArabicSkyPayload['figures'],
): [string, string][] {
  const seen = new Set<string>();
  const segments: [string, string][] = [];
  for (const figure of figures) {
    for (const [a, b] of figure.segments) {
      const from = cultureHandle(context, handles, a);
      const to = cultureHandle(context, handles, b);
      const key = [from, to].sort().join('|');
      if (from === undefined || to === undefined || seen.has(key)) continue;
      seen.add(key);
      segments.push([from, to]);
    }
  }
  return segments;
}

function figureNames(
  context: SkyContext,
  handles: Handles,
  culture: ArabicSkyPayload,
  figures: ArabicSkyPayload['figures'],
  stars: ArabicSkyPayload['stars'],
): SkyOverlayV2 {
  return {
    kind: 'FIGURE_NAMES',
    figures: figures.flatMap((figure) => {
      const memberHandles = figure.members
        .map((hip) => cultureHandle(context, handles, hip))
        .filter((handle): handle is string => handle !== undefined);
      return memberHandles.length === 0
        ? []
        : [
            {
              memberHandles,
              arabic: figure.arabic,
              transliteration: figure.transliteration,
              child: figure.parentId !== null,
            },
          ];
    }),
    stars: stars.flatMap((star) => {
      const handle = cultureHandle(context, handles, star.hip);
      return handle === undefined
        ? []
        : [
            {
              handle,
              arabic: star.arabic,
              transliteration: star.transliteration,
              guidanceTarget: culture.guidanceTarget?.hip === star.hip,
            },
          ];
    }),
  };
}

function directionName(direction: DirectionTarget): string {
  return direction.definition.kind === 'QIBLA_SPHERICAL_INITIAL_BEARING'
    ? 'the Qibla'
    : 'True North';
}

export class LessonService {
  private readonly sessions = new Map<string, Session>();
  private readonly maxSessions = 500;

  constructor(
    private readonly datasets: ReadonlyMap<string, DatasetRegistration>,
    private readonly learners: LearnerStore | null,
  ) {}

  listDatasets() {
    return [...this.datasets.values()].map((registration) => {
      const d = registration.dataset;
      const approvals = [d.stars, d.leap, d.eop, d.observer, d.domain, d.content, d.learning].map(
        (artifact) => ({
          artifactId: artifact.artifactId,
          state: artifact.status === 'AVAILABLE' ? artifact.approvalState : artifact.status,
        }),
      );
      return {
        datasetId: registration.datasetId,
        title: registration.title,
        executionScopes: registration.scopes,
        approvalSummary: approvals,
        scenarios: (d.content.value?.scenarios ?? []).map((s) => ({
          scenarioId: s.scenarioId,
          label: s.label,
          utc: s.utc,
        })),
        learningMode: d.learning.value
          ? learningModeOf(d.learning.value)
          : ('UNAVAILABLE' as const),
        supportedDomain: d.domain.value
          ? {
              earliest: d.domain.value.earliest.canonicalUtc,
              earliestBoundary: d.domain.value.earliest.boundary,
              latest: d.domain.value.latest.canonicalUtc,
              latestBoundary: d.domain.value.latest.boundary,
            }
          : null,
        observerLabel: d.observer.value?.displayLabel ?? '',
        notice: registration.notice,
      };
    });
  }

  /** Evaluates the scenario sky and selects the first eligible route (IMP-018). */
  private prepare(datasetId: string, scenarioId: string, scope: ExecutionScope): SkyContext {
    const registration = this.datasets.get(datasetId);
    if (!registration)
      throw new LessonError(404, 'UNKNOWN_DATASET', `Unknown dataset ${datasetId}.`);
    if (!registration.scopes.includes(scope)) {
      throw new LessonError(
        403,
        'SCOPE_NOT_ENABLED',
        `Execution scope ${scope} is not enabled for ${datasetId}.`,
      );
    }
    const data = registration.dataset;
    const content = data.content.value;
    if (!content) {
      throw new LessonError(
        422,
        'REQUIRED_ARTIFACT_UNAVAILABLE',
        `Lesson content ${data.content.status}.`,
        'REQUIRED_ARTIFACT_UNAVAILABLE',
      );
    }
    const scenario = content.scenarios.find((s) => s.scenarioId === scenarioId);
    if (!scenario)
      throw new LessonError(404, 'UNKNOWN_SCENARIO', `Unknown scenario ${scenarioId}.`);
    if (!contentAccepted(scenario.review, scope)) {
      throw new LessonError(
        422,
        'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED',
        `Scenario review is ${scenario.review.state}.`,
        'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED',
      );
    }
    const observer = data.observer.value;
    const starIds = [...(data.stars.value?.keys() ?? [])];
    const evaluation = evaluateProfile(
      {
        executionScope: scope,
        utc: scenario.utc,
        observerPresetId: scenario.observerPresetId,
        starIds: starIds.length > 0 ? starIds : undefined,
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
    const directions = new Map<string, GeometricHorizontalDirection>();
    for (const star of evaluation.stars)
      if (star.kind === 'DIRECTION') directions.set(star.starId, star.direction);
    // The display-only background sky (SkyDisplayPolicyV1) surrounds the route stars; it is
    // never a target. Without an accepted field the lesson keeps the route stars only.
    const routeHip = new Set([...data.routeStarByHip.keys()].map((hip) => `hip-${hip}`));
    const background =
      evaluation.display?.status === 'ACCEPTED'
        ? evaluation.display.stars.filter((star) => !routeHip.has(star.starId))
        : [];
    const colorOf = new Map(
      (data.skyField.value?.stars ?? []).map((star) => [star.starId, star.colorIndexBV]),
    );
    const hipOfRoute = new Map([...data.routeStarByHip.entries()].map(([hip, id]) => [id, hip]));
    // Direction targets: True North is azimuth 0; the Qibla is computed for the observer.
    const targetAzimuths = new Map<string, number>();
    for (const direction of content.directions) {
      const definition = direction.definition;
      if (definition.kind === 'TERRESTRIAL_TRUE_NORTH') {
        targetAzimuths.set(direction.stableId, definition.azimuthRadians);
      } else if (observer) {
        const bearing = sphericalInitialBearing(
          {
            latitudeDegrees: observer.geodeticLatitudeDegrees,
            longitudeDegrees: observer.geodeticLongitudeDegrees,
          },
          definition.destination,
        );
        if (bearing.kind === 'BEARING')
          targetAzimuths.set(direction.stableId, bearing.azimuthRadians);
      }
    }
    const eligibility = evaluateRouteEligibility(content, directions, scope).map((entry) => {
      const route = content.routes.find((r) => r.stableId === entry.routeId) as LessonRoute;
      const missing = route.steps
        .filter((step) => step.directionId !== null && !targetAzimuths.has(step.directionId))
        .map((step) => `${step.directionId} has no defined azimuth here`);
      return missing.length === 0
        ? entry
        : { ...entry, eligible: false, reasons: [...entry.reasons, ...missing] };
    });
    const selected = eligibility.find((route) => route.eligible);
    if (!selected) {
      throw new LessonError(
        422,
        'NO_ELIGIBLE_ROUTE',
        eligibility.map((route) => `${route.routeId}: ${route.reasons.join('; ')}`).join(' | '),
      );
    }
    const arabicSky = data.arabicSky;
    return {
      registration,
      content,
      scenario,
      observerLabel: observer?.displayLabel ?? '',
      profileId: evaluation.profileId,
      artifactHashes: evaluation.artifactIdentities,
      directions,
      background,
      colorOf,
      hipOfRoute,
      routeStarByHip: data.routeStarByHip,
      route: content.routes.find((r) => r.stableId === selected.routeId) as LessonRoute,
      targetAzimuths,
      culture:
        arabicSky.value !== undefined && artifactAccepted(arabicSky, scope)
          ? arabicSky.value
          : null,
    };
  }

  private allStarIds(context: SkyContext): string[] {
    return [...context.directions.keys(), ...context.background.map((star) => star.starId)];
  }

  async createLesson(request: {
    datasetId: string;
    scenarioId: string;
    executionScope: ExecutionScope;
    learnerId: string;
    sessionPurpose: SessionPurposeV2;
  }): Promise<LessonSessionV2> {
    const { datasetId, scenarioId, executionScope: scope } = request;
    const store = this.store();
    if (!(await store.learnerExists(request.learnerId)))
      throw new LessonError(404, 'UNKNOWN_LEARNER', 'Unknown learner.');
    if (request.sessionPurpose !== 'LEARNING') {
      // BKT-005: evaluation-only sessions need an approved protocol before they exist.
      throw new LessonError(
        422,
        'SESSION_PURPOSE_NOT_ENABLED',
        `${request.sessionPurpose} sessions require an approved evaluation protocol (BKT-005).`,
      );
    }
    const context = this.prepare(datasetId, scenarioId, scope);
    const data = context.registration.dataset;
    const route = context.route;
    if (!learningAccepted(data.learning, scope)) {
      throw new LessonError(
        422,
        'LEARNING_CONFIGURATION_NOT_ACCEPTED',
        `Learning configuration ${data.learning.artifactId} is ${data.learning.status === 'AVAILABLE' ? data.learning.approvalState : data.learning.status} for ${scope}.`,
        'REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED',
      );
    }
    const learning: LearningBinding = {
      artifactId: data.learning.artifactId,
      payloadSha256: data.learning.payloadSha256 as string,
      approvalState: data.learning.approvalState,
      configuration: data.learning.value as LearningConfigurationPayload,
    };
    const chain = await store.chain(
      request.learnerId,
      learning.payloadSha256,
      learning.configuration,
    );
    if (chain === null) {
      throw new LessonError(
        422,
        'LEARNING_CONFIGURATION_INCOMPLETE',
        'The learning configuration has no parameter set, so no learner model can be provisioned.',
      );
    }
    const handles = allocateHandles(this.allStarIds(context));
    const lessonId = randomUUID();
    const session: Session = {
      lessonId,
      learnerId: request.learnerId,
      purpose: request.sessionPurpose,
      datasetId,
      scope,
      context,
      learning,
      handles,
      stepIndex: 0,
      issued: null,
      attempts: new Map(),
    };
    await store.openSession({
      lessonId,
      learnerId: request.learnerId,
      datasetId,
      scenarioId,
      locationName: context.observerLabel,
      routeId: route.stableId,
      startedAt: new Date().toISOString(),
    });
    this.issue(session, chain);
    this.remember(session);
    const registration = context.registration;
    return {
      contractVersion: LESSON_CONTRACT_VERSION,
      lessonId,
      learnerId: request.learnerId,
      sessionPurpose: session.purpose,
      datasetId,
      scenario: {
        scenarioId: context.scenario.scenarioId,
        label: context.scenario.label,
        utc: context.scenario.utc,
      },
      observerLabel: context.observerLabel,
      routeTitle: route.title,
      stars: skyStars(context, handles),
      currentStep: session.issued?.prompt ?? null,
      provenance: {
        profileId: context.profileId,
        executionScope: scope,
        scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION',
        contentReviewState: route.review.state,
        learningConfiguration: {
          artifactId: learning.artifactId,
          payloadSha256: learning.payloadSha256,
          approvalState: learning.approvalState,
          mode: learningModeOf(learning.configuration),
        },
        algorithmId: `${PROFILE_V1_ALGORITHM_IDENTITY.algorithmId}@${PROFILE_V1_ALGORITHM_IDENTITY.algorithmVersion}`,
        artifactHashes: context.artifactHashes,
        notices: [registration.notice, ...registration.attributions],
      },
    };
  }

  /**
   * The taught walkthrough for the scenario's route (report storyboard figure 3-5): every
   * frame names its figure, draws its lines and guides, and shows the cited card text. It
   * has its own handles and is never scored, so it reveals nothing about an assessment.
   */
  createWalkthrough(request: {
    datasetId: string;
    scenarioId: string;
    executionScope: ExecutionScope;
  }): WalkthroughV2 {
    const context = this.prepare(request.datasetId, request.scenarioId, request.executionScope);
    const handles = allocateHandles(this.allStarIds(context));
    const handle = (starId: string) => handles.handleOf.get(starId) as string;
    const enuOf = new Map<string, readonly number[]>([
      ...[...context.directions.entries()].map(([id, d]) => [id, d.enu] as const),
      ...context.background.map((star) => [star.starId, star.enu] as const),
    ]);
    const starIdOfHip = (hip: number) => context.routeStarByHip.get(hip) ?? `hip-${hip}`;
    const visible = (starIds: readonly string[]) => {
      const up = starIds
        .map((id) => enuOf.get(id)?.[2])
        .filter((z): z is number => z !== undefined);
      return up.length > 0 && up.reduce((sum, z) => sum + z, 0) / up.length > 0;
    };
    const culture = context.culture;
    const patterns = new Map(context.content.patterns.map((p) => [p.stableId, p]));
    const directionsById = new Map(context.content.directions.map((d) => [d.stableId, d]));
    const frames: WalkthroughFrameV2[] = [];
    const skipped: string[] = [];
    const firstLabel = (labels: readonly CulturalLabel[]) => {
      const arabic = labels.find((l) => l.languageTag === 'ar' && l.script !== null);
      const text =
        labels.find((l) => l.transliteration !== null)?.transliteration ?? labels[0]?.script ?? '';
      return { arabic: arabic?.script ?? null, text };
    };
    const citationReferences = (citations: readonly { sourceId: string; locator: string }[]) =>
      references(citations, false);

    for (const frame of context.route.walkthrough) {
      const focus = frame.focus;
      let built: Omit<WalkthroughFrameV2, 'frameId' | 'instruction'> | null = null;
      let starIds: string[] = [];
      if (focus.kind === 'CULTURE_FIGURE' && culture) {
        const figure = culture.figures.find((f) => f.figureId === focus.figureId);
        if (figure) {
          starIds = figure.members.map(starIdOfHip).filter((id) => enuOf.has(id));
          built = {
            title: { arabic: figure.arabic, text: figure.transliteration },
            about: figure.about,
            references: references(figure.aboutSources, figure.compilationEntry !== 'SYNTHETIC'),
            layerNote:
              figure.lineSource === 'UFUQ_TEACHING_AID'
                ? 'Lines: a UFUQ teaching aid, not the compilation’s.'
                : null,
            focusHandles: starIds.map(handle),
            focusEnu: [],
            overlays: [
              { kind: 'FIGURE_LINES', segments: figureLines(context, handles, [figure]) },
              figureNames(context, handles, culture, [figure], []),
            ],
          };
        }
      } else if (focus.kind === 'CULTURE_STAR' && culture) {
        const star = culture.stars.find((s) => s.hip === focus.hip);
        if (star) {
          starIds = [starIdOfHip(star.hip)].filter((id) => enuOf.has(id));
          built = {
            title: { arabic: star.arabic, text: star.transliteration },
            about: star.about,
            references: references(star.aboutSources, true),
            layerNote: null,
            focusHandles: starIds.map(handle),
            focusEnu: [],
            overlays: [figureNames(context, handles, culture, [], [star])],
          };
        }
      } else if (focus.kind === 'PATTERN') {
        const pattern = patterns.get(focus.patternId);
        if (pattern) {
          starIds = [...pattern.memberStarIds];
          built = {
            title: firstLabel(pattern.labels),
            about: pattern.shapeHint,
            references: citationReferences(pattern.membershipCitations),
            layerNote:
              pattern.lineSegmentLayer === 'MODERN_PEDAGOGICAL'
                ? 'Lines: a UFUQ teaching aid.'
                : null,
            focusHandles: starIds.map(handle),
            focusEnu: [],
            overlays: [outlineOf(pattern, handle)],
          };
        }
      } else if (focus.kind === 'RELATIONSHIP') {
        const relationship = context.content.relationships.find(
          (r) => r.stableId === focus.relationshipId,
        );
        if (relationship) {
          const instruction = relationship.instruction;
          const target =
            relationship.target.kind === 'direction'
              ? directionsById.get(relationship.target.stableId)
              : undefined;
          const targetPattern =
            relationship.target.kind === 'pattern'
              ? patterns.get(relationship.target.stableId)
              : undefined;
          const source = patterns.get(relationship.source.stableId);
          starIds = guideStarIds(instruction);
          const guide = guideOverlay(context, relationship, 'FULL', handle);
          const azimuth = target ? context.targetAzimuths.get(target.stableId) : undefined;
          const bearingText =
            target?.definition.kind === 'QIBLA_SPHERICAL_INITIAL_BEARING' && azimuth !== undefined
              ? ` From ${context.observerLabel}, the Qibla is ${degreesMinutes(azimuth)} clockwise from True North, that is ${degreesMinutes(2 * Math.PI - azimuth)} west of north.`
              : '';
          built = {
            title: target
              ? firstLabel(target.labels)
              : targetPattern
                ? firstLabel(targetPattern.labels)
                : { arabic: null, text: relationship.stableId },
            about: `${relationship.explanation}${bearingText}${relationship.historicalContext ? ` ${relationship.historicalContext.text}` : ''}`,
            references: citationReferences([
              ...relationship.citations,
              ...(relationship.historicalContext?.citations ?? []),
            ]),
            layerNote:
              relationship.layer === 'MODERN_PEDAGOGICAL'
                ? 'Guide line: a modern UFUQ teaching aid, not a historical figure.'
                : null,
            focusHandles: starIds.map(handle),
            focusEnu:
              azimuth === undefined
                ? []
                : azimuth === 0
                  ? [horizonEnu(0)]
                  : [horizonEnu(0), horizonEnu(azimuth)],
            overlays: [...(source ? [outlineOf(source, handle)] : []), ...(guide ? [guide] : [])],
          };
        }
      } else if (focus.kind === 'DIRECTION') {
        const direction = directionsById.get(focus.directionId);
        const azimuth = direction ? context.targetAzimuths.get(direction.stableId) : undefined;
        if (direction && azimuth !== undefined) {
          built = {
            title: firstLabel(direction.labels),
            about: null,
            references: [],
            layerNote: null,
            focusHandles: [],
            focusEnu: [horizonEnu(azimuth)],
            overlays: [],
          };
        }
      }
      // A direction frame is always "visible"; a star focus must be above the horizon.
      if (
        !built ||
        (starIds.length > 0 && !visible(starIds)) ||
        (starIds.length === 0 && built.focusEnu.length === 0)
      ) {
        skipped.push(frame.frameId);
        continue;
      }
      frames.push({ frameId: frame.frameId, instruction: frame.instruction, ...built });
    }
    const registration = context.registration;
    return {
      contractVersion: LESSON_CONTRACT_VERSION,
      walkthroughId: randomUUID(),
      datasetId: request.datasetId,
      scenario: {
        scenarioId: context.scenario.scenarioId,
        label: context.scenario.label,
        utc: context.scenario.utc,
      },
      observerLabel: context.observerLabel,
      routeTitle: context.route.title,
      stars: skyStars(context, handles),
      figureLines: culture ? figureLines(context, handles, culture.figures) : [],
      frames,
      skippedFrameIds: skipped,
      provenance: {
        executionScope: request.executionScope,
        contentReviewState: context.route.review.state,
        notices: [registration.notice, ...registration.attributions],
      },
    };
  }

  async submitAnswer(
    lessonId: string,
    stepId: string,
    answer: StepAnswerV2,
    clientTelemetry: { readonly renderedCueIds: readonly string[] } | null = null,
    learnerId: string | null = null,
  ): Promise<StepFeedbackV2> {
    const session = this.sessions.get(lessonId);
    if (!session) throw new LessonError(404, 'UNKNOWN_LESSON', 'Unknown or expired lesson.');
    // An account's lesson answers only to that signed-in account.
    if (session.learnerId.startsWith('u-') && session.learnerId !== learnerId)
      throw new LessonError(404, 'UNKNOWN_LESSON', 'Unknown or expired lesson.');
    const route = session.context.route;
    const step = route.steps[session.stepIndex];
    const issued = session.issued;
    if (!step || !issued)
      throw new LessonError(409, 'LESSON_COMPLETED', 'The lesson is already complete.');
    if (step.stepId !== stepId)
      throw new LessonError(409, 'STALE_STEP', `The current step is ${step.stepId}.`);
    const expectedKind =
      step.taskKind === 'INDICATE_DIRECTION'
        ? 'DIRECTION'
        : step.taskKind === 'SELECT_ALL_PATTERN_MEMBERS'
          ? 'STAR_SET_SELECTION'
          : 'SKY_POINT';
    if (answer.kind !== expectedKind)
      throw new LessonError(400, 'WRONG_ANSWER_KIND', `A ${expectedKind} answer is required.`);

    // Reject delayed evidence before scoring, so a stale attempt reveals nothing.
    const store = this.store();
    const kc = step.knowledgeComponentId;
    const chain = await store.chain(
      session.learnerId,
      session.learning.payloadSha256,
      session.learning.configuration,
    );
    if (
      kc !== null &&
      chain !== null &&
      issued.expectedMasteryRevision !== chain[kc].mastery.masteryRevision
    ) {
      this.issue(session, chain);
      throw new LessonError(
        409,
        'STALE_MASTERY_REVISION',
        'Newer learning evidence exists for this skill; the task was reissued.',
        undefined,
        session.issued?.prompt,
      );
    }

    const attempt = (session.attempts.get(stepId) ?? 0) + 1;
    const scored = this.score(session, step, answer);
    const outcome = scoredOutcomeOf(scored.score);
    const response: ResponseStatus =
      outcome === 'CORRECT'
        ? 'SCORED_CORRECT'
        : outcome === 'INCORRECT'
          ? 'SCORED_INCORRECT'
          : 'SCORED_UNCLASSIFIED';
    const attemptKind = attempt === 1 ? 'FIRST_ATTEMPT' : 'RETRY_AFTER_FEEDBACK';

    let trace: TutoringTraceV2 | null = null;
    let nextChain = chain;
    if (kc !== null && chain !== null) {
      const result = processAttempt(chain, session.learning.configuration, {
        knowledgeComponentId: kc,
        purpose: session.purpose,
        issuedCues: issued.cues,
        response,
        attemptKind,
        accommodations: [],
        clientTelemetry,
        expectedMasteryRevision: issued.expectedMasteryRevision as number,
      });
      if (!result.ok) {
        throw new LessonError(500, 'MODEL_DECISION_FAILED', `${result.failure}: ${result.detail}`);
      }
      trace = traceOf(result.record, response, attemptKind);
      const committed = await store.commit(
        session.learnerId,
        session.learning.payloadSha256,
        kc,
        issued.expectedMasteryRevision as number,
        result.nextState,
        {
          ...trace,
          lessonId,
          stepId,
          datasetId: session.datasetId,
          cueSnapshotId: issued.cues.snapshotId,
          issuedCueIds: issued.cues.cueIds,
          clientTelemetry,
          userAnswer: answerText(answer),
          timeTakenSeconds: Math.max(0, Math.round((Date.now() - issued.issuedAt) / 1000)),
          hintsShown: issued.cues.cueIds.length > 0,
          attemptedAt: new Date().toISOString(),
        },
      );
      if (committed === 'STALE_MASTERY_REVISION') {
        const latest = await store.chain(
          session.learnerId,
          session.learning.payloadSha256,
          session.learning.configuration,
        );
        this.issue(session, latest);
        throw new LessonError(
          409,
          'STALE_MASTERY_REVISION',
          'Newer learning evidence exists for this skill; the task was reissued.',
          undefined,
          session.issued?.prompt,
        );
      }
      nextChain = result.nextState;
    }

    session.attempts.set(stepId, attempt);
    const advance = outcome !== 'INCORRECT';
    if (advance) session.stepIndex += 1;
    this.issue(session, nextChain);
    const completed = session.stepIndex >= route.steps.length;
    if (completed) await store.closeSession(lessonId, new Date().toISOString());
    return {
      contractVersion: LESSON_CONTRACT_VERSION,
      lessonId,
      stepId,
      attempt,
      result: outcome === 'UNCLASSIFIED' ? 'MEASURED_NO_TOLERANCE' : outcome,
      feedback: scored.feedback(outcome),
      measurement: scored.measurement,
      overlays: completed ? this.summary(session) : [],
      nextStep: session.issued?.prompt ?? null,
      completed,
      trace,
    };
  }

  async learnerTrace(learnerId: string) {
    const store = this.store();
    if (!(await store.learnerExists(learnerId)))
      throw new LessonError(404, 'UNKNOWN_LEARNER', 'Unknown learner.');
    return {
      contractVersion: LESSON_CONTRACT_VERSION,
      learnerId,
      identityKind: 'DEVELOPMENT_FIXTURE' as const,
      attempts: await store.attempts(learnerId),
    };
  }

  private store(): LearnerStore {
    if (!this.learners) {
      throw new LessonError(
        403,
        'DEVELOPMENT_IDENTITY_DISABLED',
        'No learner identity is available: sign in, or enable the development fixture identity.',
      );
    }
    return this.learners;
  }

  private score(session: Session, step: LessonRouteStep, answer: StepAnswerV2) {
    const content = session.context.content;
    const patterns = new Map(content.patterns.map((p) => [p.stableId, p]));
    if (answer.kind === 'DIRECTION') {
      const direction = content.directions.find((d) => d.stableId === step.directionId);
      const target =
        direction === undefined
          ? undefined
          : session.context.targetAzimuths.get(direction.stableId);
      if (!direction || target === undefined)
        throw new LessonError(500, 'CONTENT_INCONSISTENT', 'Direction missing.');
      // A tolerance exists only when the direction record carries one (IMP-012).
      const measurement: DirectionMeasurement = measureDirectionAnswer(
        answer.azimuthRadians,
        target,
        direction.learnerTolerance,
      );
      const relationship = this.relationship(session, step.guidanceRelationshipId);
      const cueStarId =
        relationship?.instruction.kind === 'VERTICAL_TO_HORIZON'
          ? relationship.instruction.fromStarId
          : null;
      const cueAzimuth =
        cueStarId === null
          ? null
          : (session.context.directions.get(cueStarId)?.azimuthRadians ?? null);
      const difference = degrees(measurement.angularDifferenceRadians);
      const name = directionName(direction);
      const tolerance =
        direction.learnerTolerance === null
          ? ''
          : `${degrees(direction.learnerTolerance.maximumDifferenceRadians)}°`;
      const cueText =
        cueAzimuth === null
          ? ''
          : ` The cue star itself is at azimuth ${degrees(cueAzimuth > Math.PI ? cueAzimuth - 2 * Math.PI : cueAzimuth)} degrees: close to True North, but not exactly on it.`;
      const bearingText =
        direction.definition.kind === 'QIBLA_SPHERICAL_INITIAL_BEARING'
          ? ` Here the Qibla is ${degreesMinutes(target)} clockwise from True North.`
          : '';
      return {
        score: measurement,
        measurement: {
          angularDifferenceRadians: measurement.angularDifferenceRadians,
          targetCueAzimuthRadians: cueAzimuth,
        },
        feedback: (outcome: string) =>
          outcome === 'UNCLASSIFIED'
            ? `${step.successFeedback} Your direction differs from ${name} by ${difference} degrees.${cueText} No pass mark is set yet.`
            : outcome === 'CORRECT'
              ? `${step.successFeedback} Your direction differs from ${name} by ${difference} degrees, inside the ${tolerance} tolerance.${cueText}${bearingText}`
              : `${step.retryFeedback} Your direction differs from ${name} by ${difference} degrees, outside the ${tolerance} tolerance.`,
      };
    }
    const pattern = patterns.get(step.patternId as string) as SkyPattern;
    const members = new Set(pattern.memberStarIds);
    const starOf = session.handles.starOf;
    if (answer.kind === 'SKY_POINT') {
      // The circle: its radius is the share of the field of view the learner sees drawn.
      const fov = Math.min(MAXIMUM_POINT_FOV, Math.max(MINIMUM_POINT_FOV, answer.fovRadians));
      const tolerance = POINT_CIRCLE_RADIUS_SHARE * fov;
      const accepted = new Map(
        [...members].flatMap((starId) => {
          const enu = session.context.directions.get(starId)?.enu;
          return enu ? [[starId, [enu[0], enu[1], enu[2]] as const] as const] : [];
        }),
      );
      const cosAlt = Math.cos(answer.altitudeRadians);
      const pointed = scorePointedLocation(
        [
          cosAlt * Math.sin(answer.azimuthRadians),
          cosAlt * Math.cos(answer.azimuthRadians),
          Math.sin(answer.altitudeRadians),
        ],
        accepted,
        tolerance,
      );
      const name = firstName(pattern.labels);
      return {
        score: pointed,
        measurement: null,
        feedback: (outcome: string) =>
          outcome === 'CORRECT'
            ? `${step.successFeedback} The circle was ${degrees(pointed.separationRadians ?? 0)}° from the nearest star of ${name}.`
            : `${step.retryFeedback} The circle must cover a star of ${name}: drag the sky until it does, and zoom in for a smaller circle.`,
      };
    }
    const score: StarSetScore = scoreStarSetSelection(
      answer.starHandles.map((handle) => starOf.get(handle) ?? null),
      members,
    );
    return {
      score,
      measurement: null,
      feedback: (outcome: string) =>
        outcome === 'CORRECT' ? step.successFeedback : step.retryFeedback,
    };
  }

  /** Issues the current step with a fresh cue snapshot from the learner's current state. */
  private issue(session: Session, chain: LearnerModelState | null): void {
    const route = session.context.route;
    const step = route.steps[session.stepIndex];
    if (!step) {
      session.issued = null;
      return;
    }
    const configuration = session.learning.configuration;
    const mode = learningModeOf(configuration);
    const kc = step.knowledgeComponentId;
    const scaffoldState = kc !== null && chain !== null ? chain[kc].scaffoldState : null;
    const configured: readonly CueId[] =
      kc === null || (mode === 'ADAPTIVE' && scaffoldState === null)
        ? []
        : configuredCues(configuration.cueConfiguration, kc, scaffoldState);
    const rendered = this.renderCues(session, step, configured);
    const cueConfiguration = configuration.cueConfiguration;
    const cues: IssuedTaskCues = {
      snapshotId: `cues-${randomBytes(6).toString('hex')}`,
      cueConfigurationId: cueConfiguration.configurationId,
      cueConfigurationVersion: cueConfiguration.configurationVersion,
      scaffoldState: mode === 'ADAPTIVE' ? scaffoldState : null,
      cueIds: rendered.issued,
    };
    session.issued = {
      stepId: step.stepId,
      cues,
      issuedAt: Date.now(),
      expectedMasteryRevision:
        kc !== null && chain !== null ? chain[kc].mastery.masteryRevision : null,
      prompt: {
        stepId: step.stepId,
        stepNumber: session.stepIndex + 1,
        stepCount: route.steps.length,
        taskKind: step.taskKind,
        knowledgeComponentId: kc,
        prompt: step.prompt,
        hideCardinalLabels:
          mode === 'ADAPTIVE'
            ? !rendered.issued.includes('CARDINAL_MARKS')
            : step.taskKind === 'INDICATE_DIRECTION',
        support: {
          mode,
          scaffoldState: cues.scaffoldState,
          cueSnapshotId: cues.snapshotId,
          cueIds: cues.cueIds,
        },
        overlays: rendered.overlays,
        hints: rendered.hints,
      },
    };
  }

  /** Renders configured cues that apply to this step; only rendered cues are recorded. */
  private renderCues(session: Session, step: LessonRouteStep, cues: readonly CueId[]) {
    const context = session.context;
    const handle = (starId: string) => session.handles.handleOf.get(starId) as string;
    const overlays: SkyOverlayV2[] = [];
    const hints: string[] = [];
    const issued: CueId[] = [];
    const pattern =
      step.patternId === null
        ? undefined
        : context.content.patterns.find((p) => p.stableId === step.patternId);
    const relationship = this.relationship(session, step.guidanceRelationshipId);
    const source =
      relationship === undefined
        ? undefined
        : context.content.patterns.find((p) => p.stableId === relationship.source.stableId);
    const direction =
      step.directionId === null
        ? undefined
        : context.content.directions.find((d) => d.stableId === step.directionId);
    const qiblaAzimuth =
      direction?.definition.kind === 'QIBLA_SPHERICAL_INITIAL_BEARING'
        ? context.targetAzimuths.get(direction.stableId)
        : undefined;
    const culture = context.culture;
    for (const cue of cues) {
      let applied = false;
      if (cue === 'TARGET_OUTLINE' && pattern) {
        overlays.push(outlineOf(pattern, handle));
        applied = true;
      } else if (cue === 'SHAPE_HINT_TEXT' && pattern) {
        hints.push(pattern.shapeHint);
        applied = true;
      } else if (cue === 'SOURCE_PATTERN_OUTLINE' && source) {
        overlays.push(outlineOf(source, handle));
        applied = true;
      } else if ((cue === 'GUIDE_LINE_FULL' || cue === 'GUIDE_LINE_PARTIAL') && relationship) {
        const guide = guideOverlay(
          context,
          relationship,
          cue === 'GUIDE_LINE_FULL' ? 'FULL' : 'PARTIAL',
          handle,
        );
        if (guide) {
          overlays.push(guide);
          applied = true;
        }
      } else if (cue === 'SOURCE_STAR_LABEL' && relationship && source) {
        overlays.push({
          kind: 'STAR_LABEL',
          handle: handle(relationship.instruction.fromStarId),
          labels: labelsOf(source.labels),
        });
        applied = true;
      } else if (cue === 'FIGURE_LINES' && culture) {
        overlays.push({
          kind: 'FIGURE_LINES',
          segments: figureLines(context, session.handles, culture.figures),
        });
        applied = true;
      } else if (cue === 'FIGURE_NAMES' && culture) {
        overlays.push(
          figureNames(
            context,
            session.handles,
            culture,
            culture.figures,
            culture.stars.filter(
              (star) => star.labelOnSky || culture.guidanceTarget?.hip === star.hip,
            ),
          ),
        );
        applied = true;
      } else if (cue === 'CARDINAL_MARKS') {
        applied = true; // rendered by the scene's horizon letters (hideCardinalLabels false)
      } else if (cue === 'QIBLA_ARC_FULL' && relationship && qiblaAzimuth !== undefined) {
        const guide = guideOverlay(context, relationship, 'FULL', handle);
        if (guide) {
          overlays.push(guide);
          applied = true;
        }
      } else if (cue === 'QIBLA_BEARING_TEXT' && qiblaAzimuth !== undefined) {
        hints.push(
          `From ${context.observerLabel}, the Qibla is ${degreesMinutes(qiblaAzimuth)} clockwise from True North (${degreesMinutes(2 * Math.PI - qiblaAzimuth)} west of north).`,
        );
        applied = true;
      }
      if (applied) issued.push(cue);
    }
    return { overlays, hints, issued };
  }

  private remember(session: Session) {
    if (this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (oldest !== undefined) this.sessions.delete(oldest);
    }
    this.sessions.set(session.lessonId, session);
  }

  private relationship(session: Session, id: string | null): GuidanceRelationship | undefined {
    return id === null
      ? undefined
      : session.context.content.relationships.find((r) => r.stableId === id);
  }

  /** Route summary shown after completion: every pattern outline and full guide. */
  private summary(session: Session): SkyOverlayV2[] {
    const handle = (starId: string) => session.handles.handleOf.get(starId) as string;
    const overlays: SkyOverlayV2[] = [];
    const content = session.context.content;
    for (const step of session.context.route.steps) {
      const pattern =
        step.patternId === null
          ? undefined
          : content.patterns.find((p) => p.stableId === step.patternId);
      if (pattern) overlays.push(outlineOf(pattern, handle));
      const relationship = this.relationship(session, step.guidanceRelationshipId);
      const guide = relationship
        ? guideOverlay(session.context, relationship, 'FULL', handle)
        : null;
      if (guide) overlays.push(guide);
    }
    return overlays;
  }
}

function answerText(answer: StepAnswerV2): string {
  if (answer.kind === 'DIRECTION') return `azimuth ${answer.azimuthRadians.toFixed(6)} rad`;
  if (answer.kind === 'SKY_POINT')
    return `point az ${answer.azimuthRadians.toFixed(5)} alt ${answer.altitudeRadians.toFixed(5)} fov ${answer.fovRadians.toFixed(4)} rad`;
  return `handles ${answer.starHandles.join(',')}`;
}

/** The name a learner knows a pattern by: its transliteration, else its script. */
function firstName(labels: readonly CulturalLabel[]): string {
  return (
    labels.find((l) => l.transliteration !== null)?.transliteration ??
    labels[0]?.script ??
    'the pattern'
  );
}

const DEG_RADIANS = Math.PI / 180;
/** The reported field of view is clamped before it sets the circle's radius. */
const MINIMUM_POINT_FOV = 2 * DEG_RADIANS;
const MAXIMUM_POINT_FOV = 120 * DEG_RADIANS;

function outlineOf(pattern: SkyPattern, handle: (starId: string) => string): SkyOverlayV2 {
  return {
    kind: 'PATTERN_OUTLINE',
    patternId: pattern.stableId,
    segments: pattern.lineSegments.map((s) => [handle(s.fromStarId), handle(s.toStarId)] as const),
    memberHandles: pattern.memberStarIds.map(handle),
    labels: labelsOf(pattern.labels),
    lineLayer: pattern.lineSegmentLayer,
  };
}

function guideStarIds(instruction: GuidanceRelationship['instruction']): string[] {
  if (instruction.kind === 'GREAT_CIRCLE_ARC')
    return [instruction.fromStarId, instruction.toStarId];
  if (instruction.kind === 'POINTER_EXTENSION')
    return [instruction.fromStarId, instruction.throughStarId, instruction.toStarId];
  return [instruction.fromStarId];
}

function guideOverlay(
  context: SkyContext,
  relationship: GuidanceRelationship,
  extent: 'FULL' | 'PARTIAL',
  handle: (starId: string) => string,
): SkyOverlayV2 | null {
  const instruction = relationship.instruction;
  if (instruction.kind === 'HORIZON_TURN_FROM_NORTH') {
    // The arc ends on the answer itself, so it has no partial form.
    const target =
      relationship.target.kind === 'direction'
        ? context.targetAzimuths.get(relationship.target.stableId)
        : undefined;
    if (extent === 'PARTIAL' || target === undefined) return null;
    return {
      kind: 'HORIZON_ARC',
      relationshipId: relationship.stableId,
      fromAzimuthRadians: 0,
      toAzimuthRadians: target,
      label: `Qibla ${degreesMinutes(target)}`,
      explanation: relationship.explanation,
    };
  }
  if (instruction.kind === 'VERTICAL_TO_HORIZON') {
    // The vertical ends on the answer itself, so it has no partial form.
    if (extent === 'PARTIAL') return null;
    return {
      kind: 'VERTICAL_TO_HORIZON',
      relationshipId: relationship.stableId,
      fromHandle: handle(instruction.fromStarId),
      layer: relationship.layer,
      explanation: relationship.explanation,
      historicalContext: relationship.historicalContext?.text ?? null,
    };
  }
  if (extent === 'PARTIAL') {
    const from = context.directions.get(instruction.fromStarId)?.enu;
    const to = context.directions.get(instruction.toStarId)?.enu;
    if (!from || !to) return null;
    // The great-circle midpoint is the normalized sum; nearly opposite stars have none.
    const sum = [from[0] + to[0], from[1] + to[1], from[2] + to[2]] as const;
    const length = Math.hypot(...sum);
    if (!(length > 1e-6)) return null;
    return {
      kind: 'GUIDE_ARC_PARTIAL',
      relationshipId: relationship.stableId,
      fromHandle: handle(instruction.fromStarId),
      endEnu: [sum[0] / length, sum[1] / length, sum[2] / length],
      layer: relationship.layer,
      explanation: relationship.explanation,
    };
  }
  return {
    kind: 'GUIDE_ARC',
    relationshipId: relationship.stableId,
    handles: guideStarIds(instruction).map(handle),
    layer: relationship.layer,
    explanation: relationship.explanation,
  };
}

export type { ScenarioPreset };
