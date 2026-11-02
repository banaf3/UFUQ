export interface HealthResponse {
  readonly status: 'ok';
  readonly service: 'web' | 'api';
  readonly phase: 'scaffold' | 'vertical-slice' | 'adaptive-tutoring';
}

export * from './lesson.js';
