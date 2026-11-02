/**
 * Versioned lesson API contracts (v2, Phase 3). The browser receives render data, the
 * current prompt and the server-issued cue snapshot; route eligibility, targets,
 * correctness, tolerances, mastery and scaffold decisions stay on the server (IMP-004).
 * Star handles are opaque per-lesson identifiers. v2 replaces v1 (no released client
 * depended on v1): it adds the learner, the session purpose, adaptive cue snapshots, the
 * set-selection answer and the technical model trace.
 */

export type LessonContractVersion = 'lesson.v2';
export const LESSON_CONTRACT_VERSION: LessonContractVersion = 'lesson.v2';

export type LessonExecutionScope =
  'SCIENTIFIC_PROFILE_V1' | 'REVIEW_PREVIEW' | 'SYNTHETIC_TECHNICAL_FIXTURE';

/** Session purpose is recorded independently of assistance (BKT-005). */
export type SessionPurposeV2 = 'PRE_TEST' | 'LEARNING' | 'POST_TEST' | 'RECALL';

export type KnowledgeComponentIdV2 = 'KC-01' | 'KC-02' | 'KC-03' | 'KC-04' | 'KC-05';
export type ScaffoldStateV2 = 'GUIDED' | 'FADING' | 'INDEPENDENT';

export interface DatasetSummaryV2 {
  readonly datasetId: string;
  readonly title: string;
  readonly executionScopes: readonly LessonExecutionScope[];
  readonly approvalSummary: readonly { readonly artifactId: string; readonly state: string }[];
  readonly scenarios: readonly {
    readonly scenarioId: string;
    readonly label: string;
    readonly utc: string;
  }[];
  readonly learningMode: 'ADAPTIVE' | 'NON_ADAPTIVE' | 'UNAVAILABLE';
  /** The activated time domain for free sky exploration, when the dataset has one. */
  readonly supportedDomain: {
    readonly earliest: string;
    readonly earliestBoundary: string;
    readonly latest: string;
    readonly latestBoundary: string;
  } | null;
  readonly observerLabel: string;
  readonly notice: string;
}

export interface DatasetListResponseV2 {
  readonly contractVersion: LessonContractVersion;
  readonly datasets: readonly DatasetSummaryV2[];
  /** Whether this server composition offers the development fixture identity (IMP-016). */
  readonly developmentIdentityEnabled: boolean;
}

/** IMP-016 development fixture identity: non-production, in memory, never an account. */
export interface DevelopmentLearnerV2 {
  readonly contractVersion: LessonContractVersion;
  readonly learnerId: string;
  readonly identityKind: 'DEVELOPMENT_FIXTURE';
  readonly notice: string;
}

export interface CreateLessonRequestV2 {
  readonly contractVersion: LessonContractVersion;
  readonly datasetId: string;
  readonly scenarioId: string;
  readonly executionScope: LessonExecutionScope;
  readonly learnerId: string;
  readonly sessionPurpose: SessionPurposeV2;
}

export interface SkyStarV2 {
  readonly handle: string;
  /** Unit east, north, up direction (geometric, no refraction). */
  readonly enu: readonly [number, number, number];
  readonly visualMagnitude: number | null;
  /** Johnson B-V for star colour; null when unknown. */
  readonly colorIndexBV: number | null;
  readonly belowGeometricHorizon: boolean;
}

export interface OverlayLabelV2 {
  readonly languageTag: string;
  readonly script: string | null;
  readonly transliteration: string | null;
  readonly gloss: string | null;
  readonly layer: string;
}

export type SkyOverlayV2 =
  | {
      readonly kind: 'PATTERN_OUTLINE';
      readonly patternId: string;
      readonly segments: readonly (readonly [string, string])[];
      readonly memberHandles: readonly string[];
      readonly labels: readonly OverlayLabelV2[];
      readonly lineLayer: string;
    }
  | {
      readonly kind: 'GUIDE_ARC';
      readonly relationshipId: string;
      readonly handles: readonly string[];
      readonly layer: string;
      readonly explanation: string;
    }
  | {
      /**
       * Fading cue: the first half of the guide, from its start star to a server-computed
       * direction. The target handle is never sent, so the client cannot reveal it.
       */
      readonly kind: 'GUIDE_ARC_PARTIAL';
      readonly relationshipId: string;
      readonly fromHandle: string;
      /** Unit east, north, up direction where the partial guide ends. */
      readonly endEnu: readonly [number, number, number];
      readonly layer: string;
      readonly explanation: string;
    }
  | {
      readonly kind: 'VERTICAL_TO_HORIZON';
      readonly relationshipId: string;
      readonly fromHandle: string;
      readonly layer: string;
      readonly explanation: string;
      readonly historicalContext: string | null;
    }
  | {
      readonly kind: 'STAR_LABEL';
      readonly handle: string;
      readonly labels: readonly OverlayLabelV2[];
    };

export type LessonTaskKindV2 =
  | 'IDENTIFY_PATTERN_MEMBER'
  | 'SELECT_ALL_PATTERN_MEMBERS'
  | 'IDENTIFY_TARGET_STAR'
  | 'INDICATE_DIRECTION';

/** The cue snapshot the server issued for this task: the only source of assistance. */
export interface IssuedSupportV2 {
  readonly mode: 'ADAPTIVE' | 'NON_ADAPTIVE';
  /** Null when no adaptive scaffold policy is approved (fixed presentation). */
  readonly scaffoldState: ScaffoldStateV2 | null;
  readonly cueSnapshotId: string;
  readonly cueIds: readonly string[];
}

export interface LessonStepPromptV2 {
  readonly stepId: string;
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly taskKind: LessonTaskKindV2;
  readonly knowledgeComponentId: KnowledgeComponentIdV2 | null;
  readonly prompt: string;
  /** Presentation hint: cardinal labels are hidden while the learner indicates a direction. */
  readonly hideCardinalLabels: boolean;
  readonly support: IssuedSupportV2;
  /** Everything the scene shows for this step: the issued cues and nothing else. */
  readonly overlays: readonly SkyOverlayV2[];
  /** Text cues issued for this step (for example a reviewed shape hint). */
  readonly hints: readonly string[];
}

export interface LessonProvenanceV2 {
  readonly profileId: string;
  readonly executionScope: LessonExecutionScope;
  readonly scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION';
  readonly contentReviewState: string;
  readonly learningConfiguration: {
    readonly artifactId: string;
    readonly payloadSha256: string;
    readonly approvalState: string;
    readonly mode: 'ADAPTIVE' | 'NON_ADAPTIVE';
  };
  readonly algorithmId: string;
  readonly artifactHashes: readonly string[];
  readonly notices: readonly string[];
}

export interface LessonSessionV2 {
  readonly contractVersion: LessonContractVersion;
  readonly lessonId: string;
  readonly learnerId: string;
  readonly sessionPurpose: SessionPurposeV2;
  readonly datasetId: string;
  readonly scenario: { readonly scenarioId: string; readonly label: string; readonly utc: string };
  readonly observerLabel: string;
  readonly routeTitle: string;
  readonly stars: readonly SkyStarV2[];
  readonly currentStep: LessonStepPromptV2 | null;
  readonly provenance: LessonProvenanceV2;
}

export type StepAnswerV2 =
  | { readonly kind: 'STAR_SELECTION'; readonly starHandle: string }
  | { readonly kind: 'STAR_SET_SELECTION'; readonly starHandles: readonly string[] }
  | { readonly kind: 'DIRECTION'; readonly azimuthRadians: number };

export interface SubmitAnswerRequestV2 {
  readonly contractVersion: LessonContractVersion;
  readonly answer: StepAnswerV2;
  /**
   * Optional untrusted render diagnostics. Stored apart from the attempt; it can never
   * upgrade assisted evidence to independent.
   */
  readonly clientTelemetry?: { readonly renderedCueIds: readonly string[] };
}

/**
 * Technical model trace for developers and reviewers. It is not learner feedback: raw
 * probabilities and policy reasons need BKT-003/BKT-004 approval before a learner sees them.
 */
export interface TutoringTraceV2 {
  readonly knowledgeComponentId: KnowledgeComponentIdV2;
  readonly mode: 'ADAPTIVE' | 'NON_ADAPTIVE';
  readonly responseStatus: string;
  readonly attemptKind: string;
  readonly observationDecision: string;
  readonly observationReasonCode: string;
  readonly modelDecision: 'OBSERVATION' | 'TRANSITION_ONLY' | 'NO_MODEL_UPDATE';
  readonly modelReasonCode: string;
  readonly masteryBefore: number;
  readonly masteryAfter: number;
  readonly revisionBefore: number;
  readonly revisionAfter: number;
  readonly scaffoldDecision: 'SCAFFOLD_TRANSITION' | 'SCAFFOLD_UNCHANGED' | 'SCAFFOLD_NOT_ADAPTIVE';
  readonly scaffoldFrom: ScaffoldStateV2 | null;
  readonly scaffoldTo: ScaffoldStateV2 | null;
  readonly scaffoldReasonCode: string;
  readonly masteryThresholdStatus: string;
  readonly independentConfirmationStatus: string;
}

export interface StepFeedbackV2 {
  readonly contractVersion: LessonContractVersion;
  readonly lessonId: string;
  readonly stepId: string;
  readonly attempt: number;
  /**
   * CORRECT/INCORRECT for exact identity, exact set equality, or a direction graded by an
   * explicit tolerance policy. MEASURED_NO_TOLERANCE when no tolerance is approved.
   */
  readonly result: 'CORRECT' | 'INCORRECT' | 'MEASURED_NO_TOLERANCE';
  readonly feedback: string;
  readonly measurement: {
    readonly angularDifferenceRadians: number;
    readonly targetCueAzimuthRadians: number | null;
  } | null;
  /** Shown only when the lesson completes: the route summary. */
  readonly overlays: readonly SkyOverlayV2[];
  readonly nextStep: LessonStepPromptV2 | null;
  readonly completed: boolean;
  readonly trace: TutoringTraceV2 | null;
}

export interface LearnerTraceResponseV2 {
  readonly contractVersion: LessonContractVersion;
  readonly learnerId: string;
  readonly identityKind: 'DEVELOPMENT_FIXTURE';
  readonly attempts: readonly (TutoringTraceV2 & {
    readonly lessonId: string;
    readonly stepId: string;
    readonly datasetId: string;
    readonly cueSnapshotId: string;
    readonly issuedCueIds: readonly string[];
    readonly clientTelemetry: { readonly renderedCueIds: readonly string[] } | null;
  })[];
}

export interface ApiErrorV2 {
  readonly contractVersion: LessonContractVersion;
  readonly error: string;
  readonly outcome?: string;
  readonly detail?: string;
  /** For STALE_MASTERY_REVISION: the same step reissued against the current state. */
  readonly reissuedStep?: LessonStepPromptV2;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

const SCOPES = new Set(['SCIENTIFIC_PROFILE_V1', 'REVIEW_PREVIEW', 'SYNTHETIC_TECHNICAL_FIXTURE']);
const PURPOSES = new Set(['PRE_TEST', 'LEARNING', 'POST_TEST', 'RECALL']);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_SET_SELECTION = 64;

function objectWith(value: unknown, allowed: readonly string[]): Record<string, unknown> | string {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return 'Body must be an object.';
  const body = value as Record<string, unknown>;
  for (const key of Object.keys(body)) if (!allowed.includes(key)) return `Unknown field ${key}.`;
  return body;
}

/** Framework-free validator for the create-lesson request (IMP-019). */
export function parseCreateLessonRequest(value: unknown): Parsed<CreateLessonRequestV2> {
  const body = objectWith(value, [
    'contractVersion',
    'datasetId',
    'scenarioId',
    'executionScope',
    'learnerId',
    'sessionPurpose',
  ]);
  if (typeof body === 'string') return { ok: false, reason: body };
  if (body.contractVersion !== LESSON_CONTRACT_VERSION)
    return { ok: false, reason: `contractVersion must be ${LESSON_CONTRACT_VERSION}.` };
  if (typeof body.datasetId !== 'string' || !IDENTIFIER.test(body.datasetId))
    return { ok: false, reason: 'datasetId required.' };
  if (typeof body.scenarioId !== 'string' || !IDENTIFIER.test(body.scenarioId))
    return { ok: false, reason: 'scenarioId required.' };
  if (!SCOPES.has(body.executionScope as string))
    return { ok: false, reason: 'Unknown executionScope.' };
  if (typeof body.learnerId !== 'string' || !IDENTIFIER.test(body.learnerId))
    return { ok: false, reason: 'learnerId required.' };
  if (!PURPOSES.has(body.sessionPurpose as string))
    return { ok: false, reason: 'sessionPurpose must be PRE_TEST, LEARNING, POST_TEST or RECALL.' };
  return { ok: true, value: body as unknown as CreateLessonRequestV2 };
}

function parseAnswer(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return 'answer required.';
  const answer = value as Record<string, unknown>;
  const only = (...keys: string[]) => Object.keys(answer).every((key) => keys.includes(key));
  if (answer.kind === 'STAR_SELECTION') {
    if (!only('kind', 'starHandle')) return 'Unknown answer field.';
    if (typeof answer.starHandle !== 'string' || answer.starHandle.length === 0)
      return 'starHandle required.';
    return null;
  }
  if (answer.kind === 'STAR_SET_SELECTION') {
    if (!only('kind', 'starHandles')) return 'Unknown answer field.';
    const handles = answer.starHandles;
    if (!Array.isArray(handles) || handles.length === 0 || handles.length > MAX_SET_SELECTION)
      return `starHandles must hold 1 to ${MAX_SET_SELECTION} handles.`;
    if (!handles.every((handle) => typeof handle === 'string' && handle.length > 0))
      return 'starHandles must be non-empty strings.';
    return null;
  }
  if (answer.kind === 'DIRECTION') {
    if (!only('kind', 'azimuthRadians')) return 'Unknown answer field.';
    if (typeof answer.azimuthRadians !== 'number' || !Number.isFinite(answer.azimuthRadians))
      return 'azimuthRadians must be a finite number.';
    return null;
  }
  return 'Unknown answer kind.';
}

/** Framework-free validator for an answer submission: raw evidence only, never correctness. */
export function parseSubmitAnswerRequest(value: unknown): Parsed<SubmitAnswerRequestV2> {
  const body = objectWith(value, ['contractVersion', 'answer', 'clientTelemetry']);
  if (typeof body === 'string') return { ok: false, reason: body };
  if (body.contractVersion !== LESSON_CONTRACT_VERSION)
    return { ok: false, reason: `contractVersion must be ${LESSON_CONTRACT_VERSION}.` };
  const answerError = parseAnswer(body.answer);
  if (answerError) return { ok: false, reason: answerError };
  if (body.clientTelemetry !== undefined) {
    const telemetry = objectWith(body.clientTelemetry, ['renderedCueIds']);
    if (typeof telemetry === 'string')
      return { ok: false, reason: `clientTelemetry: ${telemetry}` };
    const ids = telemetry.renderedCueIds;
    if (
      !Array.isArray(ids) ||
      ids.length > 16 ||
      !ids.every((id) => typeof id === 'string' && IDENTIFIER.test(id))
    )
      return { ok: false, reason: 'clientTelemetry.renderedCueIds must be up to 16 identifiers.' };
  }
  return { ok: true, value: body as unknown as SubmitAnswerRequestV2 };
}
