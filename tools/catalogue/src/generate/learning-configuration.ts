/**
 * Learning-configuration artifacts (Phase 3): the reviewed ScientificProfileV1 record from
 * curation, and a visibly synthetic adaptive configuration for software tests. Both are
 * validated with the pure tutoring-core validators before they are written.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  KNOWLEDGE_COMPONENTS,
  type LearningConfigurationPayload,
  validateLearningConfiguration,
} from '@ufuq/tutoring-core';

import {
  type ApprovalRecord,
  type ArtifactEnvelope,
  canonicalJson,
  envelope,
  sha256Hex,
} from '../canonical-json.js';
import { loadApproval } from './profile-v1-data.js';

function checked(payload: LearningConfigurationPayload, label: string) {
  const errors = validateLearningConfiguration(payload);
  if (errors.length > 0) throw new Error(`${label} is invalid:\n${errors.join('\n')}`);
  return payload;
}

export function generateLearningConfiguration(
  root: string,
): ArtifactEnvelope<LearningConfigurationPayload> {
  const curation = JSON.parse(
    readFileSync(join(root, 'data/curation/tutoring/learning-configuration.v1.json'), 'utf8'),
  ) as { configuration: LearningConfigurationPayload };
  const payload = checked(curation.configuration, 'Learning configuration');
  if (payload.configurationScope !== 'SCIENTIFIC_PROFILE_V1')
    throw new Error('The real learning configuration must be SCIENTIFIC_PROFILE_V1 scoped.');
  const { approval } = loadApproval(
    root,
    'learning-configuration-v1',
    sha256Hex(canonicalJson(payload)),
  );
  return envelope(
    'UFUQ_LEARNING_CONFIGURATION',
    'learning-configuration-v1',
    '1',
    payload,
    approval,
  );
}

const SYNTHETIC = 'SYNTHETIC_TECHNICAL_FIXTURE' as const;

const patternCues = {
  GUIDED: ['TARGET_OUTLINE', 'SHAPE_HINT_TEXT'],
  FADING: ['SHAPE_HINT_TEXT'],
  INDEPENDENT: [],
} as const;

/**
 * Synthetic adaptive configuration. The parameter set is the report's reproducible
 * example; every policy value is an invented technical fixture chosen to exercise each
 * decision kind and transition in tests. None is a proposed learning policy.
 */
export function generateSyntheticLearningConfiguration(
  approval: ApprovalRecord,
): ArtifactEnvelope<LearningConfigurationPayload> {
  const payload: LearningConfigurationPayload = {
    configurationVersion: 'synthetic-1',
    configurationScope: SYNTHETIC,
    knowledgeComponents: KNOWLEDGE_COMPONENTS,
    bktParameters: {
      parameterSetId: 'report-example-bkt',
      parameterSetVersion: '1',
      status: 'REPORT_EXAMPLE_NOT_CALIBRATED',
      initialMastery: 0.2,
      learn: 0.1,
      guess: 0.2,
      slip: 0.1,
    },
    masteryThreshold: {
      policyId: 'synthetic-mastery-threshold',
      policyVersion: '1',
      status: SYNTHETIC,
      threshold: 0.85,
      comparison: 'AT_OR_ABOVE',
    },
    independentConfirmation: {
      policyId: 'synthetic-independent-confirmation',
      policyVersion: '1',
      status: SYNTHETIC,
      requiredConsecutiveIndependentCorrect: 2,
    },
    observationPolicy: {
      policyId: 'synthetic-observation-policy',
      policyVersion: '1',
      status: SYNTHETIC,
      rules: [
        {
          ruleId: 'synthetic-evaluation-isolated',
          when: { purposes: ['PRE_TEST', 'POST_TEST', 'RECALL'] },
          decision: 'NO_MODEL_UPDATE',
          reasonCode: 'EVALUATION_SESSION_ISOLATED',
        },
        {
          ruleId: 'synthetic-not-scorable',
          when: { responses: ['NO_RESPONSE', 'TIMEOUT', 'ABANDONED', 'INVALID'] },
          decision: 'NO_MODEL_UPDATE',
          reasonCode: 'NO_SCORABLE_RESPONSE',
        },
        {
          ruleId: 'synthetic-unclassified',
          when: { responses: ['SCORED_UNCLASSIFIED'] },
          decision: 'NO_MODEL_UPDATE',
          reasonCode: 'NO_BINARY_EVIDENCE',
        },
        {
          ruleId: 'synthetic-retry',
          when: { attemptKinds: ['RETRY_AFTER_FEEDBACK', 'RETRY_AFTER_REVEAL'] },
          decision: 'NO_MODEL_UPDATE',
          reasonCode: 'RETRY_NOT_INDEPENDENT_EVIDENCE',
        },
        {
          ruleId: 'synthetic-guided-transition-only',
          when: { scaffoldStates: ['GUIDED'] },
          decision: 'TRANSITION_ONLY',
          reasonCode: 'GUIDED_PRACTICE_TRANSITION_ONLY',
        },
        {
          ruleId: 'synthetic-scored-first-attempt',
          when: {},
          decision: 'OBSERVATION_FROM_SCORE',
          reasonCode: 'SCORED_FIRST_ATTEMPT',
        },
      ],
    },
    scaffoldPolicy: {
      policyId: 'synthetic-scaffold-policy',
      policyVersion: '1',
      status: SYNTHETIC,
      initialState: 'GUIDED',
      historyWindow: 3,
      rules: [
        {
          ruleId: 'synthetic-guided-to-fading',
          from: 'GUIDED',
          to: 'FADING',
          conditions: [
            {
              kind: 'TRAILING_FIRST_ATTEMPT_CORRECT_AT_LEAST',
              count: 1,
              scaffoldStates: ['GUIDED'],
            },
          ],
          reasonCode: 'FADE_AFTER_GUIDED_SUCCESS',
        },
        {
          ruleId: 'synthetic-fading-to-guided',
          from: 'FADING',
          to: 'GUIDED',
          conditions: [{ kind: 'INCORRECT_IN_WINDOW_AT_LEAST', count: 2 }],
          reasonCode: 'RESTORE_GUIDANCE_AFTER_STRUGGLE',
        },
        {
          ruleId: 'synthetic-fading-to-independent',
          from: 'FADING',
          to: 'INDEPENDENT',
          conditions: [
            {
              kind: 'TRAILING_FIRST_ATTEMPT_CORRECT_AT_LEAST',
              count: 2,
              scaffoldStates: ['FADING'],
            },
            { kind: 'MASTERY_AT_LEAST', value: 0.85 },
          ],
          reasonCode: 'INDEPENDENT_AFTER_FADING_SUCCESS',
        },
        {
          ruleId: 'synthetic-independent-to-guided',
          from: 'INDEPENDENT',
          to: 'GUIDED',
          conditions: [{ kind: 'INCORRECT_IN_WINDOW_AT_LEAST', count: 2 }],
          reasonCode: 'RESTORE_FULL_GUIDANCE_AFTER_STRUGGLE',
        },
        {
          ruleId: 'synthetic-independent-to-fading',
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
    },
    cueConfiguration: {
      kind: 'ADAPTIVE',
      configurationId: 'synthetic-cue-configuration',
      configurationVersion: '1',
      status: SYNTHETIC,
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
    },
    unresolved: [],
  };
  return envelope(
    'UFUQ_LEARNING_CONFIGURATION',
    'synthetic-learning-configuration-v1',
    '1',
    checked(payload, 'Synthetic learning configuration'),
    approval,
  );
}
