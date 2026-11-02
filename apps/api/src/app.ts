import { resolve } from 'node:path';

import express from 'express';

import type { ExecutionScope } from '@ufuq/astronomy-core';
import {
  type ApiErrorV1,
  type DatasetListResponseV1,
  type HealthResponse,
  parseCreateLessonRequest,
  parseSubmitAnswerRequest,
} from '@ufuq/contracts';

import { loadDataset } from './data/artifacts.js';
import { type DatasetRegistration, LessonError, LessonService } from './lesson/lesson-service.js';

export interface AppOptions {
  /** Directory holding the generated artifacts (default: <repo>/data/generated). */
  readonly dataDirectory?: string;
  /**
   * Enables the REVIEW_PREVIEW scope for real ProfileV1 data still REVIEW_REQUIRED.
   * Local reviewer use only; never enabled by default.
   */
  readonly enableReviewPreview?: boolean;
}

export function defaultDataDirectory(): string {
  return resolve(import.meta.dirname, '..', '..', '..', 'data', 'generated');
}

export function createDatasets(options: AppOptions = {}): Map<string, DatasetRegistration> {
  const directory = options.dataDirectory ?? defaultDataDirectory();
  const realScopes: ExecutionScope[] = options.enableReviewPreview
    ? ['SCIENTIFIC_PROFILE_V1', 'REVIEW_PREVIEW']
    : ['SCIENTIFIC_PROFILE_V1'];
  const real: DatasetRegistration = {
    datasetId: 'profile-v1-umpsa-pekan',
    title: 'ScientificProfileV1: UMPSA Pekan, Hipparcos route stars',
    scopes: realScopes,
    dataset: loadDataset(directory, {
      stars: 'route-stars-hipparcos1997-v1.json',
      leap: 'leap-seconds-iers-v1.json',
      eop: 'local-only/eop-bulletinb-453-461-v1.json',
      observer: 'observer-umpsa-pekan-v1.json',
      domain: 'time-domain-profile-v1.json',
      content: 'lesson-content-v1.json',
    }),
    notice: options.enableReviewPreview
      ? 'REVIEW PREVIEW available: results computed from ScientificProfileV1 data and content that are still REVIEW_REQUIRED are for reviewer inspection only and are not learner content.'
      : 'ScientificProfileV1 execution requires every artifact and content record to be APPROVED by its named reviewer.',
    attributions: [
      'Star astrometry: ESA (1997), The Hipparcos and Tycho Catalogues, ESA SP-1200. Credit: ESA (CC BY-NC 3.0 IGO).',
      'Observer point: data © OpenStreetMap contributors (ODbL 1.0); height from Copernicus DEM GLO-90 and EGM2008.',
      'Earth orientation: IERS Bulletin B and the IERS Conventions (2010) software (derived work, not endorsed by the IERS).',
      'Astrometry routines derived from IAU SOFA 2023-10-11 (derived work, not endorsed by SOFA).',
    ],
  };
  const synthetic: DatasetRegistration = {
    datasetId: 'synthetic-technical',
    title: 'Synthetic technical fixture (not the real sky)',
    scopes: ['SYNTHETIC_TECHNICAL_FIXTURE'],
    dataset: loadDataset(directory, {
      stars: 'synthetic/synthetic-stars-v1.json',
      leap: 'synthetic/synthetic-leap-seconds-v1.json',
      eop: 'synthetic/synthetic-eop-v1.json',
      observer: 'synthetic/synthetic-observer-v1.json',
      domain: 'synthetic/synthetic-time-domain-v1.json',
      content: 'synthetic/synthetic-lesson-content-v1.json',
    }),
    notice:
      'SYNTHETIC TECHNICAL FIXTURE: invented stars, Earth-orientation values and lesson text for software testing. This is not the real sky and not learner content.',
    attributions: [],
  };
  return new Map([
    [real.datasetId, real],
    [synthetic.datasetId, synthetic],
  ]);
}

function sendError(
  response: express.Response,
  status: number,
  body: Omit<ApiErrorV1, 'contractVersion'>,
) {
  response.status(status).json({ contractVersion: 'lesson.v1', ...body } satisfies ApiErrorV1);
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  const service = new LessonService(createDatasets(options));

  app.get('/health', (_request, response) => {
    const body: HealthResponse = { status: 'ok', service: 'api', phase: 'vertical-slice' };
    response.status(200).json(body);
  });

  app.get('/api/v1/datasets', (_request, response) => {
    const body: DatasetListResponseV1 = {
      contractVersion: 'lesson.v1',
      datasets: service.listDatasets(),
    };
    response.status(200).json(body);
  });

  app.post('/api/v1/lessons', (request, response) => {
    const parsed = parseCreateLessonRequest(request.body);
    if (!parsed.ok)
      return sendError(response, 400, { error: 'BAD_REQUEST', detail: parsed.reason });
    try {
      const { datasetId, scenarioId, executionScope } = parsed.value;
      response.status(201).json(service.createLesson(datasetId, scenarioId, executionScope));
    } catch (error) {
      handle(error, response);
    }
  });

  app.post('/api/v1/lessons/:lessonId/steps/:stepId/responses', (request, response) => {
    const parsed = parseSubmitAnswerRequest(request.body);
    if (!parsed.ok)
      return sendError(response, 400, { error: 'BAD_REQUEST', detail: parsed.reason });
    try {
      response
        .status(200)
        .json(
          service.submitAnswer(request.params.lessonId, request.params.stepId, parsed.value.answer),
        );
    } catch (error) {
      handle(error, response);
    }
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      void next;
      if (error instanceof SyntaxError)
        return sendError(response, 400, { error: 'BAD_REQUEST', detail: 'Malformed JSON.' });
      sendError(response, 500, { error: 'INTERNAL_ERROR' });
    },
  );

  return app;
}

function handle(error: unknown, response: express.Response) {
  if (error instanceof LessonError) {
    sendError(response, error.status, {
      error: error.code,
      detail: error.message,
      ...(error.outcome === undefined ? {} : { outcome: error.outcome }),
    });
    return;
  }
  sendError(response, 500, { error: 'INTERNAL_ERROR' });
}
