import { resolve } from 'node:path';

import express from 'express';

import type { ExecutionScope } from '@ufuq/astronomy-core';
import {
  type ApiErrorV2,
  type DatasetListResponseV2,
  type DevelopmentLearnerV2,
  type HealthResponse,
  LESSON_CONTRACT_VERSION,
  parseCreateLessonRequest,
  parseSubmitAnswerRequest,
} from '@ufuq/contracts';

import { loadDataset } from './data/artifacts.js';
import { DevelopmentLearnerRegistry } from './learners/development-learners.js';
import { type DatasetRegistration, LessonError, LessonService } from './lesson/lesson-service.js';

export interface AppOptions {
  /** Directory holding the generated artifacts (default: <repo>/data/generated). */
  readonly dataDirectory?: string;
  /**
   * Enables the REVIEW_PREVIEW scope for real ProfileV1 data still REVIEW_REQUIRED.
   * Local reviewer use only; never enabled by default.
   */
  readonly enableReviewPreview?: boolean;
  /**
   * Composes the IMP-016 development fixture identity (in-memory learners, no personal
   * data). Off by default and never part of a production composition.
   */
  readonly enableDevelopmentIdentity?: boolean;
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
      learning: 'learning-configuration-v1.json',
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
      learning: 'synthetic/synthetic-learning-configuration-v1.json',
    }),
    notice:
      'SYNTHETIC TECHNICAL FIXTURE: invented stars, Earth-orientation values, lesson text and adaptive-tutoring policies for software testing. This is not the real sky, not learner content and not a proposed learning policy.',
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
  body: Omit<ApiErrorV2, 'contractVersion'>,
) {
  response
    .status(status)
    .json({ contractVersion: LESSON_CONTRACT_VERSION, ...body } satisfies ApiErrorV2);
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  const learners = options.enableDevelopmentIdentity ? new DevelopmentLearnerRegistry() : null;
  const service = new LessonService(createDatasets(options), learners);

  app.get('/health', (_request, response) => {
    const body: HealthResponse = { status: 'ok', service: 'api', phase: 'adaptive-tutoring' };
    response.status(200).json(body);
  });

  app.get('/api/v2/datasets', (_request, response) => {
    const body: DatasetListResponseV2 = {
      contractVersion: LESSON_CONTRACT_VERSION,
      datasets: service.listDatasets(),
      developmentIdentityEnabled: learners !== null,
    };
    response.status(200).json(body);
  });

  app.post('/api/v2/development-learners', (_request, response) => {
    if (!learners) {
      return sendError(response, 403, {
        error: 'DEVELOPMENT_IDENTITY_DISABLED',
        detail: 'The development fixture identity is not part of this server composition.',
      });
    }
    const learner = learners.create();
    const body: DevelopmentLearnerV2 = {
      contractVersion: LESSON_CONTRACT_VERSION,
      learnerId: learner.learnerId,
      identityKind: 'DEVELOPMENT_FIXTURE',
      notice:
        'Development fixture identity (IMP-016): in-memory, no personal data, lost on restart, never a learner account.',
    };
    response.status(201).json(body);
  });

  app.get('/api/v2/development-learners/:learnerId/trace', (request, response) => {
    try {
      response.status(200).json(service.learnerTrace(request.params.learnerId));
    } catch (error) {
      handle(error, response);
    }
  });

  app.post('/api/v2/lessons', (request, response) => {
    const parsed = parseCreateLessonRequest(request.body);
    if (!parsed.ok)
      return sendError(response, 400, { error: 'BAD_REQUEST', detail: parsed.reason });
    try {
      response.status(201).json(service.createLesson(parsed.value));
    } catch (error) {
      handle(error, response);
    }
  });

  app.post('/api/v2/lessons/:lessonId/steps/:stepId/responses', (request, response) => {
    const parsed = parseSubmitAnswerRequest(request.body);
    if (!parsed.ok)
      return sendError(response, 400, { error: 'BAD_REQUEST', detail: parsed.reason });
    try {
      response
        .status(200)
        .json(
          service.submitAnswer(
            request.params.lessonId,
            request.params.stepId,
            parsed.value.answer,
            parsed.value.clientTelemetry ?? null,
          ),
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
      ...(error.reissuedStep === undefined ? {} : { reissuedStep: error.reissuedStep }),
    });
    return;
  }
  sendError(response, 500, { error: 'INTERNAL_ERROR' });
}
