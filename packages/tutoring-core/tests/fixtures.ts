/**
 * Test fixtures. The parameter values are the report's reproducible examples
 * (TUTORING_BKT_SPEC.md), not calibration; every policy here is a visibly synthetic
 * technical fixture used to exercise code paths, never a proposed learning policy.
 */
import type {
  BktParameterSet,
  CueConfiguration,
  IndependentConfirmationPolicy,
  LearningConfigurationPayload,
  MasteryThresholdPolicy,
  ObservationPolicy,
  ScaffoldPolicy,
} from '../src/index.js';
import { KNOWLEDGE_COMPONENTS } from '../src/index.js';

export const REPORT_EXAMPLE: BktParameterSet = {
  parameterSetId: 'report-example-bkt',
  parameterSetVersion: '1',
  status: 'REPORT_EXAMPLE_NOT_CALIBRATED',
  initialMastery: 0.2,
  learn: 0.1,
  guess: 0.2,
  slip: 0.1,
};

export const SYNTHETIC_THRESHOLD: MasteryThresholdPolicy = {
  policyId: 'synthetic-threshold',
  policyVersion: '1',
  status: 'SYNTHETIC_TECHNICAL_FIXTURE',
  threshold: 0.85,
  comparison: 'AT_OR_ABOVE',
};

export const SYNTHETIC_CONFIRMATION: IndependentConfirmationPolicy = {
  policyId: 'synthetic-confirmation',
  policyVersion: '1',
  status: 'SYNTHETIC_TECHNICAL_FIXTURE',
  requiredConsecutiveIndependentCorrect: 2,
};

export const SYNTHETIC_OBSERVATION: ObservationPolicy = {
  policyId: 'synthetic-observation',
  policyVersion: '1',
  status: 'SYNTHETIC_TECHNICAL_FIXTURE',
  rules: [
    {
      ruleId: 'evaluation',
      when: { purposes: ['PRE_TEST', 'POST_TEST', 'RECALL'] },
      decision: 'NO_MODEL_UPDATE',
      reasonCode: 'EVALUATION_SESSION_ISOLATED',
    },
    {
      ruleId: 'not-scorable',
      when: { responses: ['NO_RESPONSE', 'TIMEOUT', 'ABANDONED', 'INVALID'] },
      decision: 'NO_MODEL_UPDATE',
      reasonCode: 'NO_SCORABLE_RESPONSE',
    },
    {
      ruleId: 'unclassified',
      when: { responses: ['SCORED_UNCLASSIFIED'] },
      decision: 'NO_MODEL_UPDATE',
      reasonCode: 'NO_BINARY_EVIDENCE',
    },
    {
      ruleId: 'retry',
      when: { attemptKinds: ['RETRY_AFTER_FEEDBACK', 'RETRY_AFTER_REVEAL'] },
      decision: 'NO_MODEL_UPDATE',
      reasonCode: 'RETRY_NOT_INDEPENDENT_EVIDENCE',
    },
    {
      ruleId: 'guided',
      when: { scaffoldStates: ['GUIDED'] },
      decision: 'TRANSITION_ONLY',
      reasonCode: 'GUIDED_PRACTICE_TRANSITION_ONLY',
    },
    {
      ruleId: 'scored-first-attempt',
      when: {},
      decision: 'OBSERVATION_FROM_SCORE',
      reasonCode: 'SCORED_FIRST_ATTEMPT',
    },
  ],
};

export const SYNTHETIC_SCAFFOLD: ScaffoldPolicy = {
  policyId: 'synthetic-scaffold',
  policyVersion: '1',
  status: 'SYNTHETIC_TECHNICAL_FIXTURE',
  initialState: 'GUIDED',
  historyWindow: 3,
  rules: [
    {
      ruleId: 'guided-to-fading',
      from: 'GUIDED',
      to: 'FADING',
      conditions: [
        { kind: 'TRAILING_FIRST_ATTEMPT_CORRECT_AT_LEAST', count: 1, scaffoldStates: ['GUIDED'] },
      ],
      reasonCode: 'FADE_AFTER_GUIDED_SUCCESS',
    },
    {
      ruleId: 'fading-to-guided',
      from: 'FADING',
      to: 'GUIDED',
      conditions: [{ kind: 'INCORRECT_IN_WINDOW_AT_LEAST', count: 2 }],
      reasonCode: 'RESTORE_GUIDANCE_AFTER_STRUGGLE',
    },
    {
      ruleId: 'fading-to-independent',
      from: 'FADING',
      to: 'INDEPENDENT',
      conditions: [
        { kind: 'TRAILING_FIRST_ATTEMPT_CORRECT_AT_LEAST', count: 2, scaffoldStates: ['FADING'] },
        { kind: 'MASTERY_AT_LEAST', value: 0.85 },
      ],
      reasonCode: 'INDEPENDENT_AFTER_FADING_SUCCESS',
    },
    {
      ruleId: 'independent-to-guided',
      from: 'INDEPENDENT',
      to: 'GUIDED',
      conditions: [{ kind: 'INCORRECT_IN_WINDOW_AT_LEAST', count: 2 }],
      reasonCode: 'RESTORE_FULL_GUIDANCE_AFTER_STRUGGLE',
    },
    {
      ruleId: 'independent-to-fading',
      from: 'INDEPENDENT',
      to: 'FADING',
      conditions: [{ kind: 'INCORRECT_IN_WINDOW_AT_LEAST', count: 1 }],
      reasonCode: 'RESTORE_PARTIAL_GUIDANCE_AFTER_ERROR',
    },
  ],
  unchangedReasonCodes: {
    GUIDED: 'GUIDED_RULE_NOT_MET',
    FADING: 'FADING_RULE_NOT_MET',
    INDEPENDENT: 'INDEPENDENT_NO_STRUGGLE',
  },
};

const patternCues = {
  GUIDED: ['TARGET_OUTLINE', 'SHAPE_HINT_TEXT'],
  FADING: ['SHAPE_HINT_TEXT'],
  INDEPENDENT: [],
} as const;

export const SYNTHETIC_CUES: CueConfiguration = {
  kind: 'ADAPTIVE',
  configurationId: 'synthetic-cues',
  configurationVersion: '1',
  status: 'SYNTHETIC_TECHNICAL_FIXTURE',
  cues: {
    'KC-01': patternCues,
    'KC-02': patternCues,
    'KC-03': {
      GUIDED: ['SOURCE_PATTERN_OUTLINE', 'GUIDE_LINE_FULL'],
      FADING: ['SOURCE_PATTERN_OUTLINE', 'GUIDE_LINE_PARTIAL'],
      INDEPENDENT: [],
    },
    'KC-04': {
      GUIDED: ['SOURCE_STAR_LABEL', 'GUIDE_LINE_FULL'],
      FADING: ['SOURCE_STAR_LABEL'],
      INDEPENDENT: [],
    },
    'KC-05': { GUIDED: [], FADING: [], INDEPENDENT: [] },
  },
};

export const SYNTHETIC_CONFIGURATION: LearningConfigurationPayload = {
  configurationVersion: 'test-1',
  configurationScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
  knowledgeComponents: KNOWLEDGE_COMPONENTS,
  bktParameters: REPORT_EXAMPLE,
  masteryThreshold: SYNTHETIC_THRESHOLD,
  independentConfirmation: SYNTHETIC_CONFIRMATION,
  observationPolicy: SYNTHETIC_OBSERVATION,
  scaffoldPolicy: SYNTHETIC_SCAFFOLD,
  cueConfiguration: SYNTHETIC_CUES,
  unresolved: [],
};

export const NON_ADAPTIVE_CONFIGURATION: LearningConfigurationPayload = {
  configurationVersion: 'test-non-adaptive-1',
  configurationScope: 'SCIENTIFIC_PROFILE_V1',
  knowledgeComponents: KNOWLEDGE_COMPONENTS,
  bktParameters: REPORT_EXAMPLE,
  masteryThreshold: null,
  independentConfirmation: null,
  observationPolicy: null,
  scaffoldPolicy: null,
  cueConfiguration: {
    kind: 'NON_ADAPTIVE_FIXED',
    configurationId: 'fixed-cues',
    configurationVersion: '1',
    status: 'REVIEW_REQUIRED',
    cues: {
      'KC-01': [],
      'KC-02': [],
      'KC-03': ['SOURCE_PATTERN_OUTLINE', 'GUIDE_LINE_FULL'],
      'KC-04': ['SOURCE_STAR_LABEL', 'GUIDE_LINE_FULL'],
      'KC-05': [],
    },
  },
  unresolved: [
    { field: 'masteryThreshold', decisionId: 'BKT-003', note: 'test' },
    { field: 'independentConfirmation', decisionId: 'BKT-003', note: 'test' },
    { field: 'observationPolicy', decisionId: 'BKT-001', note: 'test' },
    { field: 'scaffoldPolicy', decisionId: 'BKT-004', note: 'test' },
  ],
};

/** Mulberry32: a small seeded generator so property runs are reproducible (spec item 7). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
