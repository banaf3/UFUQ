import { describe, expect, it } from 'vitest';

import {
  configuredCues,
  type CueConfiguration,
  decideScaffold,
  type ScaffoldHistoryEntry,
  type ScaffoldPolicy,
  type ScaffoldState,
  validateCueConfiguration,
  validateScaffoldPolicy,
} from '../src/index.js';
import { SYNTHETIC_CUES, SYNTHETIC_SCAFFOLD } from './fixtures.js';

const entry = (
  scaffoldStateAtIssue: ScaffoldState,
  response: 'SCORED_CORRECT' | 'SCORED_INCORRECT' | 'SCORED_UNCLASSIFIED',
  change: Partial<ScaffoldHistoryEntry> = {},
): ScaffoldHistoryEntry => ({
  purpose: 'LEARNING',
  scaffoldStateAtIssue,
  attemptKind: 'FIRST_ATTEMPT',
  response,
  ...change,
});

const decide = (
  currentState: ScaffoldState,
  history: ScaffoldHistoryEntry[],
  masteryProbability = 0.5,
  purpose: ScaffoldHistoryEntry['purpose'] = 'LEARNING',
) => decideScaffold({ purpose, currentState, masteryProbability, history }, SYNTHETIC_SCAFFOLD);

describe('scaffold transitions: one fixture per state, reason and rule', () => {
  it('GUIDED -> FADING after the guided evidence rule', () => {
    expect(decide('GUIDED', [entry('GUIDED', 'SCORED_CORRECT')])).toMatchObject({
      kind: 'SCAFFOLD_TRANSITION',
      toState: 'FADING',
      ruleId: 'guided-to-fading',
      reasonCode: 'FADE_AFTER_GUIDED_SUCCESS',
    });
  });

  it('GUIDED stays when the rule is not met', () => {
    expect(decide('GUIDED', [entry('GUIDED', 'SCORED_INCORRECT')])).toMatchObject({
      kind: 'SCAFFOLD_UNCHANGED',
      toState: 'GUIDED',
      ruleId: null,
      reasonCode: 'GUIDED_RULE_NOT_MET',
    });
  });

  it('FADING -> INDEPENDENT needs both the run and the mastery boundary (inclusive)', () => {
    const run = [
      entry('GUIDED', 'SCORED_CORRECT'),
      entry('FADING', 'SCORED_CORRECT'),
      entry('FADING', 'SCORED_CORRECT'),
    ];
    expect(decide('FADING', run, 0.85)).toMatchObject({
      toState: 'INDEPENDENT',
      reasonCode: 'INDEPENDENT_AFTER_FADING_SUCCESS',
    });
    expect(decide('FADING', run, 0.8499999999)).toMatchObject({
      kind: 'SCAFFOLD_UNCHANGED',
      reasonCode: 'FADING_RULE_NOT_MET',
    });
    expect(decide('FADING', run.slice(0, 2), 0.95).kind).toBe('SCAFFOLD_UNCHANGED');
  });

  it('FADING -> GUIDED after struggle in the window', () => {
    expect(
      decide('FADING', [entry('FADING', 'SCORED_INCORRECT'), entry('FADING', 'SCORED_INCORRECT')]),
    ).toMatchObject({ toState: 'GUIDED', reasonCode: 'RESTORE_GUIDANCE_AFTER_STRUGGLE' });
  });

  it('INDEPENDENT -> GUIDED before INDEPENDENT -> FADING (rule order)', () => {
    expect(
      decide('INDEPENDENT', [
        entry('INDEPENDENT', 'SCORED_INCORRECT'),
        entry('INDEPENDENT', 'SCORED_INCORRECT'),
      ]),
    ).toMatchObject({ toState: 'GUIDED', ruleId: 'independent-to-guided' });
    expect(decide('INDEPENDENT', [entry('INDEPENDENT', 'SCORED_INCORRECT')])).toMatchObject({
      toState: 'FADING',
      reasonCode: 'RESTORE_PARTIAL_GUIDANCE_AFTER_ERROR',
    });
  });

  it('INDEPENDENT stays without struggle', () => {
    expect(decide('INDEPENDENT', [entry('INDEPENDENT', 'SCORED_CORRECT')])).toMatchObject({
      kind: 'SCAFFOLD_UNCHANGED',
      reasonCode: 'INDEPENDENT_NO_STRUGGLE',
    });
  });

  it('reads only the most recent LEARNING attempts inside the window', () => {
    const old = [entry('FADING', 'SCORED_INCORRECT'), entry('FADING', 'SCORED_INCORRECT')];
    const recent = [
      entry('FADING', 'SCORED_CORRECT'),
      entry('FADING', 'SCORED_CORRECT'),
      entry('FADING', 'SCORED_UNCLASSIFIED'),
    ];
    expect(decide('FADING', [...old, ...recent]).kind).toBe('SCAFFOLD_UNCHANGED');
    const evaluation = [
      entry('FADING', 'SCORED_INCORRECT', { purpose: 'POST_TEST' }),
      entry('FADING', 'SCORED_INCORRECT', { purpose: 'RECALL' }),
    ];
    expect(decide('FADING', evaluation).kind).toBe('SCAFFOLD_UNCHANGED');
  });

  it('a retry breaks the first-attempt run', () => {
    expect(
      decide('GUIDED', [entry('GUIDED', 'SCORED_CORRECT', { attemptKind: 'RETRY_AFTER_FEEDBACK' })])
        .kind,
    ).toBe('SCAFFOLD_UNCHANGED');
  });

  it('never changes scaffolding in an evaluation-only session', () => {
    expect(decide('GUIDED', [entry('GUIDED', 'SCORED_CORRECT')], 0.99, 'POST_TEST')).toMatchObject({
      kind: 'SCAFFOLD_UNCHANGED',
      reasonCode: 'EVALUATION_SESSION_ISOLATED',
    });
  });

  it('ignores any client-requested state smuggled into the input', () => {
    const input = {
      purpose: 'LEARNING' as const,
      currentState: 'GUIDED' as const,
      masteryProbability: 0.99,
      history: [],
      requestedState: 'INDEPENDENT',
    };
    expect(decideScaffold(input, SYNTHETIC_SCAFFOLD).toState).toBe('GUIDED');
  });
});

describe('scaffold policy validation (BKT-004 shape)', () => {
  const change = (patch: Partial<ScaffoldPolicy>) =>
    validateScaffoldPolicy({ ...SYNTHETIC_SCAFFOLD, ...patch });

  it('accepts the synthetic policy', () => {
    expect(validateScaffoldPolicy(SYNTHETIC_SCAFFOLD)).toEqual([]);
  });

  it('rejects GUIDED -> INDEPENDENT and self transitions', () => {
    const rule = SYNTHETIC_SCAFFOLD.rules[0] as ScaffoldPolicy['rules'][number];
    expect(change({ rules: [{ ...rule, to: 'INDEPENDENT' }] })).toContain(
      'guided-to-fading: GUIDED -> INDEPENDENT is not an allowed transition.',
    );
    expect(change({ rules: [{ ...rule, to: 'GUIDED' }] }).length).toBeGreaterThan(0);
  });

  it('rejects transitions without evidence, oversized counts and bad codes', () => {
    const rule = SYNTHETIC_SCAFFOLD.rules[1] as ScaffoldPolicy['rules'][number];
    expect(change({ rules: [{ ...rule, conditions: [] }] }).length).toBeGreaterThan(0);
    expect(
      change({
        rules: [{ ...rule, conditions: [{ kind: 'INCORRECT_IN_WINDOW_AT_LEAST', count: 4 }] }],
      }).length,
    ).toBeGreaterThan(0);
    expect(change({ historyWindow: 0 }).length).toBeGreaterThan(0);
    expect(
      change({
        unchangedReasonCodes: { ...SYNTHETIC_SCAFFOLD.unchangedReasonCodes, FADING: 'stay' },
      }).length,
    ).toBeGreaterThan(0);
  });
});

describe('cue configuration (BKT-004 shape)', () => {
  it('accepts the synthetic adaptive configuration and resolves cues per state', () => {
    expect(validateCueConfiguration(SYNTHETIC_CUES)).toEqual([]);
    expect(configuredCues(SYNTHETIC_CUES, 'KC-03', 'FADING')).toEqual([
      'SOURCE_PATTERN_OUTLINE',
      'GUIDE_LINE_PARTIAL',
    ]);
    expect(configuredCues(SYNTHETIC_CUES, 'KC-03', 'INDEPENDENT')).toEqual([]);
    expect(() => configuredCues(SYNTHETIC_CUES, 'KC-03', null)).toThrow();
  });

  it('forbids a direct target reveal while fading and any cue when independent', () => {
    if (SYNTHETIC_CUES.kind !== 'ADAPTIVE') throw new Error('fixture');
    const revealing: CueConfiguration = {
      ...SYNTHETIC_CUES,
      cues: {
        ...SYNTHETIC_CUES.cues,
        'KC-03': { GUIDED: [], FADING: ['GUIDE_LINE_FULL'], INDEPENDENT: ['SHAPE_HINT_TEXT'] },
      },
    };
    expect(validateCueConfiguration(revealing)).toEqual([
      'KC-03/FADING issues a direct target reveal.',
      'KC-03/INDEPENDENT issues an instructional cue.',
    ]);
  });

  it('rejects unknown and repeated cues', () => {
    const fixed: CueConfiguration = {
      kind: 'NON_ADAPTIVE_FIXED',
      configurationId: 'fixed',
      configurationVersion: '1',
      status: 'REVIEW_REQUIRED',
      cues: {
        'KC-01': ['HINT_EVERYTHING' as never],
        'KC-02': ['TARGET_OUTLINE', 'TARGET_OUTLINE'],
        'KC-03': [],
        'KC-04': [],
        'KC-05': [],
      },
    };
    expect(validateCueConfiguration(fixed)).toEqual([
      'KC-01 names an unknown cue.',
      'KC-02 repeats a cue.',
    ]);
  });
});
