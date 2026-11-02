import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import type { LessonSessionV1, StepFeedbackV1 } from '@ufuq/contracts';

import { createApp, defaultDataDirectory } from './app.js';
import { evaluateRouteEligibility } from './lesson/lesson-service.js';

const synthetic = {
  datasetId: 'synthetic-technical',
  executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
};

async function createLesson(app: ReturnType<typeof createApp>, scenarioId: string) {
  return request(app)
    .post('/api/v1/lessons')
    .send({ contractVersion: 'lesson.v1', ...synthetic, scenarioId });
}

/** Test-only oracle: identify handles by their direction (the API never reveals targets). */
function handleNear(lesson: LessonSessionV1, raDecGuess: (enu: readonly number[]) => number) {
  return [...lesson.stars].sort((a, b) => raDecGuess(a.enu) - raDecGuess(b.enu))[0]
    ?.handle as string;
}

describe('GET /health', () => {
  it('reports the API as healthy', async () => {
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'api', phase: 'vertical-slice' });
  });
});

describe('lesson API (synthetic technical fixture)', () => {
  const app = createApp();

  it('lists datasets with approval states and never enables review preview by default', async () => {
    const response = await request(app).get('/api/v1/datasets');
    expect(response.status).toBe(200);
    const real = response.body.datasets.find(
      (d: { datasetId: string }) => d.datasetId === 'profile-v1-umpsa-pekan',
    );
    expect(real.executionScopes).toEqual(['SCIENTIFIC_PROFILE_V1']);
  });

  it('selects the route from data and keeps targets server-side', async () => {
    const response = await createLesson(app, 'synthetic-scenario-a');
    expect(response.status).toBe(201);
    const lesson = response.body as LessonSessionV1;
    expect(lesson.routeTitle).toBe('Synthetic route A');
    expect(lesson.provenance.scientificValidationState).toBe('GEOMETRIC_RESULT_PENDING_VALIDATION');
    const serialized = JSON.stringify(lesson);
    expect(serialized).not.toMatch(/synthetic-star-|starId|memberStarIds|azimuthRadians/);
    expect(lesson.currentStep?.taskKind).toBe('IDENTIFY_PATTERN_MEMBER');
  });

  it('chooses the alternative route when the preferred helper is below the horizon', async () => {
    const response = await createLesson(app, 'synthetic-scenario-b');
    expect(response.status).toBe(201);
    expect(response.body.routeTitle).toBe('Synthetic route B');
  });

  it('runs the full three-step journey with exact star scoring and a measured direction', async () => {
    const lesson = (await createLesson(app, 'synthetic-scenario-a')).body as LessonSessionV1;
    const submit = (stepId: string, answer: unknown) =>
      request(app)
        .post(`/api/v1/lessons/${lesson.lessonId}/steps/${stepId}/responses`)
        .send({ contractVersion: 'lesson.v1', answer });
    // The pole-near synthetic target has the highest north component near the horizon;
    // helper stars are the visible stars far from it.
    const target = handleNear(lesson, (enu) => -enu[1]! + Math.abs(enu[2]! - 0.06));
    const helper = lesson.stars.find(
      (s) => !s.belowGeometricHorizon && s.handle !== target,
    )!.handle;

    const wrong = await submit('step-1', { kind: 'STAR_SELECTION', starHandle: target });
    expect((wrong.body as StepFeedbackV1).result).toBe('INCORRECT');
    const first = await submit('step-1', { kind: 'STAR_SELECTION', starHandle: helper });
    expect(first.body.result).toBe('CORRECT');
    expect(first.body.overlays.map((o: { kind: string }) => o.kind)).toEqual([
      'PATTERN_OUTLINE',
      'GUIDE_ARC',
    ]);
    const stale = await submit('step-1', { kind: 'STAR_SELECTION', starHandle: helper });
    expect(stale.status).toBe(409);
    const second = await submit('step-2', { kind: 'STAR_SELECTION', starHandle: target });
    expect(second.body.result).toBe('CORRECT');
    const third = await submit('step-3', { kind: 'DIRECTION', azimuthRadians: 0.1 });
    expect(third.body.result).toBe('MEASURED_NO_TOLERANCE');
    expect(third.body.measurement.angularDifferenceRadians).toBeCloseTo(0.1, 12);
    expect(third.body.completed).toBe(true);
  });

  it('rejects client-supplied correctness and malformed evidence', async () => {
    const lesson = (await createLesson(app, 'synthetic-scenario-a')).body as LessonSessionV1;
    const response = await request(app)
      .post(`/api/v1/lessons/${lesson.lessonId}/steps/step-1/responses`)
      .send({
        contractVersion: 'lesson.v1',
        answer: { kind: 'STAR_SELECTION', starHandle: 'x', correct: true },
      });
    expect(response.status).toBe(400);
    const nan = await request(app)
      .post(`/api/v1/lessons/${lesson.lessonId}/steps/step-1/responses`)
      .send({
        contractVersion: 'lesson.v1',
        answer: { kind: 'DIRECTION', azimuthRadians: 'north' },
      });
    expect(nan.status).toBe(400);
  });

  it('fails closed for unapproved ProfileV1 data and unknown scopes', async () => {
    const strict = await request(app).post('/api/v1/lessons').send({
      contractVersion: 'lesson.v1',
      datasetId: 'profile-v1-umpsa-pekan',
      scenarioId: 'scenario-2025-11-15-evening',
      executionScope: 'SCIENTIFIC_PROFILE_V1',
    });
    expect(strict.status).toBe(422);
    const preview = await request(app).post('/api/v1/lessons').send({
      contractVersion: 'lesson.v1',
      datasetId: 'profile-v1-umpsa-pekan',
      scenarioId: 'scenario-2025-11-15-evening',
      executionScope: 'REVIEW_PREVIEW',
    });
    expect(preview.status).toBe(403);
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
    const tampered = createApp({ dataDirectory: directory });
    const response = await createLesson(tampered, 'synthetic-scenario-a');
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
