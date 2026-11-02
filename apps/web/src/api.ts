import type {
  ApiErrorV2,
  CreateLessonRequestV2,
  DatasetListResponseV2,
  DevelopmentLearnerV2,
  LessonExecutionScope,
  LessonSessionV2,
  StepAnswerV2,
  StepFeedbackV2,
} from '@ufuq/contracts';
import { LESSON_CONTRACT_VERSION } from '@ufuq/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorV2 | null,
  ) {
    super(body?.detail ?? body?.error ?? `HTTP ${status}`);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new ApiError(response.status, body as ApiErrorV2 | null);
  return body as T;
}

export function listDatasets(): Promise<DatasetListResponseV2> {
  return call('/api/v2/datasets');
}

/** IMP-016 development fixture identity; kept in memory for this tab only. */
export function createDevelopmentLearner(): Promise<DevelopmentLearnerV2> {
  return call('/api/v2/development-learners', { method: 'POST', body: '{}' });
}

export function createLesson(
  datasetId: string,
  scenarioId: string,
  executionScope: LessonExecutionScope,
  learnerId: string,
): Promise<LessonSessionV2> {
  const body: CreateLessonRequestV2 = {
    contractVersion: LESSON_CONTRACT_VERSION,
    datasetId,
    scenarioId,
    executionScope,
    learnerId,
    // Evaluation-only purposes need an approved protocol first (BKT-005).
    sessionPurpose: 'LEARNING',
  };
  return call('/api/v2/lessons', { method: 'POST', body: JSON.stringify(body) });
}

/** Sends raw learner evidence only; the server decides correctness and support. */
export function submitAnswer(
  lessonId: string,
  stepId: string,
  answer: StepAnswerV2,
): Promise<StepFeedbackV2> {
  return call(
    `/api/v2/lessons/${encodeURIComponent(lessonId)}/steps/${encodeURIComponent(stepId)}/responses`,
    {
      method: 'POST',
      body: JSON.stringify({ contractVersion: LESSON_CONTRACT_VERSION, answer }),
    },
  );
}
