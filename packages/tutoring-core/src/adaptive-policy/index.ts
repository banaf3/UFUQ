/**
 * Adaptive scaffold policy and cue issuance (DEV-004, DEV-007, BKT-004). A versioned
 * policy returns a next state and a reason code; a versioned cue configuration says which
 * cues the server issues for a knowledge component in each state. Both are configuration:
 * this module only enforces the specification's semantic intent.
 *
 * - The decision input has no client-requested state and no "slip rate": a state never
 *   changes because a client asks or because the fixed S parameter is high (DEV-007).
 * - GUIDED may move only to FADING; FADING to GUIDED or INDEPENDENT; INDEPENDENT may
 *   restore support (FADING or GUIDED).
 * - FADING issues no direct target reveal; INDEPENDENT issues no instructional cue.
 * - Evaluation-only purposes never change scaffolding (BKT-005).
 */
import {
  CONFIGURATION_STATUSES,
  type ConfigurationStatus,
  isEvaluationPurpose,
  isNonEmptyIdentifier,
  isProbability,
  KNOWLEDGE_COMPONENT_IDS,
  type KnowledgeComponentId,
  REASON_CODE_PATTERN,
  SCAFFOLD_STATES,
  type ScaffoldState,
  type SessionPurpose,
} from '../vocabulary.js';

export const ALLOWED_SCAFFOLD_TRANSITIONS: readonly (readonly [ScaffoldState, ScaffoldState])[] = [
  ['GUIDED', 'FADING'],
  ['FADING', 'GUIDED'],
  ['FADING', 'INDEPENDENT'],
  ['INDEPENDENT', 'FADING'],
  ['INDEPENDENT', 'GUIDED'],
];

export type ScaffoldCondition =
  /** Mastery after this attempt's model decision is at least `value` (inclusive). */
  | { readonly kind: 'MASTERY_AT_LEAST'; readonly value: number }
  /** Mastery after this attempt's model decision is below `value` (exclusive). */
  | { readonly kind: 'MASTERY_BELOW'; readonly value: number }
  /**
   * The newest window entries form a run of at least `count` first-attempt, scored-correct
   * responses issued in one of `scaffoldStates`; any other entry ends the run.
   */
  | {
      readonly kind: 'TRAILING_FIRST_ATTEMPT_CORRECT_AT_LEAST';
      readonly count: number;
      readonly scaffoldStates: readonly ScaffoldState[];
    }
  /** At least `count` scored-incorrect responses inside the history window. */
  | { readonly kind: 'INCORRECT_IN_WINDOW_AT_LEAST'; readonly count: number };

export interface ScaffoldRule {
  readonly ruleId: string;
  readonly from: ScaffoldState;
  readonly to: ScaffoldState;
  /** Every condition must hold (inclusive boundaries are stated by the condition kind). */
  readonly conditions: readonly ScaffoldCondition[];
  readonly reasonCode: string;
}

export interface ScaffoldPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly status: ConfigurationStatus;
  readonly initialState: ScaffoldState;
  /** Number of most recent LEARNING attempts the conditions may read. */
  readonly historyWindow: number;
  /** Ordered; the first rule from the current state whose conditions all hold applies. */
  readonly rules: readonly ScaffoldRule[];
  readonly unchangedReasonCodes: Readonly<Record<ScaffoldState, string>>;
}

export interface ScaffoldHistoryEntry {
  readonly purpose: SessionPurpose;
  readonly scaffoldStateAtIssue: ScaffoldState;
  readonly attemptKind: 'FIRST_ATTEMPT' | 'RETRY_AFTER_FEEDBACK' | 'RETRY_AFTER_REVEAL';
  readonly response: string;
}

export interface ScaffoldDecisionInput {
  readonly purpose: SessionPurpose;
  readonly currentState: ScaffoldState;
  /** Mastery after this attempt's model decision. */
  readonly masteryProbability: number;
  /** Oldest first, including the attempt being decided. */
  readonly history: readonly ScaffoldHistoryEntry[];
}

export interface ScaffoldDecision {
  readonly kind: 'SCAFFOLD_TRANSITION' | 'SCAFFOLD_UNCHANGED';
  readonly fromState: ScaffoldState;
  readonly toState: ScaffoldState;
  readonly ruleId: string | null;
  readonly reasonCode: string;
  readonly policyId: string;
  readonly policyVersion: string;
}

export const EVALUATION_SESSION_ISOLATED = 'EVALUATION_SESSION_ISOLATED';

function holds(
  condition: ScaffoldCondition,
  mastery: number,
  window: readonly ScaffoldHistoryEntry[],
): boolean {
  switch (condition.kind) {
    case 'MASTERY_AT_LEAST':
      return mastery >= condition.value;
    case 'MASTERY_BELOW':
      return mastery < condition.value;
    case 'INCORRECT_IN_WINDOW_AT_LEAST':
      return (
        window.filter((entry) => entry.response === 'SCORED_INCORRECT').length >= condition.count
      );
    case 'TRAILING_FIRST_ATTEMPT_CORRECT_AT_LEAST': {
      let run = 0;
      for (let index = window.length - 1; index >= 0; index -= 1) {
        const entry = window[index] as ScaffoldHistoryEntry;
        const qualifies =
          entry.response === 'SCORED_CORRECT' &&
          entry.attemptKind === 'FIRST_ATTEMPT' &&
          condition.scaffoldStates.includes(entry.scaffoldStateAtIssue);
        if (!qualifies) break;
        run += 1;
      }
      return run >= condition.count;
    }
  }
}

export function decideScaffold(
  input: ScaffoldDecisionInput,
  policy: ScaffoldPolicy,
): ScaffoldDecision {
  const base = {
    fromState: input.currentState,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
  };
  if (isEvaluationPurpose(input.purpose)) {
    return {
      ...base,
      kind: 'SCAFFOLD_UNCHANGED',
      toState: input.currentState,
      ruleId: null,
      reasonCode: EVALUATION_SESSION_ISOLATED,
    };
  }
  const window = input.history
    .filter((entry) => entry.purpose === 'LEARNING')
    .slice(-policy.historyWindow);
  for (const rule of policy.rules) {
    if (rule.from !== input.currentState) continue;
    if (rule.conditions.every((condition) => holds(condition, input.masteryProbability, window))) {
      return {
        ...base,
        kind: 'SCAFFOLD_TRANSITION',
        toState: rule.to,
        ruleId: rule.ruleId,
        reasonCode: rule.reasonCode,
      };
    }
  }
  return {
    ...base,
    kind: 'SCAFFOLD_UNCHANGED',
    toState: input.currentState,
    ruleId: null,
    reasonCode: policy.unchangedReasonCodes[input.currentState],
  };
}

export function validateScaffoldPolicy(policy: ScaffoldPolicy): string[] {
  const errors: string[] = [];
  if (!isNonEmptyIdentifier(policy.policyId)) errors.push('policyId is invalid.');
  if (!isNonEmptyIdentifier(policy.policyVersion)) errors.push('policyVersion is invalid.');
  if (!CONFIGURATION_STATUSES.includes(policy.status)) errors.push('status is unknown.');
  if (!SCAFFOLD_STATES.includes(policy.initialState)) errors.push('initialState is unknown.');
  if (
    !Number.isInteger(policy.historyWindow) ||
    policy.historyWindow < 1 ||
    policy.historyWindow > 100
  )
    errors.push('historyWindow must be an integer in [1, 100].');
  const ids = policy.rules.map((rule) => rule.ruleId);
  if (new Set(ids).size !== ids.length) errors.push('Rule identifiers are not unique.');
  for (const state of SCAFFOLD_STATES) {
    const code = policy.unchangedReasonCodes[state];
    if (typeof code !== 'string' || !REASON_CODE_PATTERN.test(code))
      errors.push(`unchangedReasonCodes.${state} must be an upper-case identifier.`);
  }
  for (const rule of policy.rules) {
    if (!isNonEmptyIdentifier(rule.ruleId)) errors.push('A rule identifier is invalid.');
    if (!REASON_CODE_PATTERN.test(rule.reasonCode))
      errors.push(`${rule.ruleId}: reason code is not an upper-case identifier.`);
    if (!ALLOWED_SCAFFOLD_TRANSITIONS.some(([from, to]) => from === rule.from && to === rule.to))
      errors.push(`${rule.ruleId}: ${rule.from} -> ${rule.to} is not an allowed transition.`);
    if (rule.conditions.length === 0)
      errors.push(`${rule.ruleId}: a transition needs at least one evidence condition.`);
    for (const condition of rule.conditions) {
      if (condition.kind === 'MASTERY_AT_LEAST' || condition.kind === 'MASTERY_BELOW') {
        if (!isProbability(condition.value))
          errors.push(`${rule.ruleId}: ${condition.kind} value must be in [0, 1].`);
      } else if (
        condition.kind === 'TRAILING_FIRST_ATTEMPT_CORRECT_AT_LEAST' ||
        condition.kind === 'INCORRECT_IN_WINDOW_AT_LEAST'
      ) {
        if (
          !Number.isInteger(condition.count) ||
          condition.count < 1 ||
          condition.count > policy.historyWindow
        )
          errors.push(`${rule.ruleId}: ${condition.kind} count must be in [1, historyWindow].`);
        if (
          condition.kind === 'TRAILING_FIRST_ATTEMPT_CORRECT_AT_LEAST' &&
          (condition.scaffoldStates.length === 0 ||
            !condition.scaffoldStates.every((state) => SCAFFOLD_STATES.includes(state)))
        )
          errors.push(`${rule.ruleId}: scaffoldStates must name known states.`);
      } else {
        errors.push(`${rule.ruleId}: unknown condition kind.`);
      }
    }
  }
  return errors;
}

/**
 * Cue vocabulary the scene adapter can render. Each cue has one fixed classification; the
 * configuration decides which are issued, never what a cue means.
 */
export const CUE_CLASSIFICATION = {
  /** Marks the task's own answer pattern or star. */
  TARGET_OUTLINE: 'DIRECT_TARGET_REVEAL',
  /** The pattern's reviewed shape description as text. */
  SHAPE_HINT_TEXT: 'ORIENTATION',
  /** Outlines the source pattern of the step's guidance relationship. */
  SOURCE_PATTERN_OUTLINE: 'ORIENTATION',
  /** Draws the step's guide all the way to its target star or horizon point. */
  GUIDE_LINE_FULL: 'DIRECT_TARGET_REVEAL',
  /** Draws only the first half of the step's guide arc. */
  GUIDE_LINE_PARTIAL: 'ORIENTATION',
  /** Labels the star the step's guidance starts from. */
  SOURCE_STAR_LABEL: 'ORIENTATION',
} as const;
export type CueId = keyof typeof CUE_CLASSIFICATION;
export const CUE_IDS = Object.keys(CUE_CLASSIFICATION) as CueId[];

export function isCueId(value: unknown): value is CueId {
  return typeof value === 'string' && (CUE_IDS as string[]).includes(value);
}

export type CueConfiguration =
  | {
      readonly kind: 'ADAPTIVE';
      readonly configurationId: string;
      readonly configurationVersion: string;
      readonly status: ConfigurationStatus;
      readonly cues: Readonly<
        Record<KnowledgeComponentId, Readonly<Record<ScaffoldState, readonly CueId[]>>>
      >;
    }
  | {
      /** One fixed presentation without scaffold states (no adaptive policy is approved). */
      readonly kind: 'NON_ADAPTIVE_FIXED';
      readonly configurationId: string;
      readonly configurationVersion: string;
      readonly status: ConfigurationStatus;
      readonly cues: Readonly<Record<KnowledgeComponentId, readonly CueId[]>>;
    };

export function validateCueConfiguration(configuration: CueConfiguration): string[] {
  const errors: string[] = [];
  if (!isNonEmptyIdentifier(configuration.configurationId))
    errors.push('configurationId is invalid.');
  if (!isNonEmptyIdentifier(configuration.configurationVersion))
    errors.push('configurationVersion is invalid.');
  if (!CONFIGURATION_STATUSES.includes(configuration.status)) errors.push('status is unknown.');
  const checkList = (label: string, cues: readonly unknown[] | undefined) => {
    if (!Array.isArray(cues)) {
      errors.push(`${label} is missing.`);
      return;
    }
    if (!cues.every(isCueId)) errors.push(`${label} names an unknown cue.`);
    if (new Set(cues).size !== cues.length) errors.push(`${label} repeats a cue.`);
  };
  for (const kc of KNOWLEDGE_COMPONENT_IDS) {
    if (configuration.kind === 'NON_ADAPTIVE_FIXED') {
      checkList(kc, configuration.cues[kc]);
      continue;
    }
    const byState = configuration.cues[kc];
    if (!byState) {
      errors.push(`${kc} has no cue table.`);
      continue;
    }
    for (const state of SCAFFOLD_STATES) checkList(`${kc}/${state}`, byState[state]);
    if (byState.FADING?.some((cue) => CUE_CLASSIFICATION[cue] === 'DIRECT_TARGET_REVEAL'))
      errors.push(`${kc}/FADING issues a direct target reveal.`);
    if ((byState.INDEPENDENT?.length ?? 0) > 0)
      errors.push(`${kc}/INDEPENDENT issues an instructional cue.`);
  }
  return errors;
}

/** The cues configured for a KC in a state; null state for a non-adaptive configuration. */
export function configuredCues(
  configuration: CueConfiguration,
  knowledgeComponentId: KnowledgeComponentId,
  state: ScaffoldState | null,
): readonly CueId[] {
  if (configuration.kind === 'NON_ADAPTIVE_FIXED') return configuration.cues[knowledgeComponentId];
  if (state === null) throw new RangeError('An adaptive configuration needs a scaffold state.');
  return configuration.cues[knowledgeComponentId][state];
}
