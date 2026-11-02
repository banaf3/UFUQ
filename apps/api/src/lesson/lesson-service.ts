/**
 * Server-authoritative lesson flow (IMP-004, IMP-018; Phase 3): evaluates the scenario sky
 * with ScientificProfileV1 semantics, selects the first eligible route from data, issues
 * opaque star handles and per-step cue snapshots, scores raw learner evidence, and passes
 * each accepted attempt through the pure learner model (tutoring-core). In-memory sessions
 * and development learners only; durable persistence is Phase 4.
 */
import { randomBytes, randomUUID } from 'node:crypto';

import {
  type DirectionMeasurement,
  measureDirectionAnswer,
  scoredOutcomeOf,
  scoreStarSelection,
  scoreStarSetSelection,
  type StarSelectionScore,
  type StarSetScore,
} from '@ufuq/assessment-core';
import {
  type ExecutionScope,
  evaluateProfile,
  type GeometricHorizontalDirection,
  PROFILE_V1_ALGORITHM_IDENTITY,
} from '@ufuq/astronomy-core';
import type {
  ContentReview,
  CulturalLabel,
  GuidanceRelationship,
  LessonContentPayload,
  LessonRoute,
  LessonRouteStep,
  ScenarioPreset,
  SkyPattern,
} from '@ufuq/catalogue-schema';
import {
  LESSON_CONTRACT_VERSION,
  type LessonSessionV2,
  type LessonStepPromptV2,
  type OverlayLabelV2,
  type SessionPurposeV2,
  type SkyOverlayV2,
  type StepAnswerV2,
  type StepFeedbackV2,
  type TutoringTraceV2,
} from '@ufuq/contracts';
import {
  type AttemptDecisionRecord,
  configuredCues,
  type CueId,
  type IssuedTaskCues,
  type LearningConfigurationPayload,
  learningModeOf,
  processAttempt,
  type ResponseStatus,
} from '@ufuq/tutoring-core';

import type { LoadedArtifact, LoadedDataset } from '../data/artifacts.js';
import type {
  DevelopmentLearner,
  DevelopmentLearnerRegistry,
} from '../learners/development-learners.js';

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
  readonly cues: IssuedTaskCues;
  /** Null for a step that credits no knowledge component. */
  readonly expectedMasteryRevision: number | null;
  readonly prompt: LessonStepPromptV2;
}

interface Session {
  readonly lessonId: string;
  readonly learner: DevelopmentLearner;
  readonly purpose: SessionPurposeV2;
  readonly datasetId: string;
  readonly scope: ExecutionScope;
  readonly route: LessonRoute;
  readonly content: LessonContentPayload;
  readonly learning: LearningBinding;
  readonly directions: ReadonlyMap<string, GeometricHorizontalDirection>;
  readonly handleOf: ReadonlyMap<string, string>;
  readonly starOf: ReadonlyMap<string, string>;
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

export class LessonService {
  private readonly sessions = new Map<string, Session>();
  private readonly maxSessions = 500;

  constructor(
    private readonly datasets: ReadonlyMap<string, DatasetRegistration>,
    private readonly learners: DevelopmentLearnerRegistry | null,
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

  createLesson(request: {
    datasetId: string;
    scenarioId: string;
    executionScope: ExecutionScope;
    learnerId: string;
    sessionPurpose: SessionPurposeV2;
  }): LessonSessionV2 {
    const { datasetId, scenarioId, executionScope: scope } = request;
    const learner = this.learner(request.learnerId);
    if (request.sessionPurpose !== 'LEARNING') {
      // BKT-005: evaluation-only sessions need an approved protocol before they exist.
      throw new LessonError(
        422,
        'SESSION_PURPOSE_NOT_ENABLED',
        `${request.sessionPurpose} sessions require an approved evaluation protocol (BKT-005).`,
      );
    }
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
    const eligibility = evaluateRouteEligibility(content, directions, scope);
    const selected = eligibility.find((route) => route.eligible);
    if (!selected) {
      throw new LessonError(
        422,
        'NO_ELIGIBLE_ROUTE',
        eligibility.map((route) => `${route.routeId}: ${route.reasons.join('; ')}`).join(' | '),
      );
    }
    const route = content.routes.find((r) => r.stableId === selected.routeId) as LessonRoute;
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
    if (this.registry().chain(learner, learning.payloadSha256, learning.configuration) === null) {
      throw new LessonError(
        422,
        'LEARNING_CONFIGURATION_INCOMPLETE',
        'The learning configuration has no parameter set, so no learner model can be provisioned.',
      );
    }
    const handleOf = new Map<string, string>();
    const starOf = new Map<string, string>();
    for (const starId of [...directions.keys(), ...background.map((star) => star.starId)].sort()) {
      let handle: string;
      do handle = `h-${randomBytes(6).toString('hex')}`;
      while (starOf.has(handle));
      handleOf.set(starId, handle);
      starOf.set(handle, starId);
    }
    const lessonId = randomUUID();
    const session: Session = {
      lessonId,
      learner,
      purpose: request.sessionPurpose,
      datasetId,
      scope,
      route,
      content,
      learning,
      directions,
      handleOf,
      starOf,
      stepIndex: 0,
      issued: null,
      attempts: new Map(),
    };
    this.issue(session);
    this.remember(session);
    const notices = [registration.notice, ...registration.attributions];
    return {
      contractVersion: LESSON_CONTRACT_VERSION,
      lessonId,
      learnerId: learner.learnerId,
      sessionPurpose: session.purpose,
      datasetId,
      scenario: { scenarioId: scenario.scenarioId, label: scenario.label, utc: scenario.utc },
      observerLabel: observer?.displayLabel ?? '',
      routeTitle: route.title,
      // Stars are listed in a random-handle order so list position reveals nothing.
      stars: [
        ...[...directions.entries()].map(([starId, direction]) => ({
          handle: handleOf.get(starId) as string,
          enu: roundedEnu(direction.enu),
          visualMagnitude: direction.visualMagnitude,
          colorIndexBV: colorOf.get(`hip-${hipOfRoute.get(starId)}`) ?? null,
          belowGeometricHorizon: direction.horizonClassification === 'BELOW_GEOMETRIC_HORIZON',
        })),
        ...background.map((star) => ({
          handle: handleOf.get(star.starId) as string,
          enu: roundedEnu(star.enu),
          visualMagnitude: star.visualMagnitude,
          colorIndexBV: star.colorIndexBV,
          belowGeometricHorizon: star.altitudeRadians < 0,
        })),
      ].sort((a, b) => a.handle.localeCompare(b.handle)),
      currentStep: session.issued?.prompt ?? null,
      provenance: {
        profileId: evaluation.profileId,
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
        artifactHashes: evaluation.artifactIdentities,
        notices,
      },
    };
  }

  submitAnswer(
    lessonId: string,
    stepId: string,
    answer: StepAnswerV2,
    clientTelemetry: { readonly renderedCueIds: readonly string[] } | null = null,
  ): StepFeedbackV2 {
    const session = this.sessions.get(lessonId);
    if (!session) throw new LessonError(404, 'UNKNOWN_LESSON', 'Unknown or expired lesson.');
    const step = session.route.steps[session.stepIndex];
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
          : 'STAR_SELECTION';
    if (answer.kind !== expectedKind)
      throw new LessonError(400, 'WRONG_ANSWER_KIND', `A ${expectedKind} answer is required.`);

    // Reject delayed evidence before scoring, so a stale attempt reveals nothing.
    const kc = step.knowledgeComponentId;
    const chain = this.registry().chain(
      session.learner,
      session.learning.payloadSha256,
      session.learning.configuration,
    );
    if (
      kc !== null &&
      chain !== null &&
      issued.expectedMasteryRevision !== chain[kc].mastery.masteryRevision
    ) {
      this.issue(session);
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
      this.registry().commit(session.learner, session.learning.payloadSha256, result.nextState, {
        ...trace,
        lessonId,
        stepId,
        datasetId: session.datasetId,
        cueSnapshotId: issued.cues.snapshotId,
        issuedCueIds: issued.cues.cueIds,
        clientTelemetry,
      });
    }

    session.attempts.set(stepId, attempt);
    const advance = outcome !== 'INCORRECT';
    if (advance) session.stepIndex += 1;
    this.issue(session);
    const completed = session.stepIndex >= session.route.steps.length;
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

  learnerTrace(learnerId: string) {
    const learner = this.learner(learnerId);
    return {
      contractVersion: LESSON_CONTRACT_VERSION,
      learnerId: learner.learnerId,
      identityKind: 'DEVELOPMENT_FIXTURE' as const,
      attempts: learner.attempts,
    };
  }

  private registry(): DevelopmentLearnerRegistry {
    if (!this.learners) {
      throw new LessonError(
        403,
        'DEVELOPMENT_IDENTITY_DISABLED',
        'No learner identity is available: authentication arrives in Phase 4 and the development fixture identity is not enabled.',
      );
    }
    return this.learners;
  }

  private learner(learnerId: string): DevelopmentLearner {
    const learner = this.registry().get(learnerId);
    if (!learner) throw new LessonError(404, 'UNKNOWN_LEARNER', 'Unknown development learner.');
    return learner;
  }

  private score(session: Session, step: LessonRouteStep, answer: StepAnswerV2) {
    const patterns = new Map(session.content.patterns.map((p) => [p.stableId, p]));
    if (answer.kind === 'DIRECTION') {
      const direction = session.content.directions.find((d) => d.stableId === step.directionId);
      if (!direction) throw new LessonError(500, 'CONTENT_INCONSISTENT', 'Direction missing.');
      // A tolerance exists only when the reviewed direction record carries one (IMP-012).
      const measurement: DirectionMeasurement = measureDirectionAnswer(
        answer.azimuthRadians,
        direction.definition.azimuthRadians,
        direction.learnerTolerance,
      );
      const relationship = this.relationship(session, step.guidanceRelationshipId);
      const cueStarId =
        relationship?.instruction.kind === 'VERTICAL_TO_HORIZON'
          ? relationship.instruction.fromStarId
          : null;
      const cueAzimuth =
        cueStarId === null ? null : (session.directions.get(cueStarId)?.azimuthRadians ?? null);
      const difference = degrees(measurement.angularDifferenceRadians);
      const cueText =
        cueAzimuth === null
          ? ''
          : ` The cue star itself is at azimuth ${degrees(cueAzimuth > Math.PI ? cueAzimuth - 2 * Math.PI : cueAzimuth)} degrees: close to True North, but not exactly on it.`;
      return {
        score: measurement,
        measurement: {
          angularDifferenceRadians: measurement.angularDifferenceRadians,
          targetCueAzimuthRadians: cueAzimuth,
        },
        feedback: (outcome: string) =>
          outcome === 'UNCLASSIFIED'
            ? `${step.successFeedback} Your direction differs from True North by ${difference} degrees.${cueText} No pass mark is set yet: learner tolerances are still under review.`
            : outcome === 'CORRECT'
              ? `${step.successFeedback} Your direction differs from True North by ${difference} degrees, inside the tolerance of policy ${direction.learnerTolerance?.policyId}.${cueText}`
              : `${step.retryFeedback} Your direction differs from True North by ${difference} degrees, outside the tolerance of policy ${direction.learnerTolerance?.policyId}.`,
      };
    }
    const pattern = patterns.get(step.patternId as string) as SkyPattern;
    const members = new Set(pattern.memberStarIds);
    const score: StarSelectionScore | StarSetScore =
      answer.kind === 'STAR_SET_SELECTION'
        ? scoreStarSetSelection(
            answer.starHandles.map((handle) => session.starOf.get(handle) ?? null),
            members,
          )
        : scoreStarSelection(session.starOf.get(answer.starHandle) ?? null, members);
    return {
      score,
      measurement: null,
      feedback: (outcome: string) =>
        outcome === 'CORRECT' ? step.successFeedback : step.retryFeedback,
    };
  }

  /** Issues the current step with a fresh cue snapshot from the learner's current state. */
  private issue(session: Session): void {
    const step = session.route.steps[session.stepIndex];
    if (!step) {
      session.issued = null;
      return;
    }
    const configuration = session.learning.configuration;
    const mode = learningModeOf(configuration);
    const kc = step.knowledgeComponentId;
    const chain = this.registry().chain(
      session.learner,
      session.learning.payloadSha256,
      configuration,
    );
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
      expectedMasteryRevision:
        kc !== null && chain !== null ? chain[kc].mastery.masteryRevision : null,
      prompt: {
        stepId: step.stepId,
        stepNumber: session.stepIndex + 1,
        stepCount: session.route.steps.length,
        taskKind: step.taskKind,
        knowledgeComponentId: kc,
        prompt: step.prompt,
        hideCardinalLabels: step.taskKind === 'INDICATE_DIRECTION',
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
    const overlays: SkyOverlayV2[] = [];
    const hints: string[] = [];
    const issued: CueId[] = [];
    const pattern =
      step.patternId === null
        ? undefined
        : session.content.patterns.find((p) => p.stableId === step.patternId);
    const relationship = this.relationship(session, step.guidanceRelationshipId);
    const source =
      relationship === undefined
        ? undefined
        : session.content.patterns.find((p) => p.stableId === relationship.source.stableId);
    for (const cue of cues) {
      let applied = false;
      if (cue === 'TARGET_OUTLINE' && pattern) {
        overlays.push(this.outline(session, pattern));
        applied = true;
      } else if (cue === 'SHAPE_HINT_TEXT' && pattern) {
        hints.push(pattern.shapeHint);
        applied = true;
      } else if (cue === 'SOURCE_PATTERN_OUTLINE' && source) {
        overlays.push(this.outline(session, source));
        applied = true;
      } else if ((cue === 'GUIDE_LINE_FULL' || cue === 'GUIDE_LINE_PARTIAL') && relationship) {
        const guide = this.guide(
          session,
          relationship,
          cue === 'GUIDE_LINE_FULL' ? 'FULL' : 'PARTIAL',
        );
        if (guide) {
          overlays.push(guide);
          applied = true;
        }
      } else if (cue === 'SOURCE_STAR_LABEL' && relationship && source) {
        overlays.push({
          kind: 'STAR_LABEL',
          handle: session.handleOf.get(relationship.instruction.fromStarId) as string,
          labels: labelsOf(source.labels),
        });
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
    return id === null ? undefined : session.content.relationships.find((r) => r.stableId === id);
  }

  private outline(session: Session, pattern: SkyPattern): SkyOverlayV2 {
    const handle = (starId: string) => session.handleOf.get(starId) as string;
    return {
      kind: 'PATTERN_OUTLINE',
      patternId: pattern.stableId,
      segments: pattern.lineSegments.map(
        (s) => [handle(s.fromStarId), handle(s.toStarId)] as const,
      ),
      memberHandles: pattern.memberStarIds.map(handle),
      labels: labelsOf(pattern.labels),
      lineLayer: pattern.lineSegmentLayer,
    };
  }

  private guide(
    session: Session,
    relationship: GuidanceRelationship,
    extent: 'FULL' | 'PARTIAL',
  ): SkyOverlayV2 | null {
    const handle = (starId: string) => session.handleOf.get(starId) as string;
    const instruction = relationship.instruction;
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
      const from = session.directions.get(instruction.fromStarId)?.enu;
      const to = session.directions.get(instruction.toStarId)?.enu;
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
    const handles =
      instruction.kind === 'GREAT_CIRCLE_ARC'
        ? [handle(instruction.fromStarId), handle(instruction.toStarId)]
        : [
            handle(instruction.fromStarId),
            handle(instruction.throughStarId),
            handle(instruction.toStarId),
          ];
    return {
      kind: 'GUIDE_ARC',
      relationshipId: relationship.stableId,
      handles,
      layer: relationship.layer,
      explanation: relationship.explanation,
    };
  }

  /** Route summary shown after completion: every pattern outline and full guide. */
  private summary(session: Session): SkyOverlayV2[] {
    const overlays: SkyOverlayV2[] = [];
    for (const step of session.route.steps) {
      const pattern =
        step.patternId === null
          ? undefined
          : session.content.patterns.find((p) => p.stableId === step.patternId);
      if (pattern) overlays.push(this.outline(session, pattern));
      const relationship = this.relationship(session, step.guidanceRelationshipId);
      const guide = relationship ? this.guide(session, relationship, 'FULL') : null;
      if (guide) overlays.push(guide);
    }
    return overlays;
  }
}

export type { ScenarioPreset };
