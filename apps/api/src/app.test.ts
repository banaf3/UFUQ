import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { canonicalJson } from '@ufuq/catalogue-schema';
import type {
  LearnerTraceResponseV2,
  LessonSessionV2,
  LessonStepPromptV2,
  SkyOverlayV2,
  SkyViewV1,
  StepFeedbackV2,
} from '@ufuq/contracts';

import { createApp, defaultDataDirectory } from './app.js';
import { evaluateRouteEligibility } from './lesson/lesson-service.js';

type App = ReturnType<typeof createApp>;
const V2 = 'lesson.v2';

async function newLearner(app: App): Promise<string> {
  const response = await request(app).post('/api/v2/development-learners').send({});
  expect(response.status).toBe(201);
  return response.body.learnerId as string;
}

async function createLesson(
  app: App,
  learnerId: string,
  scenarioId: string,
  change: Record<string, unknown> = {},
) {
  return request(app)
    .post('/api/v2/lessons')
    .send({
      contractVersion: V2,
      datasetId: 'synthetic-technical',
      executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
      scenarioId,
      learnerId,
      sessionPurpose: 'LEARNING',
      ...change,
    });
}

function submitter(app: App, lessonId: string) {
  return (stepId: string, answer: unknown, extra: Record<string, unknown> = {}) =>
    request(app)
      .post(`/api/v2/lessons/${lessonId}/steps/${stepId}/responses`)
      .send({ contractVersion: V2, answer, ...extra });
}

const overlay = <K extends SkyOverlayV2['kind']>(step: LessonStepPromptV2 | null, kind: K) =>
  step?.overlays.find((o): o is Extract<SkyOverlayV2, { kind: K }> => o.kind === kind);

/** The guided worked example reveals the answer handles; tests read them from the cues. */
const outlineMembers = (step: LessonStepPromptV2 | null) =>
  overlay(step, 'PATTERN_OUTLINE')?.memberHandles ?? [];

describe('GET /health', () => {
  it('reports the API as healthy', async () => {
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'api', phase: 'adaptive-tutoring' });
  });
});

describe('server composition', () => {
  it('omits the development identity unless explicitly composed (IMP-016)', async () => {
    const app = createApp();
    const list = await request(app).get('/api/v2/datasets');
    expect(list.body.developmentIdentityEnabled).toBe(false);
    expect((await request(app).post('/api/v2/development-learners').send({})).status).toBe(403);
    const lesson = await createLesson(app, 'dev-learner-0', 'synthetic-scenario-a');
    expect(lesson.status).toBe(403);
    expect(lesson.body.error).toBe('DEVELOPMENT_IDENTITY_DISABLED');
  });

  it('lists datasets with approval and learning modes; review preview stays off', async () => {
    const response = await request(createApp({ enableDevelopmentIdentity: true })).get(
      '/api/v2/datasets',
    );
    const byId = Object.fromEntries(
      response.body.datasets.map((d: { datasetId: string }) => [d.datasetId, d]),
    );
    expect(byId['profile-v1-umpsa-pekan'].executionScopes).toEqual(['SCIENTIFIC_PROFILE_V1']);
    expect(byId['profile-v1-umpsa-pekan'].learningMode).toBe('NON_ADAPTIVE');
    expect(byId['synthetic-technical'].learningMode).toBe('ADAPTIVE');
  });
});

describe('adaptive lesson API (synthetic technical fixture)', () => {
  const app = createApp({ enableDevelopmentIdentity: true });

  it('selects the route from data and keeps targets server-side', async () => {
    const learner = await newLearner(app);
    const response = await createLesson(app, learner, 'synthetic-scenario-a');
    expect(response.status).toBe(201);
    const lesson = response.body as LessonSessionV2;
    expect(lesson.routeTitle).toBe('Synthetic route A');
    expect(lesson.provenance.learningConfiguration.mode).toBe('ADAPTIVE');
    const serialized = JSON.stringify({ ...lesson, currentStep: null });
    expect(serialized).not.toMatch(/synthetic-star-|starId|memberStarIds|azimuthRadians/);
    expect(lesson.currentStep).toMatchObject({
      taskKind: 'IDENTIFY_PATTERN_MEMBER',
      knowledgeComponentId: 'KC-02',
      support: {
        mode: 'ADAPTIVE',
        scaffoldState: 'GUIDED',
        cueIds: ['TARGET_OUTLINE', 'SHAPE_HINT_TEXT'],
      },
      hints: ['Synthetic zigzag of five stars.'],
    });
  });

  it('runs the journey, records typed decisions and fades support across lessons', async () => {
    const learner = await newLearner(app);
    const lesson = (await createLesson(app, learner, 'synthetic-scenario-a'))
      .body as LessonSessionV2;
    const submit = submitter(app, lesson.lessonId);
    const helper = outlineMembers(lesson.currentStep);
    const outsider = lesson.stars.find(
      (s) => !s.belowGeometricHorizon && !helper.includes(s.handle),
    )?.handle as string;

    const wrong = (await submit('step-1', { kind: 'STAR_SELECTION', starHandle: outsider }))
      .body as StepFeedbackV2;
    expect(wrong.result).toBe('INCORRECT');
    expect(wrong.trace).toMatchObject({
      knowledgeComponentId: 'KC-02',
      attemptKind: 'FIRST_ATTEMPT',
      modelDecision: 'TRANSITION_ONLY',
      scaffoldDecision: 'SCAFFOLD_UNCHANGED',
    });
    expect(wrong.nextStep?.stepId).toBe('step-1');
    const retry = (await submit('step-1', { kind: 'STAR_SELECTION', starHandle: helper[0] }))
      .body as StepFeedbackV2;
    expect(retry.result).toBe('CORRECT');
    expect(retry.trace).toMatchObject({
      attemptKind: 'RETRY_AFTER_FEEDBACK',
      modelDecision: 'NO_MODEL_UPDATE',
      modelReasonCode: 'RETRY_NOT_INDEPENDENT_EVIDENCE',
    });

    const step2 = retry.nextStep as LessonStepPromptV2;
    expect(step2.support).toMatchObject({
      scaffoldState: 'GUIDED',
      cueIds: ['SOURCE_PATTERN_OUTLINE', 'GUIDE_LINE_FULL'],
    });
    const arc = overlay(step2, 'GUIDE_ARC');
    const target = arc?.handles.at(-1) as string;
    // Handles are random per lesson; the same scenario gives the same directions.
    const enuOf = (handle: string) => lesson.stars.find((s) => s.handle === handle)?.enu;
    const helperEnu = enuOf(helper[0] as string);
    const targetEnu = enuOf(target);
    const second = (await submit('step-2', { kind: 'STAR_SELECTION', starHandle: target }))
      .body as StepFeedbackV2;
    expect(second.trace).toMatchObject({ scaffoldFrom: 'GUIDED', scaffoldTo: 'FADING' });
    expect(second.nextStep?.overlays.map((o) => o.kind)).toEqual([
      'STAR_LABEL',
      'VERTICAL_TO_HORIZON',
    ]);
    expect(second.nextStep?.hideCardinalLabels).toBe(true);

    const far = (await submit('step-3', { kind: 'DIRECTION', azimuthRadians: 0.5 }))
      .body as StepFeedbackV2;
    expect(far.result).toBe('INCORRECT');
    expect(far.feedback).toContain('synthetic-direction-tolerance');
    const near = (await submit('step-3', { kind: 'DIRECTION', azimuthRadians: 0.1 }))
      .body as StepFeedbackV2;
    expect(near.result).toBe('CORRECT');
    expect(near.measurement?.angularDifferenceRadians).toBeCloseTo(0.1, 12);
    expect(near.completed).toBe(true);
    expect(near.overlays.length).toBeGreaterThan(0);

    // Lesson 2: the al-Jady-type step is now issued in FADING with a partial guide.
    const fading = async () => {
      const next = (await createLesson(app, learner, 'synthetic-scenario-a'))
        .body as LessonSessionV2;
      const byEnu = (enu: unknown) =>
        next.stars.find((s) => JSON.stringify(s.enu) === JSON.stringify(enu))?.handle as string;
      const go = submitter(app, next.lessonId);
      const first = (await go('step-1', { kind: 'STAR_SELECTION', starHandle: byEnu(helperEnu) }))
        .body as StepFeedbackV2;
      expect(first.result).toBe('CORRECT');
      return { go, step2: first.nextStep as LessonStepPromptV2, target: byEnu(targetEnu) };
    };
    const two = await fading();
    expect(two.step2.support).toMatchObject({
      scaffoldState: 'FADING',
      cueIds: ['SOURCE_PATTERN_OUTLINE', 'GUIDE_LINE_PARTIAL'],
    });
    const partial = overlay(two.step2, 'GUIDE_ARC_PARTIAL');
    expect(partial?.endEnu.length).toBe(3);
    expect(JSON.stringify(two.step2)).not.toContain(two.target);
    const observed = (await two.go('step-2', { kind: 'STAR_SELECTION', starHandle: two.target }))
      .body as StepFeedbackV2;
    expect(observed.trace).toMatchObject({
      modelDecision: 'OBSERVATION',
      scaffoldDecision: 'SCAFFOLD_UNCHANGED',
    });

    const three = await fading();
    const promoted = (
      await three.go('step-2', { kind: 'STAR_SELECTION', starHandle: three.target })
    ).body as StepFeedbackV2;
    expect(promoted.trace).toMatchObject({
      scaffoldTo: 'INDEPENDENT',
      scaffoldReasonCode: 'INDEPENDENT_AFTER_FADING_SUCCESS',
      masteryThresholdStatus: 'MEETS_THRESHOLD',
      independentConfirmationStatus: 'NOT_INDEPENDENTLY_CONFIRMED',
    });
    expect(promoted.trace?.masteryAfter).toBeCloseTo(0.912195121951, 12);

    const four = await fading();
    expect(four.step2.support).toMatchObject({ scaffoldState: 'INDEPENDENT', cueIds: [] });
    expect(four.step2.overlays).toEqual([]);

    const trace = (await request(app).get(`/api/v2/development-learners/${learner}/trace`))
      .body as LearnerTraceResponseV2;
    expect(trace.attempts.filter((a) => a.knowledgeComponentId === 'KC-03').length).toBe(3);
  });

  it('rejects delayed evidence after newer learning and reissues the task', async () => {
    const learner = await newLearner(app);
    const first = (await createLesson(app, learner, 'synthetic-scenario-a'))
      .body as LessonSessionV2;
    const second = (await createLesson(app, learner, 'synthetic-scenario-a'))
      .body as LessonSessionV2;
    const helper = outlineMembers(first.currentStep)[0] as string;
    await submitter(app, first.lessonId)('step-1', { kind: 'STAR_SELECTION', starHandle: helper });
    const secondHelper = outlineMembers(second.currentStep)[0] as string;
    const stale = await submitter(app, second.lessonId)('step-1', {
      kind: 'STAR_SELECTION',
      starHandle: secondHelper,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe('STALE_MASTERY_REVISION');
    expect(stale.body.reissuedStep.support.scaffoldState).toBe('FADING');
    expect(stale.body.reissuedStep.support.cueSnapshotId).not.toBe(
      second.currentStep?.support.cueSnapshotId,
    );
    const replay = await submitter(app, second.lessonId)('step-1', {
      kind: 'STAR_SELECTION',
      starHandle: secondHelper,
    });
    expect(replay.status).toBe(200);
    expect(replay.body.attempt).toBe(1);
  });

  it('stores client telemetry apart from evidence and never upgrades assistance', async () => {
    const learner = await newLearner(app);
    const lesson = (await createLesson(app, learner, 'synthetic-scenario-a'))
      .body as LessonSessionV2;
    const response = await submitter(app, lesson.lessonId)(
      'step-1',
      { kind: 'STAR_SELECTION', starHandle: outlineMembers(lesson.currentStep)[0] },
      { clientTelemetry: { renderedCueIds: [] } },
    );
    expect(response.body.trace.observationDecision).toBe('TRANSITION_ONLY');
    const trace = (await request(app).get(`/api/v2/development-learners/${learner}/trace`))
      .body as LearnerTraceResponseV2;
    expect(trace.attempts[0]).toMatchObject({
      clientTelemetry: { renderedCueIds: [] },
      issuedCueIds: ['TARGET_OUTLINE', 'SHAPE_HINT_TEXT'],
    });
  });

  it('scores the select-every-member task by exact set equality', async () => {
    const learner = await newLearner(app);
    const lesson = (await createLesson(app, learner, 'synthetic-scenario-b'))
      .body as LessonSessionV2;
    expect(lesson.routeTitle).toBe('Synthetic route B');
    expect(lesson.currentStep).toMatchObject({
      taskKind: 'SELECT_ALL_PATTERN_MEMBERS',
      knowledgeComponentId: 'KC-01',
    });
    const members = outlineMembers(lesson.currentStep);
    expect(members.length).toBe(7);
    const submit = submitter(app, lesson.lessonId);
    expect(
      (await submit('step-1', { kind: 'STAR_SELECTION', starHandle: members[0] })).status,
    ).toBe(400);
    const partial = await submit('step-1', {
      kind: 'STAR_SET_SELECTION',
      starHandles: members.slice(1),
    });
    expect(partial.body.result).toBe('INCORRECT');
    const full = await submit('step-1', {
      kind: 'STAR_SET_SELECTION',
      starHandles: [...members].reverse(),
    });
    expect(full.body.result).toBe('CORRECT');
  });

  it('rejects client correctness, malformed evidence, evaluation sessions and unknown learners', async () => {
    const learner = await newLearner(app);
    const lesson = (await createLesson(app, learner, 'synthetic-scenario-a'))
      .body as LessonSessionV2;
    const submit = submitter(app, lesson.lessonId);
    expect(
      (await submit('step-1', { kind: 'STAR_SELECTION', starHandle: 'x', correct: true })).status,
    ).toBe(400);
    expect((await submit('step-1', { kind: 'DIRECTION', azimuthRadians: 'north' })).status).toBe(
      400,
    );
    expect(
      (
        await submit(
          'step-1',
          { kind: 'STAR_SELECTION', starHandle: 'x' },
          { scaffoldState: 'INDEPENDENT' },
        )
      ).status,
    ).toBe(400);
    const evaluation = await createLesson(app, learner, 'synthetic-scenario-a', {
      sessionPurpose: 'POST_TEST',
    });
    expect(evaluation.status).toBe(422);
    expect(evaluation.body.error).toBe('SESSION_PURPOSE_NOT_ENABLED');
    expect((await createLesson(app, 'dev-learner-unknown', 'synthetic-scenario-a')).status).toBe(
      404,
    );
  });

  it('fails closed for unapproved ProfileV1 data and unknown scopes', async () => {
    const learner = await newLearner(app);
    const real = { datasetId: 'profile-v1-umpsa-pekan', scenarioId: 'scenario-2025-11-15-evening' };
    const strict = await createLesson(app, learner, real.scenarioId, {
      ...real,
      executionScope: 'SCIENTIFIC_PROFILE_V1',
    });
    expect(strict.status).toBe(422);
    const preview = await createLesson(app, learner, real.scenarioId, {
      ...real,
      executionScope: 'REVIEW_PREVIEW',
    });
    expect(preview.status).toBe(403);
  });
});

describe('non-adaptive configuration (policies unresolved)', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ufuq-learning-'));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it('records explicit no-ops and keeps a fixed presentation', async () => {
    cpSync(join(defaultDataDirectory(), 'synthetic'), join(directory, 'synthetic'), {
      recursive: true,
    });
    const path = join(directory, 'synthetic', 'synthetic-learning-configuration-v1.json');
    const envelope = JSON.parse(readFileSync(path, 'utf8'));
    const real = JSON.parse(
      readFileSync(join(defaultDataDirectory(), 'learning-configuration-v1.json'), 'utf8'),
    );
    envelope.payload = { ...real.payload, configurationScope: 'SYNTHETIC_TECHNICAL_FIXTURE' };
    envelope.payloadSha256 = createHash('sha256')
      .update(canonicalJson(envelope.payload), 'utf8')
      .digest('hex');
    writeFileSync(path, JSON.stringify(envelope));
    const app = createApp({ dataDirectory: directory, enableDevelopmentIdentity: true });
    const learner = await newLearner(app);
    const lesson = (await createLesson(app, learner, 'synthetic-scenario-a'))
      .body as LessonSessionV2;
    expect(lesson.currentStep?.support).toMatchObject({
      mode: 'NON_ADAPTIVE',
      scaffoldState: null,
      cueIds: [],
    });
    const submit = submitter(app, lesson.lessonId);
    const helper = lesson.stars.find((s) => !s.belowGeometricHorizon)?.handle as string;
    const answer = (await submit('step-1', { kind: 'STAR_SELECTION', starHandle: helper }))
      .body as StepFeedbackV2;
    expect(answer.trace).toMatchObject({
      mode: 'NON_ADAPTIVE',
      modelDecision: 'NO_MODEL_UPDATE',
      modelReasonCode: 'OBSERVATION_POLICY_UNRESOLVED',
      scaffoldDecision: 'SCAFFOLD_NOT_ADAPTIVE',
      revisionBefore: 0,
      revisionAfter: 0,
    });
  });
});

describe('route eligibility (IMP-018)', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ufuq-data-'));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  it('makes a route ineligible when a required star row is missing (fail closed)', async () => {
    cpSync(join(defaultDataDirectory(), 'synthetic'), join(directory, 'synthetic'), {
      recursive: true,
    });
    // Tampering with a star artifact breaks its payload hash: the whole star artifact is
    // then an INTEGRITY_FAILURE and no lesson can be created.
    const starsPath = join(directory, 'synthetic', 'synthetic-stars-v1.json');
    const stars = JSON.parse(readFileSync(starsPath, 'utf8'));
    stars.payload.stars = stars.payload.stars.filter(
      (s: { starId: string }) => s.starId !== 'synthetic-star-a3',
    );
    writeFileSync(starsPath, JSON.stringify(stars));
    const tampered = createApp({ dataDirectory: directory, enableDevelopmentIdentity: true });
    const response = await createLesson(
      tampered,
      await newLearner(tampered),
      'synthetic-scenario-a',
    );
    expect(response.status).toBe(422);
  });

  it('excludes a route whose required star has no valid direction', () => {
    const content = {
      contentVersion: 't',
      contentScope: 'SYNTHETIC_TECHNICAL_FIXTURE' as const,
      starArtifact: { artifactId: 'x', payloadSha256: 'x' },
      patterns: [],
      directions: [],
      relationships: [],
      scenarios: [],
      routes: [
        {
          stableId: 'r1',
          routeVersion: '1',
          title: 'r1',
          selectionPriority: 1,
          requiredStarIds: ['s1', 's2'],
          steps: [],
          allowedAlternativeRouteIds: [],
          review: {
            state: 'APPROVED' as const,
            scope: 'SYNTHETIC_TECHNICAL_FIXTURE' as const,
            requiredReviewKinds: [],
            reviewer: 'x',
            decisionDate: 'x',
            decisionReference: 'x',
          },
        },
      ],
    };
    const direction = { horizonClassification: 'NOT_BELOW_GEOMETRIC_HORIZON' } as never;
    const result = evaluateRouteEligibility(
      content,
      new Map([['s1', direction]]),
      'SYNTHETIC_TECHNICAL_FIXTURE',
    );
    expect(result[0]?.eligible).toBe(false);
    expect(result[0]?.reasons).toContain('s2 has no valid direction');
  });
});

describe('sky explorer API (report UC-102)', () => {
  const app = createApp({ enableDevelopmentIdentity: true });
  const sky = (query: string) => request(app).get(`/api/v2/sky?${query}`);
  const synthetic = 'datasetId=synthetic-technical&executionScope=SYNTHETIC_TECHNICAL_FIXTURE';

  it('returns the whole sky with cultures for a scenario, without any identity', async () => {
    const response = await sky(`${synthetic}&scenarioId=synthetic-scenario-a`);
    expect(response.status).toBe(200);
    const body = response.body as SkyViewV1;
    expect(body.contractVersion).toBe('sky.v1');
    expect(body.stars.count).toBe(413);
    expect(body.stars.ids).toHaveLength(413);
    expect(body.stars.enu).toHaveLength(413 * 3);
    expect(new Set(body.stars.ids).size).toBe(413);
    expect(body.cultures.map((c) => c.cultureId)).toEqual(['arabic-ufuq', 'synthetic-culture']);
    const figure = body.cultures[1]?.figures[0];
    expect(figure?.segments.length).toBe(3);
    expect(body.starNames[0]).toMatchObject({ name: 'Synthetica', language: 'Synthetic' });
    expect(body.provenance.displayPolicyId).toBe('SKY_DISPLAY_POLICY_V1');
  });

  it('accepts a canonical UTC instant inside the domain and refuses one outside', async () => {
    const inside = await sky(`${synthetic}&utc=2026-06-01T15:00:00Z`);
    expect(inside.status).toBe(200);
    expect(inside.body.scenarioId).toBeNull();
    // Inside leap validity but outside the activated domain (stage 4 after stage 3).
    const outside = await sky(`${synthetic}&utc=2027-01-15T00:00:00Z`);
    expect(outside.status).toBe(422);
    expect(outside.body.error).toBe('TIME_OUTSIDE_SUPPORTED_DOMAIN');
    expect((await sky(`${synthetic}&utc=now`)).status).toBe(422);
  });

  it('validates parameters and fails closed for unapproved real data', async () => {
    expect((await sky(synthetic)).status).toBe(400);
    expect((await sky(`${synthetic}&utc=2026-06-01T15:00:00Z&scenarioId=x`)).status).toBe(400);
    expect((await sky(`${synthetic}&scenarioId=s&extra=1`)).status).toBe(400);
    const strict = await sky(
      'datasetId=profile-v1-umpsa-pekan&executionScope=SCIENTIFIC_PROFILE_V1&scenarioId=scenario-2025-11-15-evening',
    );
    expect(strict.status).toBe(422);
    const preview = await sky(
      'datasetId=profile-v1-umpsa-pekan&executionScope=REVIEW_PREVIEW&scenarioId=scenario-2025-11-15-evening',
    );
    expect(preview.status).toBe(403);
  });

  it('lists the supported domain for the time picker', async () => {
    const list = await request(app).get('/api/v2/datasets');
    const synthetic = list.body.datasets.find(
      (d: { datasetId: string }) => d.datasetId === 'synthetic-technical',
    );
    expect(synthetic.supportedDomain).toEqual({
      earliest: '2026-01-02T00:00:00Z',
      earliestBoundary: 'INCLUSIVE',
      latest: '2026-12-30T00:00:00Z',
      latestBoundary: 'EXCLUSIVE',
    });
  });

  it('gives lessons the full background sky behind opaque handles', async () => {
    const learner = await newLearner(app);
    const lesson = (await createLesson(app, learner, 'synthetic-scenario-a'))
      .body as LessonSessionV2;
    expect(lesson.stars).toHaveLength(413);
    expect(JSON.stringify(lesson.stars)).not.toMatch(/hip-|synthetic-star-|Synthetica/);
    expect(lesson.stars.some((star) => star.colorIndexBV !== null)).toBe(true);
  });
});
