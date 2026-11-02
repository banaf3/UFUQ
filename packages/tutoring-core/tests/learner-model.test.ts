import { describe, expect, it } from 'vitest';

import {
  type IssuedTaskCues,
  KNOWLEDGE_COMPONENT_IDS,
  type LearnerModelState,
  learningModeOf,
  processAttempt,
  provisionLearnerModel,
  replayAttempts,
  type ScaffoldState,
  type SubmittedAttempt,
  validateLearningConfiguration,
} from '../src/index.js';
import { NON_ADAPTIVE_CONFIGURATION, SYNTHETIC_CONFIGURATION } from './fixtures.js';

const cues = (scaffoldState: ScaffoldState | null): IssuedTaskCues => ({
  snapshotId: `snapshot-${scaffoldState ?? 'fixed'}`,
  cueConfigurationId: 'synthetic-cues',
  cueConfigurationVersion: '1',
  scaffoldState,
  cueIds: [],
});

const attempt = (
  state: LearnerModelState,
  response: SubmittedAttempt['response'],
  change: Partial<SubmittedAttempt> = {},
): SubmittedAttempt => ({
  knowledgeComponentId: 'KC-03',
  purpose: 'LEARNING',
  issuedCues: cues(state['KC-03'].scaffoldState),
  response,
  attemptKind: 'FIRST_ATTEMPT',
  accommodations: [],
  clientTelemetry: null,
  expectedMasteryRevision: state['KC-03'].mastery.masteryRevision,
  ...change,
});

describe('learning configuration', () => {
  it('validates an adaptive and a non-adaptive configuration', () => {
    expect(validateLearningConfiguration(SYNTHETIC_CONFIGURATION)).toEqual([]);
    expect(validateLearningConfiguration(NON_ADAPTIVE_CONFIGURATION)).toEqual([]);
    expect(learningModeOf(SYNTHETIC_CONFIGURATION)).toBe('ADAPTIVE');
    expect(learningModeOf(NON_ADAPTIVE_CONFIGURATION)).toBe('NON_ADAPTIVE');
  });

  it('requires every null component to name its owning decision', () => {
    const errors = validateLearningConfiguration({ ...NON_ADAPTIVE_CONFIGURATION, unresolved: [] });
    expect(errors).toContain('observationPolicy is null but not listed as unresolved.');
    expect(
      validateLearningConfiguration({
        ...NON_ADAPTIVE_CONFIGURATION,
        unresolved: NON_ADAPTIVE_CONFIGURATION.unresolved.map((item) => ({
          ...item,
          decisionId: 'TBD',
        })),
      }).length,
    ).toBeGreaterThan(0);
  });

  it('refuses an adaptive cue table without its policies, and policies without one', () => {
    expect(
      validateLearningConfiguration({
        ...SYNTHETIC_CONFIGURATION,
        scaffoldPolicy: null,
        unresolved: [{ field: 'scaffoldPolicy', decisionId: 'BKT-004', note: 'test' }],
      }),
    ).toContain(
      'An ADAPTIVE configuration needs parameters, an observation and a scaffold policy.',
    );
    expect(
      validateLearningConfiguration({
        ...NON_ADAPTIVE_CONFIGURATION,
        observationPolicy: SYNTHETIC_CONFIGURATION.observationPolicy,
        unresolved: NON_ADAPTIVE_CONFIGURATION.unresolved.filter(
          (item) => item.field !== 'observationPolicy',
        ),
      }),
    ).toContain('Observation or scaffold policies require an ADAPTIVE cue configuration.');
  });

  it('pins the knowledge-component list to the specification', () => {
    expect(
      validateLearningConfiguration({
        ...SYNTHETIC_CONFIGURATION,
        knowledgeComponents: SYNTHETIC_CONFIGURATION.knowledgeComponents.slice(0, 4),
      }).length,
    ).toBe(1);
  });
});

describe('learner model composition', () => {
  it('provisions all five KCs with the initial scaffold at once', () => {
    const state = provisionLearnerModel(SYNTHETIC_CONFIGURATION) as LearnerModelState;
    expect(Object.keys(state)).toEqual([...KNOWLEDGE_COMPONENT_IDS]);
    for (const kc of KNOWLEDGE_COMPONENT_IDS) {
      expect(state[kc]).toMatchObject({ scaffoldState: 'GUIDED', history: [] });
      expect(state[kc].mastery).toMatchObject({ masteryProbability: 0.2, masteryRevision: 0 });
    }
    expect(provisionLearnerModel({ ...SYNTHETIC_CONFIGURATION, bktParameters: null })).toBeNull();
  });

  it('fades guidance, then confirms independence, through typed decisions', () => {
    let state = provisionLearnerModel(SYNTHETIC_CONFIGURATION) as LearnerModelState;
    const run = (
      response: SubmittedAttempt['response'],
      change: Partial<SubmittedAttempt> = {},
    ) => {
      const result = processAttempt(
        state,
        SYNTHETIC_CONFIGURATION,
        attempt(state, response, change),
      );
      if (!result.ok) throw new Error(result.failure);
      state = result.nextState;
      return result.record;
    };
    const guided = run('SCORED_CORRECT');
    expect(guided.model.kind).toBe('TRANSITION_ONLY');
    expect(guided.scaffold).toMatchObject({ kind: 'SCAFFOLD_TRANSITION', toState: 'FADING' });
    expect(state['KC-03'].mastery.masteryProbability).toBeCloseTo(0.28, 15);

    const fadingOne = run('SCORED_CORRECT');
    expect(fadingOne.model.kind).toBe('OBSERVATION');
    expect(fadingOne.scaffold.kind).toBe('SCAFFOLD_UNCHANGED');
    expect(fadingOne.masteryThreshold.status).toBe('BELOW_THRESHOLD');

    const fadingTwo = run('SCORED_CORRECT');
    expect(state['KC-03'].mastery.masteryProbability).toBeCloseTo(0.912195121951, 12);
    expect(fadingTwo.masteryThreshold.status).toBe('MEETS_THRESHOLD');
    expect(fadingTwo.scaffold).toMatchObject({ toState: 'INDEPENDENT' });
    // Threshold reached, yet no independent evidence exists: two distinct concepts.
    expect(fadingTwo.independentConfirmation.status).toBe('NOT_INDEPENDENTLY_CONFIRMED');

    run('SCORED_CORRECT');
    const confirmed = run('SCORED_CORRECT');
    expect(confirmed.independentConfirmation.status).toBe('INDEPENDENTLY_CONFIRMED');

    const slip = run('SCORED_INCORRECT');
    expect(slip.scaffold).toMatchObject({
      toState: 'FADING',
      reasonCode: 'RESTORE_PARTIAL_GUIDANCE_AFTER_ERROR',
    });
    // Other KCs are untouched.
    expect(state['KC-01'].mastery.masteryRevision).toBe(0);
  });

  it('rejects a stale submission without changing state', () => {
    const state = provisionLearnerModel(SYNTHETIC_CONFIGURATION) as LearnerModelState;
    const first = processAttempt(state, SYNTHETIC_CONFIGURATION, attempt(state, 'SCORED_CORRECT'));
    if (!first.ok) throw new Error('first');
    const delayed = processAttempt(
      first.nextState,
      SYNTHETIC_CONFIGURATION,
      attempt(state, 'SCORED_INCORRECT', { expectedMasteryRevision: 0 }),
    );
    expect(delayed).toMatchObject({ ok: false, failure: 'STALE_MASTERY_REVISION' });
  });

  it('refuses a cue snapshot from the other configuration mode', () => {
    const state = provisionLearnerModel(SYNTHETIC_CONFIGURATION) as LearnerModelState;
    expect(
      processAttempt(
        state,
        SYNTHETIC_CONFIGURATION,
        attempt(state, 'SCORED_CORRECT', { issuedCues: cues(null) }),
      ),
    ).toMatchObject({ ok: false, failure: 'CUE_SNAPSHOT_MODE_MISMATCH' });
  });

  it('records an explicit no-op for every attempt when policies are unresolved', () => {
    const state = provisionLearnerModel(NON_ADAPTIVE_CONFIGURATION) as LearnerModelState;
    const result = processAttempt(
      state,
      NON_ADAPTIVE_CONFIGURATION,
      attempt(state, 'SCORED_CORRECT', { issuedCues: cues(null) }),
    );
    if (!result.ok) throw new Error(result.failure);
    expect(result.record.model).toMatchObject({
      kind: 'NO_MODEL_UPDATE',
      reasonCode: 'OBSERVATION_POLICY_UNRESOLVED',
      masteryUnchanged: 0.2,
      revisionUnchanged: 0,
    });
    expect(result.record.scaffold).toEqual({
      kind: 'SCAFFOLD_NOT_ADAPTIVE',
      reasonCode: 'SCAFFOLD_POLICY_UNRESOLVED',
    });
    expect(result.record.masteryThreshold.status).toBe('THRESHOLD_POLICY_UNRESOLVED');
  });

  it('replays deterministically', () => {
    const state = provisionLearnerModel(SYNTHETIC_CONFIGURATION) as LearnerModelState;
    const sequence: Omit<SubmittedAttempt, 'expectedMasteryRevision'>[] = [
      'SCORED_CORRECT',
      'SCORED_INCORRECT',
      'SCORED_CORRECT',
      'SCORED_UNCLASSIFIED',
      'SCORED_CORRECT',
    ].map((response, index) => {
      const { expectedMasteryRevision, ...rest } = attempt(
        state,
        response as SubmittedAttempt['response'],
        {
          knowledgeComponentId: index % 2 === 0 ? 'KC-03' : 'KC-01',
        },
      );
      void expectedMasteryRevision;
      return rest;
    });
    // Scaffold states advance during the sequence, so each attempt carries the cues issued
    // from the state current at that point.
    const withLiveCues = (input: typeof sequence) => {
      let live = state;
      return input.map((item) => {
        const value = { ...item, issuedCues: cues(live[item.knowledgeComponentId].scaffoldState) };
        const result = processAttempt(live, SYNTHETIC_CONFIGURATION, {
          ...value,
          expectedMasteryRevision: live[item.knowledgeComponentId].mastery.masteryRevision,
        });
        if (result.ok) live = result.nextState;
        return value;
      });
    };
    const resolved = withLiveCues(sequence);
    const first = replayAttempts(SYNTHETIC_CONFIGURATION, resolved);
    const second = replayAttempts(SYNTHETIC_CONFIGURATION, resolved);
    expect(second).toEqual(first);
    expect(first.records.map((record) => record.model.kind)).toEqual([
      'TRANSITION_ONLY',
      'TRANSITION_ONLY',
      'OBSERVATION',
      'NO_MODEL_UPDATE',
      'OBSERVATION',
    ]);
  });
});
