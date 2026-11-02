import type {
  ApiErrorV1,
  CreateLessonRequestV1,
  DatasetListResponseV1,
  LessonExecutionScope,
  LessonSessionV1,
  StepAnswerV1,
  StepFeedbackV1,
} from '@ufuq/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorV1 | null,
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
  if (!response.ok) throw new ApiError(response.status, body as ApiErrorV1 | null);
  return body as T;
}

export function listDatasets(): Promise<DatasetListResponseV1> {
  return call('/api/v1/datasets');
}

export function createLesson(
  datasetId: string,
  scenarioId: string,
  executionScope: LessonExecutionScope,
): Promise<LessonSessionV1> {
  const body: CreateLessonRequestV1 = {
    contractVersion: 'lesson.v1',
    datasetId,
    scenarioId,
    executionScope,
  };
  return call('/api/v1/lessons', { method: 'POST', body: JSON.stringify(body) });
}

/** Sends raw learner evidence only; the server decides correctness. */
export function submitAnswer(
  lessonId: string,
  stepId: string,
  answer: StepAnswerV1,
): Promise<StepFeedbackV1> {
  return call(
    `/api/v1/lessons/${encodeURIComponent(lessonId)}/steps/${encodeURIComponent(stepId)}/responses`,
    {
      method: 'POST',
      body: JSON.stringify({ contractVersion: 'lesson.v1', answer }),
    },
  );
}
