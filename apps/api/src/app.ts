import { resolve } from 'node:path';

import express from 'express';

import type { ExecutionScope } from '@ufuq/astronomy-core';
import {
  ACCOUNT_CONTRACT_VERSION,
  type ApiErrorV2,
  type DatasetListResponseV2,
  type DevelopmentLearnerV2,
  type HealthResponse,
  LESSON_CONTRACT_VERSION,
  parseCreateLessonRequest,
  parseLoginRequest,
  parseRegisterRequest,
  parseCreateWalkthroughRequest,
  parseSkyRequest,
  parseSubmitAnswerRequest,
} from '@ufuq/contracts';

import {
  AccountError,
  AccountService,
  clearedSessionCookie,
  publicUser,
  readCookie,
  SESSION_COOKIE,
  sessionCookie,
} from './accounts/account-service.js';
import type { AccountStore, UserRecord } from './accounts/account-store.js';
import type { ReportContext, ReportStore } from './accounts/reports.js';
import { loadDataset } from './data/artifacts.js';
import { DevelopmentLearnerRegistry } from './learners/development-learners.js';
import type { LearnerStore } from './learners/learner-store.js';
import { CompositeLearnerStore } from './persistence/mysql-learner-store.js';
import { type DatasetRegistration, LessonError, LessonService } from './lesson/lesson-service.js';
import { SkyService } from './sky/sky-service.js';

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
  /**
   * Accounts and durable learner models (report UC-101, UC-104, UC-105; MySQL in the
   * server composition, in-memory stores in unit tests).
   */
  readonly accounts?: {
    readonly accountStore: AccountStore;
    readonly learnerStore: LearnerStore;
    readonly reports: ReportStore | null;
    /** Adds the Secure cookie attribute (HTTPS deployments). */
    readonly secureCookies?: boolean;
  };
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
      skyField: 'sky-field-hipparcos1997-v1.json',
      skyCulture: 'sky-culture-iau-v1.json',
      arabicSky: 'sky-culture-arabic-anwa-v1.json',
    }),
    notice: options.enableReviewPreview
      ? 'Sky and lessons computed with ScientificProfileV1 from ESA Hipparcos star data.'
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
      skyField: 'synthetic/synthetic-sky-field-v1.json',
      skyCulture: 'synthetic/synthetic-sky-culture-v1.json',
      arabicSky: 'synthetic/synthetic-arabic-sky-culture-v1.json',
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
  const accounts = options.accounts ?? null;
  const store: LearnerStore | null = accounts
    ? new CompositeLearnerStore(learners, accounts.learnerStore)
    : learners;
  const datasets = createDatasets(options);
  const service = new LessonService(datasets, store);
  const sky = new SkyService(datasets);
  const accountService = accounts ? new AccountService(accounts.accountStore) : null;
  const reportContext = (): ReportContext => {
    const learning = datasets.get('profile-v1-umpsa-pekan')?.dataset.learning;
    return {
      configurationSha256: learning?.payloadSha256 ?? null,
      masteryThreshold: learning?.value?.masteryThreshold?.threshold ?? null,
    };
  };
  const signedIn = async (request: express.Request): Promise<UserRecord | null> =>
    accountService
      ? accountService.userForToken(readCookie(request.headers.cookie, SESSION_COOKIE))
      : null;
  const requireAccounts = () => {
    if (!accountService)
      throw new AccountError(
        503,
        'ACCOUNTS_UNAVAILABLE',
        'Accounts need the database; start the API with UFUQ_MYSQL_URL.',
      );
    return accountService;
  };
  const cookieFor = (token: string) => sessionCookie(token, accounts?.secureCookies ?? false);

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

  // Sky explorer (report UC-102): no learner identity, not an assessment.
  app.get('/api/v2/sky', (request, response) => {
    const parsed = parseSkyRequest(request.query as Record<string, unknown>);
    if (!parsed.ok)
      return sendError(response, 400, { error: 'BAD_REQUEST', detail: parsed.reason });
    try {
      response.status(200).json(sky.view(parsed.value));
    } catch (error) {
      handle(error, response);
    }
  });

  // Accounts (report UC-101).
  app.post('/api/v2/auth/register', async (request, response) => {
    try {
      const accountsService = requireAccounts();
      const parsed = parseRegisterRequest(request.body);
      if (!parsed.ok) throw new AccountError(400, 'BAD_REQUEST', parsed.reason);
      const user = await accountsService.register(parsed.value);
      const token = await accountsService.startSession(user);
      response.status(201).setHeader('Set-Cookie', cookieFor(token)).json(publicUser(user));
    } catch (error) {
      handle(error, response);
    }
  });

  app.post('/api/v2/auth/login', async (request, response) => {
    try {
      const accountsService = requireAccounts();
      const parsed = parseLoginRequest(request.body);
      if (!parsed.ok) throw new AccountError(400, 'BAD_REQUEST', parsed.reason);
      const { user, token } = await accountsService.login(parsed.value);
      response.status(200).setHeader('Set-Cookie', cookieFor(token)).json(publicUser(user));
    } catch (error) {
      handle(error, response);
    }
  });

  app.post('/api/v2/auth/logout', async (request, response) => {
    try {
      await accountService?.logout(readCookie(request.headers.cookie, SESSION_COOKIE));
      response.status(204).setHeader('Set-Cookie', clearedSessionCookie).end();
    } catch (error) {
      handle(error, response);
    }
  });

  app.get('/api/v2/auth/me', async (request, response) => {
    try {
      requireAccounts();
      const user = await signedIn(request);
      if (!user) throw new AccountError(401, 'NOT_SIGNED_IN', 'Sign in to continue.');
      response.status(200).json(publicUser(user));
    } catch (error) {
      handle(error, response);
    }
  });

  // Learner progress dashboard (report UC-104): only the signed-in learner's own data.
  app.get('/api/v2/progress', async (request, response) => {
    try {
      requireAccounts();
      const user = await signedIn(request);
      if (!user) throw new AccountError(401, 'NOT_SIGNED_IN', 'Sign in to continue.');
      if (!accounts?.reports)
        throw new AccountError(503, 'ACCOUNTS_UNAVAILABLE', 'Progress needs the database.');
      response.status(200).json(await accounts.reports.progress(user, reportContext()));
    } catch (error) {
      handle(error, response);
    }
  });

  // System analytics (report UC-105): administrators only, strictly read-only.
  app.get('/api/v2/admin/analytics', async (request, response) => {
    try {
      const accountsService = requireAccounts();
      const user = await signedIn(request);
      if (!user) throw new AccountError(401, 'NOT_SIGNED_IN', 'Sign in to continue.');
      if (user.role !== 'ADMIN') {
        await accountsService.log(
          user.userId,
          'ACCESS_DENIED',
          'Analytics requested by a learner.',
        );
        throw new AccountError(403, 'FORBIDDEN', 'Administrators only.');
      }
      if (!accounts?.reports)
        throw new AccountError(503, 'ACCOUNTS_UNAVAILABLE', 'Analytics need the database.');
      response.status(200).json(await accounts.reports.analytics(reportContext()));
    } catch (error) {
      handle(error, response);
    }
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

  app.get('/api/v2/development-learners/:learnerId/trace', async (request, response) => {
    try {
      if (!request.params.learnerId.startsWith('dev-learner-'))
        throw new LessonError(404, 'UNKNOWN_LEARNER', 'Unknown learner.');
      response.status(200).json(await service.learnerTrace(request.params.learnerId));
    } catch (error) {
      handle(error, response);
    }
  });

  // The taught walkthrough (report storyboard figure 3-5): no learner identity, never scored.
  app.post('/api/v2/walkthroughs', (request, response) => {
    const parsed = parseCreateWalkthroughRequest(request.body);
    if (!parsed.ok)
      return sendError(response, 400, { error: 'BAD_REQUEST', detail: parsed.reason });
    try {
      response.status(201).json(service.createWalkthrough(parsed.value));
    } catch (error) {
      handle(error, response);
    }
  });

  app.post('/api/v2/lessons', async (request, response) => {
    const parsed = parseCreateLessonRequest(request.body);
    if (!parsed.ok)
      return sendError(response, 400, { error: 'BAD_REQUEST', detail: parsed.reason });
    try {
      // An account's lessons are created only by that signed-in account.
      if (parsed.value.learnerId.startsWith('u-')) {
        const user = await signedIn(request);
        if (!user) throw new AccountError(401, 'NOT_SIGNED_IN', 'Sign in to continue.');
        if (publicUser(user).learnerId !== parsed.value.learnerId)
          throw new AccountError(403, 'FORBIDDEN', 'That learner is not you.');
      }
      response.status(201).json(await service.createLesson(parsed.value));
    } catch (error) {
      handle(error, response);
    }
  });

  app.post('/api/v2/lessons/:lessonId/steps/:stepId/responses', async (request, response) => {
    const parsed = parseSubmitAnswerRequest(request.body);
    if (!parsed.ok)
      return sendError(response, 400, { error: 'BAD_REQUEST', detail: parsed.reason });
    try {
      const user = await signedIn(request);
      response
        .status(200)
        .json(
          await service.submitAnswer(
            request.params.lessonId,
            request.params.stepId,
            parsed.value.answer,
            parsed.value.clientTelemetry ?? null,
            user ? publicUser(user).learnerId : null,
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
  if (error instanceof AccountError) {
    response.status(error.status).json({
      contractVersion: ACCOUNT_CONTRACT_VERSION,
      error: error.code,
      detail: error.message,
    });
    return;
  }
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
