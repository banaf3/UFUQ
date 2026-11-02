/**
 * Server-authoritative lesson flow (IMP-004, IMP-018): evaluates the scenario sky with
 * ScientificProfileV1 semantics, selects the first eligible route from data, issues
 * opaque star handles, and scores raw learner evidence. In-memory sessions only; durable
 * persistence is Phase 4.
 */
import { randomBytes, randomUUID } from 'node:crypto';

import { measureDirectionAnswer, scoreStarSelection } from '@ufuq/assessment-core';
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
import type {
  LessonSessionV1,
  LessonStepPromptV1,
  OverlayLabelV1,
  SkyOverlayV1,
  StepAnswerV1,
  StepFeedbackV1,
} from '@ufuq/contracts';

import type { LoadedDataset } from '../data/artifacts.js';

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
  ) {
    super(message);
  }
}

interface Session {
  readonly lessonId: string;
  readonly datasetId: string;
  readonly scope: ExecutionScope;
  readonly route: LessonRoute;
  readonly content: LessonContentPayload;
  readonly directions: ReadonlyMap<string, GeometricHorizontalDirection>;
  readonly handleOf: ReadonlyMap<string, string>;
  readonly starOf: ReadonlyMap<string, string>;
  stepIndex: number;
  readonly attempts: Map<string, number>;
}

/** Content review acceptance mirrors scientific approval acceptance per execution scope. */
export function contentAccepted(review: ContentReview, scope: ExecutionScope): boolean {
  const approvalScope =
    scope === 'SYNTHETIC_TECHNICAL_FIXTURE'
      ? 'SYNTHETIC_TECHNICAL_FIXTURE'
      : 'SCIENTIFIC_PROFILE_V1';
  if (review.scope !== approvalScope) return false;
  if (review.state === 'APPROVED') return true;
  return scope === 'REVIEW_PREVIEW' && review.state === 'REVIEW_REQUIRED';
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

function labelsOf(labels: readonly CulturalLabel[]): OverlayLabelV1[] {
  return labels.map((l) => ({
    languageTag: l.languageTag,
    script: l.script,
    transliteration: l.transliteration,
    gloss: l.gloss,
    layer: l.layer,
  }));
}

export class LessonService {
  private readonly sessions = new Map<string, Session>();
  private readonly maxSessions = 500;

  constructor(private readonly datasets: ReadonlyMap<string, DatasetRegistration>) {}

  listDatasets() {
    return [...this.datasets.values()].map((registration) => {
      const d = registration.dataset;
      const approvals = [d.stars, d.leap, d.eop, d.observer, d.domain, d.content].map(
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
        notice: registration.notice,
      };
    });
  }

  createLesson(datasetId: string, scenarioId: string, scope: ExecutionScope): LessonSessionV1 {
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
      },
      {
        ...(data.leap.value ? { leap: data.leap.value } : {}),
        ...(data.domain.value ? { domain: data.domain.value } : {}),
        ...(data.eop.value ? { eop: data.eop.value } : {}),
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
    const handleOf = new Map<string, string>();
    const starOf = new Map<string, string>();
    for (const starId of [...directions.keys()].sort()) {
      let handle: string;
      do handle = `h-${randomBytes(6).toString('hex')}`;
      while (starOf.has(handle));
      handleOf.set(starId, handle);
      starOf.set(handle, starId);
    }
    const lessonId = randomUUID();
    const session: Session = {
      lessonId,
      datasetId,
      scope,
      route,
      content,
      directions,
      handleOf,
      starOf,
      stepIndex: 0,
      attempts: new Map(),
    };
    this.remember(session);
    const notices = [registration.notice, ...registration.attributions];
    return {
      contractVersion: 'lesson.v1',
      lessonId,
      datasetId,
      scenario: { scenarioId: scenario.scenarioId, label: scenario.label, utc: scenario.utc },
      observerLabel: observer?.displayLabel ?? '',
      routeTitle: route.title,
      // Stars are listed in a random-handle order so list position reveals nothing.
      stars: [...directions.entries()]
        .map(([starId, direction]) => ({
          handle: handleOf.get(starId) as string,
          enu: [...direction.enu] as [number, number, number],
          visualMagnitude: direction.visualMagnitude,
          belowGeometricHorizon: direction.horizonClassification === 'BELOW_GEOMETRIC_HORIZON',
        }))
        .sort((a, b) => a.handle.localeCompare(b.handle)),
      overlays: [],
      currentStep: this.prompt(route, 0),
      provenance: {
        profileId: evaluation.profileId,
        executionScope: scope,
        scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION',
        contentReviewState: route.review.state,
        algorithmId: `${PROFILE_V1_ALGORITHM_IDENTITY.algorithmId}@${PROFILE_V1_ALGORITHM_IDENTITY.algorithmVersion}`,
        artifactHashes: evaluation.artifactIdentities,
        notices,
      },
    };
  }

  submitAnswer(lessonId: string, stepId: string, answer: StepAnswerV1): StepFeedbackV1 {
    const session = this.sessions.get(lessonId);
    if (!session) throw new LessonError(404, 'UNKNOWN_LESSON', 'Unknown or expired lesson.');
    const step = session.route.steps[session.stepIndex];
    if (!step) throw new LessonError(409, 'LESSON_COMPLETED', 'The lesson is already complete.');
    if (step.stepId !== stepId)
      throw new LessonError(409, 'STALE_STEP', `The current step is ${step.stepId}.`);
    const attempt = (session.attempts.get(stepId) ?? 0) + 1;
    session.attempts.set(stepId, attempt);
    const patterns = new Map(session.content.patterns.map((p) => [p.stableId, p]));

    if (step.taskKind === 'INDICATE_DIRECTION') {
      if (answer.kind !== 'DIRECTION')
        throw new LessonError(400, 'WRONG_ANSWER_KIND', 'A direction answer is required.');
      const direction = session.content.directions.find((d) => d.stableId === step.directionId);
      if (!direction) throw new LessonError(500, 'CONTENT_INCONSISTENT', 'Direction missing.');
      const measurement = measureDirectionAnswer(
        answer.azimuthRadians,
        direction.definition.azimuthRadians,
        null,
      );
      const relationship = this.relationship(session, step.guidanceRelationshipId);
      const cueStarId =
        relationship?.instruction.kind === 'VERTICAL_TO_HORIZON'
          ? relationship.instruction.fromStarId
          : null;
      const cue = cueStarId === null ? undefined : session.directions.get(cueStarId);
      const cueAzimuth = cue?.azimuthRadians ?? null;
      const degrees = (radians: number) => ((radians * 180) / Math.PI).toFixed(1);
      const cueText =
        cueAzimuth === null
          ? ''
          : ` The cue star itself is at azimuth ${degrees(cueAzimuth > Math.PI ? cueAzimuth - 2 * Math.PI : cueAzimuth)} degrees: close to True North, but not exactly on it.`;
      session.stepIndex += 1;
      return {
        contractVersion: 'lesson.v1',
        lessonId,
        stepId,
        attempt,
        result: 'MEASURED_NO_TOLERANCE',
        feedback: `${step.successFeedback} Your direction differs from True North by ${degrees(measurement.angularDifferenceRadians)} degrees.${cueText} No pass mark is set yet: learner tolerances are still under review.`,
        measurement: {
          angularDifferenceRadians: measurement.angularDifferenceRadians,
          targetCueAzimuthRadians: cueAzimuth,
        },
        overlays: [],
        nextStep: this.prompt(session.route, session.stepIndex),
        completed: session.stepIndex >= session.route.steps.length,
      };
    }

    if (answer.kind !== 'STAR_SELECTION')
      throw new LessonError(400, 'WRONG_ANSWER_KIND', 'A star selection is required.');
    const pattern = patterns.get(step.patternId as string) as SkyPattern;
    const selectedStarId = session.starOf.get(answer.starHandle) ?? null;
    const score = scoreStarSelection(selectedStarId, new Set(pattern.memberStarIds));
    if (score.result === 'INCORRECT') {
      return {
        contractVersion: 'lesson.v1',
        lessonId,
        stepId,
        attempt,
        result: 'INCORRECT',
        feedback: step.retryFeedback,
        measurement: null,
        overlays: [],
        nextStep: this.prompt(session.route, session.stepIndex),
        completed: false,
      };
    }
    session.stepIndex += 1;
    const overlays: SkyOverlayV1[] = [];
    if (step.taskKind === 'IDENTIFY_PATTERN_MEMBER') overlays.push(this.outline(session, pattern));
    if (step.taskKind === 'IDENTIFY_TARGET_STAR') {
      for (const starId of pattern.memberStarIds) {
        overlays.push({
          kind: 'STAR_LABEL',
          handle: session.handleOf.get(starId) as string,
          labels: labelsOf(pattern.labels),
        });
      }
    }
    const next = session.route.steps[session.stepIndex];
    if (next) overlays.push(...this.guide(session, next));
    return {
      contractVersion: 'lesson.v1',
      lessonId,
      stepId,
      attempt,
      result: 'CORRECT',
      feedback: step.successFeedback,
      measurement: null,
      overlays,
      nextStep: this.prompt(session.route, session.stepIndex),
      completed: false,
    };
  }

  private remember(session: Session) {
    if (this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (oldest !== undefined) this.sessions.delete(oldest);
    }
    this.sessions.set(session.lessonId, session);
  }

  private prompt(route: LessonRoute, index: number): LessonStepPromptV1 | null {
    const step: LessonRouteStep | undefined = route.steps[index];
    if (!step) return null;
    return {
      stepId: step.stepId,
      stepNumber: index + 1,
      stepCount: route.steps.length,
      taskKind: step.taskKind,
      prompt: step.prompt,
      hideCardinalLabels: step.taskKind === 'INDICATE_DIRECTION',
    };
  }

  private relationship(session: Session, id: string | null): GuidanceRelationship | undefined {
    return id === null ? undefined : session.content.relationships.find((r) => r.stableId === id);
  }

  private outline(session: Session, pattern: SkyPattern): SkyOverlayV1 {
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

  private guide(session: Session, step: LessonRouteStep): SkyOverlayV1[] {
    const relationship = this.relationship(session, step.guidanceRelationshipId);
    if (!relationship) return [];
    const handle = (starId: string) => session.handleOf.get(starId) as string;
    const instruction = relationship.instruction;
    if (instruction.kind === 'VERTICAL_TO_HORIZON') {
      return [
        {
          kind: 'VERTICAL_TO_HORIZON',
          relationshipId: relationship.stableId,
          fromHandle: handle(instruction.fromStarId),
          layer: relationship.layer,
          explanation: relationship.explanation,
          historicalContext: relationship.historicalContext?.text ?? null,
        },
      ];
    }
    const handles =
      instruction.kind === 'GREAT_CIRCLE_ARC'
        ? [handle(instruction.fromStarId), handle(instruction.toStarId)]
        : [
            handle(instruction.fromStarId),
            handle(instruction.throughStarId),
            handle(instruction.toStarId),
          ];
    return [
      {
        kind: 'GUIDE_ARC',
        relationshipId: relationship.stableId,
        handles,
        layer: relationship.layer,
        explanation: relationship.explanation,
      },
    ];
  }
}

export type { ScenarioPreset };
