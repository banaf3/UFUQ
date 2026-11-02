import { describe, expect, it } from 'vitest';

import {
  type AttemptEvidence,
  decideObservation,
  type EvidenceHistoryEntry,
  independentConfirmationStatus,
  type ObservationPolicy,
  RESPONSE_STATUSES,
  SCAFFOLD_STATES,
  validateIndependentConfirmationPolicy,
  validateObservationPolicy,
} from '../src/index.js';
import { SYNTHETIC_CONFIRMATION, SYNTHETIC_OBSERVATION } from './fixtures.js';

const evidence = (change: Partial<AttemptEvidence> = {}): AttemptEvidence => ({
  purpose: 'LEARNING',
  issuedCues: {
    snapshotId: 'cue-snapshot-1',
    cueConfigurationId: 'synthetic-cues',
    cueConfigurationVersion: '1',
    scaffoldState: 'FADING',
    cueIds: ['SHAPE_HINT_TEXT'],
  },
  response: 'SCORED_CORRECT',
  attemptKind: 'FIRST_ATTEMPT',
  accommodations: [],
  clientTelemetry: null,
  ...change,
});

const withRules = (rules: ObservationPolicy['rules']): ObservationPolicy => ({
  ...SYNTHETIC_OBSERVATION,
  rules,
});

describe('observation policy validation (BKT-001/BKT-005 table shape)', () => {
  it('accepts a total synthetic policy', () => {
    expect(validateObservationPolicy(SYNTHETIC_OBSERVATION)).toEqual([]);
  });

  it('reports every uncovered cell', () => {
    const errors = validateObservationPolicy(withRules(SYNTHETIC_OBSERVATION.rules.slice(0, -1)));
    expect(
      errors.some((error) => error.startsWith('No rule covers LEARNING/FADING/SCORED_CORRECT')),
    ).toBe(true);
  });

  it('forbids model updates in evaluation-only sessions', () => {
    const errors = validateObservationPolicy(withRules(SYNTHETIC_OBSERVATION.rules.slice(1)));
    expect(errors.some((error) => error.includes('evaluation-only purposes'))).toBe(true);
  });

  it('forbids an observation without binary evidence', () => {
    const rules = SYNTHETIC_OBSERVATION.rules.filter((rule) => rule.ruleId !== 'unclassified');
    const errors = validateObservationPolicy(withRules(rules));
    expect(errors.some((error) => error.includes('SCORED_UNCLASSIFIED'))).toBe(true);
  });

  it('allows treating no-response as incorrect but never an invalid attempt', () => {
    const rules: ObservationPolicy['rules'] = [
      SYNTHETIC_OBSERVATION.rules[0] as ObservationPolicy['rules'][number],
      {
        ruleId: 'timeout-incorrect',
        when: { responses: ['NO_RESPONSE', 'TIMEOUT', 'ABANDONED', 'INVALID'] },
        decision: 'OBSERVATION_AS_INCORRECT',
        reasonCode: 'NO_RESPONSE_AS_INCORRECT',
      },
      ...SYNTHETIC_OBSERVATION.rules.slice(2),
    ];
    const errors = validateObservationPolicy(withRules(rules));
    expect(errors.every((error) => error.includes('/INVALID/'))).toBe(true);
    expect(errors.length).toBe(1 * SCAFFOLD_STATES.length * 3);
  });

  it('rejects unreachable rules, duplicates, unknown values and prose reason codes', () => {
    const shadowed = withRules([
      ...SYNTHETIC_OBSERVATION.rules,
      { ruleId: 'never', when: {}, decision: 'NO_MODEL_UPDATE', reasonCode: 'NEVER_USED' },
    ]);
    expect(validateObservationPolicy(shadowed)).toContain('never is unreachable.');
    const duplicate = withRules([
      ...SYNTHETIC_OBSERVATION.rules.slice(0, 1),
      ...SYNTHETIC_OBSERVATION.rules,
    ]);
    expect(validateObservationPolicy(duplicate)).toContain('Rule identifiers are not unique.');
    const unknown = withRules([
      {
        ...(SYNTHETIC_OBSERVATION.rules[0] as ObservationPolicy['rules'][number]),
        when: { purposes: [] },
      },
      ...SYNTHETIC_OBSERVATION.rules.slice(1),
    ]);
    expect(validateObservationPolicy(unknown).length).toBeGreaterThan(0);
    const prose = withRules([
      {
        ...(SYNTHETIC_OBSERVATION.rules[0] as ObservationPolicy['rules'][number]),
        reasonCode: 'because',
      },
      ...SYNTHETIC_OBSERVATION.rules.slice(1),
    ]);
    expect(validateObservationPolicy(prose).length).toBeGreaterThan(0);
  });
});

describe('observation decisions', () => {
  it('turns a scored first attempt in FADING into an observation', () => {
    const decision = decideObservation(evidence(), SYNTHETIC_OBSERVATION);
    expect(decision.instruction).toEqual({
      kind: 'OBSERVATION',
      evidence: 'CORRECT',
      reasonCode: 'SCORED_FIRST_ATTEMPT',
    });
    expect(decision.observationEligible).toBe(true);
    expect(decision.assistanceClass).toBe('ASSISTED_FADING');
  });

  it('applies transition only to guided practice', () => {
    const decision = decideObservation(
      evidence({ issuedCues: { ...evidence().issuedCues, scaffoldState: 'GUIDED' } }),
      SYNTHETIC_OBSERVATION,
    );
    expect(decision.instruction.kind).toBe('TRANSITION_ONLY');
    expect(decision.observationEligible).toBe(false);
  });

  it.each(
    RESPONSE_STATUSES.filter(
      (status) => !status.startsWith('SCORED_C') && status !== 'SCORED_INCORRECT',
    ),
  )('records %s without a model update', (response) => {
    expect(decideObservation(evidence({ response }), SYNTHETIC_OBSERVATION).instruction.kind).toBe(
      'NO_MODEL_UPDATE',
    );
  });

  it.each(['PRE_TEST', 'POST_TEST', 'RECALL'] as const)(
    'isolates %s sessions from the model',
    (purpose) => {
      const decision = decideObservation(evidence({ purpose }), SYNTHETIC_OBSERVATION);
      expect(decision.instruction).toEqual({
        kind: 'NO_MODEL_UPDATE',
        reasonCode: 'EVALUATION_SESSION_ISOLATED',
      });
    },
  );

  it('does not let client telemetry or accommodations change the assistance class', () => {
    const guided = { ...evidence().issuedCues, scaffoldState: 'GUIDED' as const };
    const claimed = decideObservation(
      evidence({
        issuedCues: guided,
        clientTelemetry: { renderedCueIds: [], claimsCuesHidden: true },
        accommodations: ['SCREEN_READER_STAR_LIST'],
      }),
      SYNTHETIC_OBSERVATION,
    );
    const plain = decideObservation(evidence({ issuedCues: guided }), SYNTHETIC_OBSERVATION);
    expect(claimed.assistanceClass).toBe('ASSISTED');
    expect(claimed).toEqual(plain);
  });

  it('never treats a retry as first-attempt evidence', () => {
    const decision = decideObservation(
      evidence({ attemptKind: 'RETRY_AFTER_FEEDBACK' }),
      SYNTHETIC_OBSERVATION,
    );
    expect(decision.instruction.reasonCode).toBe('RETRY_NOT_INDEPENDENT_EVIDENCE');
  });
});

describe('independent confirmation (BKT-003 input)', () => {
  const entry = (
    scaffoldStateAtIssue: EvidenceHistoryEntry['scaffoldStateAtIssue'],
    response: EvidenceHistoryEntry['response'],
    change: Partial<EvidenceHistoryEntry> = {},
  ): EvidenceHistoryEntry => ({
    purpose: 'LEARNING',
    scaffoldStateAtIssue,
    attemptKind: 'FIRST_ATTEMPT',
    response,
    ...change,
  });

  it('counts trailing independent first-attempt successes only', () => {
    const history = [
      entry('INDEPENDENT', 'SCORED_INCORRECT'),
      entry('INDEPENDENT', 'SCORED_CORRECT'),
      entry('GUIDED', 'SCORED_INCORRECT'),
      entry('INDEPENDENT', 'SCORED_CORRECT'),
      entry('INDEPENDENT', 'SCORED_CORRECT', { attemptKind: 'RETRY_AFTER_FEEDBACK' }),
      entry('INDEPENDENT', 'SCORED_CORRECT', { purpose: 'POST_TEST' }),
    ];
    expect(independentConfirmationStatus(history, SYNTHETIC_CONFIRMATION)).toMatchObject({
      status: 'INDEPENDENTLY_CONFIRMED',
      trailingIndependentCorrect: 2,
    });
    expect(
      independentConfirmationStatus(
        [...history, entry('INDEPENDENT', 'SCORED_INCORRECT')],
        SYNTHETIC_CONFIRMATION,
      ),
    ).toMatchObject({ status: 'NOT_INDEPENDENTLY_CONFIRMED', trailingIndependentCorrect: 0 });
  });

  it('is unresolved without a policy and validates the policy', () => {
    expect(independentConfirmationStatus([], null)).toEqual({
      status: 'CONFIRMATION_POLICY_UNRESOLVED',
    });
    expect(validateIndependentConfirmationPolicy(SYNTHETIC_CONFIRMATION)).toEqual([]);
    expect(
      validateIndependentConfirmationPolicy({
        ...SYNTHETIC_CONFIRMATION,
        requiredConsecutiveIndependentCorrect: 0,
      }),
    ).not.toEqual([]);
  });
});
