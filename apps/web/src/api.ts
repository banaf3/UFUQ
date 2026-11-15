import type {
  AccountUserV1,
  AnalyticsV1,
  ApiErrorV2,
  CreateWalkthroughRequestV2,
  ProgressV1,
  WalkthroughV2,
  CreateLessonRequestV2,
  DatasetListResponseV2,
  DevelopmentLearnerV2,
  LessonExecutionScope,
  LessonSessionV2,
  SkyViewV2,
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

/** The explorer sky for a scenario or a canonical UTC instant (not an assessment). */
export function getSky(
  datasetId: string,
  executionScope: LessonExecutionScope,
  when: { readonly scenarioId: string } | { readonly utc: string },
): Promise<SkyViewV2> {
  const query = new URLSearchParams({
    datasetId,
    executionScope,
    ...('scenarioId' in when ? { scenarioId: when.scenarioId } : { utc: when.utc }),
  });
  return call(`/api/v2/sky?${query.toString()}`);
}

/** The taught walkthrough for a scenario's route (never scored; its own star handles). */
export function createWalkthrough(
  datasetId: string,
  scenarioId: string,
  executionScope: LessonExecutionScope,
): Promise<WalkthroughV2> {
  const body: CreateWalkthroughRequestV2 = {
    contractVersion: LESSON_CONTRACT_VERSION,
    datasetId,
    scenarioId,
    executionScope,
  };
  return call('/api/v2/walkthroughs', { method: 'POST', body: JSON.stringify(body) });
}

/** The signed-in account, null when signed out, or 'UNAVAILABLE' without a database. */
export async function currentUser(): Promise<AccountUserV1 | null | 'UNAVAILABLE'> {
  try {
    return await call<AccountUserV1>('/api/v2/auth/me');
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 401) return null;
    return 'UNAVAILABLE';
  }
}

export function register(name: string, email: string, password: string): Promise<AccountUserV1> {
  return call('/api/v2/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function login(email: string, password: string): Promise<AccountUserV1> {
  return call('/api/v2/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function logout(): Promise<void> {
  await fetch('/api/v2/auth/logout', { method: 'POST' });
}

export function getProgress(): Promise<ProgressV1> {
  return call('/api/v2/progress');
}

export function getAnalytics(): Promise<AnalyticsV1> {
  return call('/api/v2/admin/analytics');
}
