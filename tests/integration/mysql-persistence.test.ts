// Phase 4 integration suite (IMP-015): real MySQL 8.4, never a mock, for every
// transaction claim. It needs UFUQ_TEST_MYSQL_URL pointing at a dedicated database whose
// name ends in "_test" (locally: `npm run db:local -- url test`); without it the suite
// fails instead of passing silently. It drops and recreates that database's tables.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AccountService } from '../../apps/api/src/accounts/account-service.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../apps/api/src/accounts/demo-accounts.js';
import { MySqlAccountStore } from '../../apps/api/src/accounts/account-store.js';
import { MySqlReportStore } from '../../apps/api/src/accounts/reports.js';
import { createApp } from '../../apps/api/src/app.js';
import {
  createPool,
  migrate,
  type Pool,
  type RowDataPacket,
} from '../../apps/api/src/persistence/mysql.js';
import { MySqlLearnerStore } from '../../apps/api/src/persistence/mysql-learner-store.js';
import type { StoredAttempt } from '../../apps/api/src/learners/learner-store.js';
import {
  KNOWLEDGE_COMPONENT_IDS,
  type LearnerModelState,
  type LearningConfigurationPayload,
} from '@ufuq/tutoring-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.UFUQ_TEST_MYSQL_URL;
if (!url) throw new Error('UFUQ_TEST_MYSQL_URL is required for the integration suite.');
if (!/\/[A-Za-z0-9_]+_test(\?|$)/.test(url))
  throw new Error('UFUQ_TEST_MYSQL_URL must name a dedicated *_test database.');

const TABLES = [
  'assessment_attempt',
  'assessment_session',
  'bkt_mastery_state',
  'auth_session',
  'system_log',
  'cognitive_skill',
  'app_user',
  'schema_migration',
];
const configuration = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../data/generated/learning-configuration-v1.json'),
    'utf8',
  ),
).payload as LearningConfigurationPayload;
const CHAIN = 'a'.repeat(64);

let pool: Pool;

beforeAll(async () => {
  pool = createPool(url);
  for (const table of TABLES) await pool.query(`DROP TABLE IF EXISTS ${table}`);
  expect(await migrate(pool)).toEqual([1]);
});

afterAll(async () => {
  await pool.end();
});

const attemptOf = (lessonId: string, before: number, after: number): StoredAttempt => ({
  knowledgeComponentId: 'KC-02',
  mode: 'ADAPTIVE',
  responseStatus: 'SCORED_CORRECT',
  attemptKind: 'FIRST_ATTEMPT',
  observationDecision: 'OBSERVATION_FROM_SCORE',
  observationReasonCode: 'TEST',
  modelDecision: 'OBSERVATION',
  modelReasonCode: 'TEST',
  masteryBefore: before,
  masteryAfter: after,
  revisionBefore: 0,
  revisionAfter: 1,
  scaffoldDecision: 'SCAFFOLD_UNCHANGED',
  scaffoldFrom: 'FADING',
  scaffoldTo: 'FADING',
  scaffoldReasonCode: 'TEST',
  masteryThresholdStatus: 'BELOW_THRESHOLD',
  independentConfirmationStatus: 'NOT_INDEPENDENTLY_CONFIRMED',
  lessonId,
  stepId: 'step-1',
  datasetId: 'test',
  cueSnapshotId: 'cues-test',
  issuedCueIds: ['FIGURE_LINES'],
  clientTelemetry: null,
  userAnswer: 'handle h-test',
  timeTakenSeconds: 3,
  hintsShown: true,
  attemptedAt: new Date().toISOString(),
});

describe('schema (report data design, figure 3-9)', () => {
  it('migrates once and holds every report table plus sessions and migrations', async () => {
    expect(await migrate(pool)).toEqual([]);
    const [rows] = await pool.query<(RowDataPacket & { TABLE_NAME: string; ENGINE: string })[]>(
      `SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`,
    );
    expect(rows.map((row) => row.TABLE_NAME).sort()).toEqual([...TABLES].sort());
    expect(new Set(rows.map((row) => row.ENGINE))).toEqual(new Set(['InnoDB']));
    const [skills] = await pool.query<(RowDataPacket & { kc_code: string })[]>(
      'SELECT kc_code FROM cognitive_skill ORDER BY skill_id',
    );
    expect(skills.map((row) => row.kc_code)).toEqual([...KNOWLEDGE_COMPONENT_IDS]);
  });
});

describe('accounts (UC-101)', () => {
  it('registers, rejects a duplicate, signs in and locks after five failures', async () => {
    let now = new Date('2026-11-15T00:00:00Z');
    const service = new AccountService(new MySqlAccountStore(pool), () => now);
    const user = await service.register({
      name: 'Test Learner',
      email: 'lock@example.test',
      password: 'correct horse battery',
    });
    await expect(
      service.register({ name: 'Again', email: 'lock@example.test', password: 'another one!' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    const login = await service.login({
      email: 'lock@example.test',
      password: 'correct horse battery',
    });
    expect((await service.userForToken(login.token))?.userId).toBe(user.userId);
    for (let i = 0; i < 5; i += 1)
      await expect(
        service.login({ email: 'lock@example.test', password: 'wrong password' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      service.login({ email: 'lock@example.test', password: 'correct horse battery' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
    now = new Date(now.getTime() + 16 * 60_000);
    await expect(
      service.login({ email: 'lock@example.test', password: 'correct horse battery' }),
    ).resolves.toBeTruthy();
    const [stored] = await pool.query<(RowDataPacket & { password_hash: string })[]>(
      'SELECT password_hash FROM app_user WHERE user_id = ?',
      [user.userId],
    );
    expect(stored[0]?.password_hash).toMatch(/^scrypt\$17\$8\$1\$/);
    expect(stored[0]?.password_hash).not.toContain('correct horse');
    const [logs] = await pool.query<(RowDataPacket & { event_type: string })[]>(
      'SELECT event_type FROM system_log WHERE user_id = ? ORDER BY log_id',
      [user.userId],
    );
    expect(logs.map((row) => row.event_type)).toContain('ACCOUNT_LOCKED');
  });
});

describe('learner models (IMP-015 transaction)', () => {
  let learnerId: string;
  beforeAll(async () => {
    const user = await new AccountService(new MySqlAccountStore(pool)).register({
      name: 'Model Learner',
      email: 'model@example.test',
      password: 'a long enough password',
    });
    learnerId = `u-${user.userId}`;
    await new MySqlLearnerStore(pool).openSession({
      lessonId: '00000000-0000-4000-8000-000000000001',
      learnerId,
      datasetId: 'test',
      scenarioId: 'test',
      locationName: 'Test place',
      routeId: 'route-test',
      startedAt: new Date().toISOString(),
    });
  });

  it('provisions all five rows once and survives a new store (restart)', async () => {
    const store = new MySqlLearnerStore(pool);
    const first = await store.chain(learnerId, CHAIN, configuration);
    const again = await new MySqlLearnerStore(pool).chain(learnerId, CHAIN, configuration);
    expect(again).toEqual(first);
    expect(Object.keys(first ?? {})).toEqual([...KNOWLEDGE_COMPONENT_IDS]);
    expect(first?.['KC-02'].scaffoldState).toBe('FADING');
  });

  it('commits one attempt with the next state, and rejects a stale revision', async () => {
    const store = new MySqlLearnerStore(pool);
    const state = (await store.chain(learnerId, CHAIN, configuration)) as LearnerModelState;
    const kc = state['KC-02'];
    const next: LearnerModelState = {
      ...state,
      'KC-02': {
        ...kc,
        mastery: { ...kc.mastery, masteryProbability: 0.576, masteryRevision: 1 },
      },
    };
    const lesson = '00000000-0000-4000-8000-000000000001';
    expect(
      await store.commit(learnerId, CHAIN, 'KC-02', 0, next, attemptOf(lesson, 0.2, 0.576)),
    ).toBe('COMMITTED');
    expect(
      await store.commit(learnerId, CHAIN, 'KC-02', 0, next, attemptOf(lesson, 0.2, 0.576)),
    ).toBe('STALE_MASTERY_REVISION');
    const reloaded = await new MySqlLearnerStore(pool).chain(learnerId, CHAIN, configuration);
    expect(reloaded?.['KC-02'].mastery).toMatchObject({
      masteryProbability: 0.576,
      masteryRevision: 1,
    });
    expect(await store.attempts(learnerId)).toHaveLength(1);
  });

  it('lets exactly one of two concurrent commits on the same revision win', async () => {
    const store = new MySqlLearnerStore(pool);
    const state = (await store.chain(learnerId, CHAIN, configuration)) as LearnerModelState;
    const kc = state['KC-03'];
    const next: LearnerModelState = {
      ...state,
      'KC-03': { ...kc, mastery: { ...kc.mastery, masteryProbability: 0.5, masteryRevision: 1 } },
    };
    const lesson = '00000000-0000-4000-8000-000000000001';
    const results = await Promise.all([
      store.commit(learnerId, CHAIN, 'KC-03', 0, next, attemptOf(lesson, 0.2, 0.5)),
      store.commit(learnerId, CHAIN, 'KC-03', 0, next, attemptOf(lesson, 0.2, 0.5)),
    ]);
    expect([...results].sort()).toEqual(['COMMITTED', 'STALE_MASTERY_REVISION']);
  });
});

describe('HTTP: accounts, lessons, progress and analytics (UC-101, UC-103, UC-104, UC-105)', () => {
  const app = () =>
    createApp({
      accounts: {
        accountStore: new MySqlAccountStore(pool),
        learnerStore: new MySqlLearnerStore(pool),
        reports: new MySqlReportStore(pool),
      },
    });

  it('runs a signed-in learner through a lesson and shows it on the dashboard', async () => {
    const server = app();
    const agent = request.agent(server);
    const registered = await agent
      .post('/api/v2/auth/register')
      .send({ name: 'Dashboard Learner', email: 'dash@example.test', password: 'a good password' });
    expect(registered.status).toBe(201);
    expect(registered.headers['set-cookie']?.[0]).toMatch(
      /ufuq_session=.+HttpOnly; SameSite=Strict/,
    );
    const learnerId = registered.body.learnerId as string;
    expect((await agent.get('/api/v2/auth/me')).body.learnerId).toBe(learnerId);

    // Someone else cannot create or answer this learner's lessons.
    const stranger = await request(server).post('/api/v2/lessons').send({
      contractVersion: 'lesson.v2',
      datasetId: 'synthetic-technical',
      executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
      scenarioId: 'synthetic-scenario-a',
      learnerId,
      sessionPurpose: 'LEARNING',
    });
    expect(stranger.status).toBe(401);

    const lesson = await agent.post('/api/v2/lessons').send({
      contractVersion: 'lesson.v2',
      datasetId: 'synthetic-technical',
      executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
      scenarioId: 'synthetic-scenario-a',
      learnerId,
      sessionPurpose: 'LEARNING',
    });
    expect(lesson.status).toBe(201);
    const step = lesson.body.currentStep;
    const target = step.overlays.find((o: { kind: string }) => o.kind === 'PATTERN_OUTLINE')
      ?.memberHandles[0] as string;
    const targetEnu = lesson.body.stars.find((s: { handle: string }) => s.handle === target)
      .enu as number[];
    const path = `/api/v2/lessons/${lesson.body.lessonId}/steps/${step.stepId}/responses`;
    const answer = {
      contractVersion: 'lesson.v2',
      answer: {
        kind: 'SKY_POINT',
        azimuthRadians: Math.atan2(targetEnu[0] as number, targetEnu[1] as number),
        altitudeRadians: Math.asin(targetEnu[2] as number),
        fovRadians: Math.PI / 3,
      },
    };
    expect((await request(server).post(path).send(answer)).status).toBe(404);
    const answered = await agent.post(path).send(answer);
    expect(answered.status).toBe(200);
    expect(answered.body.result).toBe('CORRECT');

    const progress = await agent.get('/api/v2/progress');
    expect(progress.status).toBe(200);
    expect(progress.body.sessions[0]).toMatchObject({ attempts: 1, correct: 1 });
    expect(progress.body.attempts[0]).toMatchObject({
      knowledgeComponentId: 'KC-02',
      responseStatus: 'SCORED_CORRECT',
      hintsShown: true,
    });
    expect(progress.body.skills).toHaveLength(5);

    expect((await agent.get('/api/v2/admin/analytics')).status).toBe(403);
    expect((await agent.post('/api/v2/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/v2/progress')).status).toBe(401);
  });

  it('shows administrators read-only aggregate analytics', async () => {
    await new AccountService(new MySqlAccountStore(pool)).register(
      { name: 'Admin', email: 'admin@example.test', password: 'an admin password' },
      'ADMIN',
    );
    const agent = request.agent(app());
    expect(
      (
        await agent
          .post('/api/v2/auth/login')
          .send({ email: 'admin@example.test', password: 'an admin password' })
      ).status,
    ).toBe(200);
    const analytics = await agent.get('/api/v2/admin/analytics');
    expect(analytics.status).toBe(200);
    expect(analytics.body.totals.learners).toBeGreaterThanOrEqual(3);
    expect(analytics.body.totals.administrators).toBe(1);
    expect(analytics.body.totals.attempts).toBeGreaterThanOrEqual(2);
    expect(analytics.body.skills).toHaveLength(5);
    expect(analytics.body.recentLogs.map((l: { eventType: string }) => l.eventType)).toContain(
      'ACCESS_DENIED',
    );
  });
});

describe('demo accounts (owner request: simple admin and learner logins)', () => {
  it('lets the seeded administrators and learners sign in with the demo password', async () => {
    const service = new AccountService(new MySqlAccountStore(pool));
    for (const account of DEMO_ACCOUNTS)
      await service.register(
        { name: account.name, email: account.email, password: DEMO_PASSWORD },
        account.role,
      );
    const app = createApp({
      accounts: {
        accountStore: new MySqlAccountStore(pool),
        learnerStore: new MySqlLearnerStore(pool),
        reports: new MySqlReportStore(pool),
      },
    });
    for (const account of DEMO_ACCOUNTS) {
      const agent = request.agent(app);
      const login = await agent
        .post('/api/v2/auth/login')
        .send({ email: account.email, password: DEMO_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.role).toBe(account.role);
      expect((await agent.get('/api/v2/admin/analytics')).status).toBe(
        account.role === 'ADMIN' ? 200 : 403,
      );
    }
    // Registering the same address again is refused; the demo password is too short to register with.
    expect(
      (
        await request(app)
          .post('/api/v2/auth/register')
          .send({ name: 'x', email: 'new@ufuq.test', password: DEMO_PASSWORD })
      ).status,
    ).toBe(400);
  });
});
