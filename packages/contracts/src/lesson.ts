/**
 * Versioned lesson API contracts (v1). The browser receives only render data and the
 * current prompt; route eligibility, targets, correctness and tolerances stay on the
 * server (IMP-004). Star handles are opaque per-lesson identifiers.
 */

export type LessonExecutionScope =
  'SCIENTIFIC_PROFILE_V1' | 'REVIEW_PREVIEW' | 'SYNTHETIC_TECHNICAL_FIXTURE';

export interface DatasetSummaryV1 {
  readonly datasetId: string;
  readonly title: string;
  readonly executionScopes: readonly LessonExecutionScope[];
  readonly approvalSummary: readonly { readonly artifactId: string; readonly state: string }[];
  readonly scenarios: readonly {
    readonly scenarioId: string;
    readonly label: string;
    readonly utc: string;
  }[];
  readonly notice: string;
}

export interface DatasetListResponseV1 {
  readonly contractVersion: 'lesson.v1';
  readonly datasets: readonly DatasetSummaryV1[];
}

export interface CreateLessonRequestV1 {
  readonly contractVersion: 'lesson.v1';
  readonly datasetId: string;
  readonly scenarioId: string;
  readonly executionScope: LessonExecutionScope;
}

export interface SkyStarV1 {
  readonly handle: string;
  /** Unit east, north, up direction (geometric, no refraction). */
  readonly enu: readonly [number, number, number];
  readonly visualMagnitude: number | null;
  readonly belowGeometricHorizon: boolean;
}

export interface OverlayLabelV1 {
  readonly languageTag: string;
  readonly script: string | null;
  readonly transliteration: string | null;
  readonly gloss: string | null;
  readonly layer: string;
}

export type SkyOverlayV1 =
  | {
      readonly kind: 'PATTERN_OUTLINE';
      readonly patternId: string;
      readonly segments: readonly (readonly [string, string])[];
      readonly memberHandles: readonly string[];
      readonly labels: readonly OverlayLabelV1[];
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
      readonly labels: readonly OverlayLabelV1[];
    };

export interface LessonStepPromptV1 {
  readonly stepId: string;
  readonly stepNumber: number;
  readonly stepCount: number;
  readonly taskKind: 'IDENTIFY_PATTERN_MEMBER' | 'IDENTIFY_TARGET_STAR' | 'INDICATE_DIRECTION';
  readonly prompt: string;
  /** Presentation hint: cardinal labels are hidden while the learner indicates a direction. */
  readonly hideCardinalLabels: boolean;
}

export interface LessonProvenanceV1 {
  readonly profileId: string;
  readonly executionScope: LessonExecutionScope;
  readonly scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION';
  readonly contentReviewState: string;
  readonly algorithmId: string;
  readonly artifactHashes: readonly string[];
  readonly notices: readonly string[];
}

export interface LessonSessionV1 {
  readonly contractVersion: 'lesson.v1';
  readonly lessonId: string;
  readonly datasetId: string;
  readonly scenario: { readonly scenarioId: string; readonly label: string; readonly utc: string };
  readonly observerLabel: string;
  readonly routeTitle: string;
  readonly stars: readonly SkyStarV1[];
  readonly overlays: readonly SkyOverlayV1[];
  readonly currentStep: LessonStepPromptV1 | null;
  readonly provenance: LessonProvenanceV1;
}

export type StepAnswerV1 =
  | { readonly kind: 'STAR_SELECTION'; readonly starHandle: string }
  | { readonly kind: 'DIRECTION'; readonly azimuthRadians: number };

export interface SubmitAnswerRequestV1 {
  readonly contractVersion: 'lesson.v1';
  readonly answer: StepAnswerV1;
}

export interface StepFeedbackV1 {
  readonly contractVersion: 'lesson.v1';
  readonly lessonId: string;
  readonly stepId: string;
  readonly attempt: number;
  /**
   * CORRECT/INCORRECT for exact star identity. Direction answers are MEASURED_NO_TOLERANCE:
   * the angular difference is reported, but no learner tolerance is approved (IMP-012).
   */
  readonly result: 'CORRECT' | 'INCORRECT' | 'MEASURED_NO_TOLERANCE';
  readonly feedback: string;
  readonly measurement: {
    readonly angularDifferenceRadians: number;
    readonly targetCueAzimuthRadians: number | null;
  } | null;
  readonly overlays: readonly SkyOverlayV1[];
  readonly nextStep: LessonStepPromptV1 | null;
  readonly completed: boolean;
}

export interface ApiErrorV1 {
  readonly contractVersion: 'lesson.v1';
  readonly error: string;
  readonly outcome?: string;
  readonly detail?: string;
}

const SCOPES = new Set(['SCIENTIFIC_PROFILE_V1', 'REVIEW_PREVIEW', 'SYNTHETIC_TECHNICAL_FIXTURE']);

/** Framework-free validator for the create-lesson request (IMP-019). */
export function parseCreateLessonRequest(
  value: unknown,
): { ok: true; value: CreateLessonRequestV1 } | { ok: false; reason: string } {
  if (typeof value !== 'object' || value === null)
    return { ok: false, reason: 'Body must be an object.' };
  const body = value as Record<string, unknown>;
  const allowed = new Set(['contractVersion', 'datasetId', 'scenarioId', 'executionScope']);
  for (const key of Object.keys(body))
    if (!allowed.has(key)) return { ok: false, reason: `Unknown field ${key}.` };
  if (body.contractVersion !== 'lesson.v1')
    return { ok: false, reason: 'contractVersion must be lesson.v1.' };
  if (typeof body.datasetId !== 'string' || body.datasetId.length === 0)
    return { ok: false, reason: 'datasetId required.' };
  if (typeof body.scenarioId !== 'string' || body.scenarioId.length === 0)
    return { ok: false, reason: 'scenarioId required.' };
  if (!SCOPES.has(body.executionScope as string))
    return { ok: false, reason: 'Unknown executionScope.' };
  return { ok: true, value: body as unknown as CreateLessonRequestV1 };
}

/** Framework-free validator for an answer submission: raw evidence only, never correctness. */
export function parseSubmitAnswerRequest(
  value: unknown,
): { ok: true; value: SubmitAnswerRequestV1 } | { ok: false; reason: string } {
  if (typeof value !== 'object' || value === null)
    return { ok: false, reason: 'Body must be an object.' };
  const body = value as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key !== 'contractVersion' && key !== 'answer')
      return { ok: false, reason: `Unknown field ${key}.` };
  }
  if (body.contractVersion !== 'lesson.v1')
    return { ok: false, reason: 'contractVersion must be lesson.v1.' };
  const answer = body.answer as Record<string, unknown> | undefined;
  if (typeof answer !== 'object' || answer === null)
    return { ok: false, reason: 'answer required.' };
  if (answer.kind === 'STAR_SELECTION') {
    if (Object.keys(answer).some((key) => key !== 'kind' && key !== 'starHandle')) {
      return { ok: false, reason: 'Unknown answer field.' };
    }
    if (typeof answer.starHandle !== 'string' || answer.starHandle.length === 0) {
      return { ok: false, reason: 'starHandle required.' };
    }
  } else if (answer.kind === 'DIRECTION') {
    if (Object.keys(answer).some((key) => key !== 'kind' && key !== 'azimuthRadians')) {
      return { ok: false, reason: 'Unknown answer field.' };
    }
    if (typeof answer.azimuthRadians !== 'number' || !Number.isFinite(answer.azimuthRadians)) {
      return { ok: false, reason: 'azimuthRadians must be a finite number.' };
    }
  } else {
    return { ok: false, reason: 'Unknown answer kind.' };
  }
  return { ok: true, value: body as unknown as SubmitAnswerRequestV1 };
}
