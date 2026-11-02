/**
 * Standard four-parameter binary BKT (IMP-013, TUTORING_BKT_SPEC.md "Equations and update
 * order"): the observation posterior first, then the learning transition exactly once.
 * Parameters are a versioned input; no production value lives here (IMP-014).
 */
import {
  type BinaryEvidence,
  CONFIGURATION_STATUSES,
  type ConfigurationStatus,
  isKnowledgeComponentId,
  isNonEmptyIdentifier,
  isProbability,
  type KnowledgeComponentId,
  type ModelUpdateInstruction,
  REASON_CODE_PATTERN,
} from '../vocabulary.js';

export const STANDARD_BKT_MODEL = {
  modelId: 'STANDARD_BKT_FOUR_PARAMETER',
  modelVersion: '1',
} as const;

export interface BktParameterSet {
  readonly parameterSetId: string;
  readonly parameterSetVersion: string;
  readonly status: ConfigurationStatus;
  /** P(L0): initial mastery probability. */
  readonly initialMastery: number;
  /** P(T): probability of learning between opportunities. */
  readonly learn: number;
  /** P(G): correct response while unmastered. */
  readonly guess: number;
  /** P(S): incorrect response while mastered. */
  readonly slip: number;
}

/**
 * Numerical constraints of the specification: finite values in [0, 1] and 1 - S > G, so a
 * correct answer is more likely when mastered than when unmastered.
 */
export function validateBktParameters(parameters: BktParameterSet): string[] {
  const errors: string[] = [];
  if (!isNonEmptyIdentifier(parameters.parameterSetId)) errors.push('parameterSetId is invalid.');
  if (!isNonEmptyIdentifier(parameters.parameterSetVersion))
    errors.push('parameterSetVersion is invalid.');
  if (!CONFIGURATION_STATUSES.includes(parameters.status)) errors.push('status is unknown.');
  for (const field of ['initialMastery', 'learn', 'guess', 'slip'] as const) {
    if (!isProbability(parameters[field])) errors.push(`${field} must be finite and in [0, 1].`);
  }
  if (errors.length === 0 && !(1 - parameters.slip > parameters.guess)) {
    errors.push('1 - slip must exceed guess (an uninformative or inverted observation model).');
  }
  return errors;
}

/** Identifies the chain a mastery value belongs to; versions never continue silently. */
export interface ModelChain {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly parameterSetId: string;
  readonly parameterSetVersion: string;
}

export function chainOf(parameters: BktParameterSet): ModelChain {
  return {
    modelId: STANDARD_BKT_MODEL.modelId,
    modelVersion: STANDARD_BKT_MODEL.modelVersion,
    parameterSetId: parameters.parameterSetId,
    parameterSetVersion: parameters.parameterSetVersion,
  };
}

function sameChain(a: ModelChain, b: ModelChain): boolean {
  return (
    a.modelId === b.modelId &&
    a.modelVersion === b.modelVersion &&
    a.parameterSetId === b.parameterSetId &&
    a.parameterSetVersion === b.parameterSetVersion
  );
}

export interface MasteryState {
  readonly knowledgeComponentId: KnowledgeComponentId;
  readonly masteryProbability: number;
  /** Monotonic per learner and KC; it advances only when the model value is recomputed. */
  readonly masteryRevision: number;
  readonly chain: ModelChain;
}

export function initialMasteryState(
  knowledgeComponentId: KnowledgeComponentId,
  parameters: BktParameterSet,
): MasteryState {
  return {
    knowledgeComponentId,
    masteryProbability: parameters.initialMastery,
    masteryRevision: 0,
    chain: chainOf(parameters),
  };
}

/**
 * Observation posterior. Returns null when the observation has zero likelihood under the
 * prior (a degenerate denominator), so the caller rejects it instead of dividing by zero.
 */
export function posteriorAfterObservation(
  prior: number,
  evidence: BinaryEvidence,
  parameters: BktParameterSet,
): number | null {
  const { guess, slip } = parameters;
  const masteredLikelihood = evidence === 'CORRECT' ? prior * (1 - slip) : prior * slip;
  const unmasteredLikelihood =
    evidence === 'CORRECT' ? (1 - prior) * guess : (1 - prior) * (1 - guess);
  const denominator = masteredLikelihood + unmasteredLikelihood;
  if (!(denominator > 0)) return null;
  return masteredLikelihood / denominator;
}

/** Learning transition, applied exactly once after the evidence: p + (1 - p)T. */
export function learningTransition(probability: number, parameters: BktParameterSet): number {
  return probability + (1 - probability) * parameters.learn;
}

export type ModelDecisionRecord =
  | {
      readonly kind: 'OBSERVATION';
      readonly knowledgeComponentId: KnowledgeComponentId;
      readonly evidence: BinaryEvidence;
      readonly priorMastery: number;
      readonly posteriorAfterObservation: number;
      readonly nextMasteryAfterTransition: number;
      readonly priorRevision: number;
      readonly nextRevision: number;
      readonly chain: ModelChain;
      readonly reasonCode: string;
    }
  | {
      readonly kind: 'TRANSITION_ONLY';
      readonly knowledgeComponentId: KnowledgeComponentId;
      readonly priorMastery: number;
      /** No likelihood update: the transition starts from the prior itself. */
      readonly observationApplied: false;
      readonly masteryBeforeTransition: number;
      readonly nextMasteryAfterTransition: number;
      readonly priorRevision: number;
      readonly nextRevision: number;
      readonly chain: ModelChain;
      readonly reasonCode: string;
    }
  | {
      readonly kind: 'NO_MODEL_UPDATE';
      readonly knowledgeComponentId: KnowledgeComponentId;
      /** Explicitly unchanged values, so no null is misread as a calculation failure. */
      readonly masteryUnchanged: number;
      readonly revisionUnchanged: number;
      readonly chain: ModelChain;
      readonly reasonCode: string;
    };

export type ModelDecisionFailure =
  | 'INVALID_PARAMETERS'
  | 'INVALID_MASTERY_STATE'
  | 'MODEL_CHAIN_MISMATCH'
  | 'INVALID_REASON_CODE'
  | 'STALE_MASTERY_REVISION'
  | 'ZERO_LIKELIHOOD_OBSERVATION'
  | 'NON_FINITE_RESULT';

export type ModelDecisionResult =
  | { readonly ok: true; readonly record: ModelDecisionRecord; readonly nextState: MasteryState }
  | { readonly ok: false; readonly failure: ModelDecisionFailure; readonly detail: string };

function fail(failure: ModelDecisionFailure, detail: string): ModelDecisionResult {
  return { ok: false, failure, detail };
}

/**
 * Applies one typed model decision. The expected revision is the revision the task was
 * issued against: a mismatch means newer evidence exists, so the submission is rejected
 * and the task reissued rather than applied out of order (ADR-005).
 */
export function applyModelDecision(
  state: MasteryState,
  instruction: ModelUpdateInstruction,
  parameters: BktParameterSet,
  expectedRevision: number,
): ModelDecisionResult {
  const parameterErrors = validateBktParameters(parameters);
  if (parameterErrors.length > 0) return fail('INVALID_PARAMETERS', parameterErrors.join(' '));
  if (
    !isKnowledgeComponentId(state.knowledgeComponentId) ||
    !isProbability(state.masteryProbability) ||
    !Number.isSafeInteger(state.masteryRevision) ||
    state.masteryRevision < 0
  ) {
    return fail('INVALID_MASTERY_STATE', 'Mastery state is outside its declared domain.');
  }
  if (!sameChain(state.chain, chainOf(parameters))) {
    return fail(
      'MODEL_CHAIN_MISMATCH',
      'The parameter set or model version differs from the stored chain; an approved migration is required.',
    );
  }
  if (!REASON_CODE_PATTERN.test(instruction.reasonCode)) {
    return fail('INVALID_REASON_CODE', 'Reason codes are upper-case identifiers.');
  }
  if (expectedRevision !== state.masteryRevision) {
    return fail(
      'STALE_MASTERY_REVISION',
      `Issued against revision ${expectedRevision}; the current revision is ${state.masteryRevision}.`,
    );
  }
  const prior = state.masteryProbability;
  const base = {
    knowledgeComponentId: state.knowledgeComponentId,
    chain: state.chain,
    reasonCode: instruction.reasonCode,
  };
  if (instruction.kind === 'NO_MODEL_UPDATE') {
    return {
      ok: true,
      record: {
        kind: 'NO_MODEL_UPDATE',
        ...base,
        masteryUnchanged: prior,
        revisionUnchanged: state.masteryRevision,
      },
      nextState: state,
    };
  }
  let posterior = prior;
  if (instruction.kind === 'OBSERVATION') {
    const value = posteriorAfterObservation(prior, instruction.evidence, parameters);
    if (value === null) {
      return fail(
        'ZERO_LIKELIHOOD_OBSERVATION',
        `A ${instruction.evidence} observation is impossible under this prior and parameter set.`,
      );
    }
    posterior = value;
  }
  const next = learningTransition(posterior, parameters);
  if (!isProbability(posterior) || !isProbability(next)) {
    return fail('NON_FINITE_RESULT', 'The update left [0, 1]; nothing was stored.');
  }
  const nextRevision = state.masteryRevision + 1;
  const nextState: MasteryState = {
    ...state,
    masteryProbability: next,
    masteryRevision: nextRevision,
  };
  const record: ModelDecisionRecord =
    instruction.kind === 'OBSERVATION'
      ? {
          kind: 'OBSERVATION',
          ...base,
          evidence: instruction.evidence,
          priorMastery: prior,
          posteriorAfterObservation: posterior,
          nextMasteryAfterTransition: next,
          priorRevision: state.masteryRevision,
          nextRevision,
        }
      : {
          kind: 'TRANSITION_ONLY',
          ...base,
          priorMastery: prior,
          observationApplied: false,
          masteryBeforeTransition: prior,
          nextMasteryAfterTransition: next,
          priorRevision: state.masteryRevision,
          nextRevision,
        };
  return { ok: true, record, nextState };
}

/** BKT-003 threshold policy: the boundary rule is explicit, never implied. */
export interface MasteryThresholdPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly status: ConfigurationStatus;
  readonly threshold: number;
  readonly comparison: 'AT_OR_ABOVE' | 'ABOVE';
}

export function validateMasteryThresholdPolicy(policy: MasteryThresholdPolicy): string[] {
  const errors: string[] = [];
  if (!isNonEmptyIdentifier(policy.policyId)) errors.push('policyId is invalid.');
  if (!isNonEmptyIdentifier(policy.policyVersion)) errors.push('policyVersion is invalid.');
  if (!CONFIGURATION_STATUSES.includes(policy.status)) errors.push('status is unknown.');
  if (!isProbability(policy.threshold)) errors.push('threshold must be finite and in [0, 1].');
  if (policy.comparison !== 'AT_OR_ABOVE' && policy.comparison !== 'ABOVE')
    errors.push('comparison must be AT_OR_ABOVE or ABOVE.');
  return errors;
}

export type MasteryThresholdStatus =
  | { readonly status: 'THRESHOLD_POLICY_UNRESOLVED' }
  | {
      readonly status: 'MEETS_THRESHOLD' | 'BELOW_THRESHOLD';
      readonly policyId: string;
      readonly policyVersion: string;
      readonly threshold: number;
      readonly comparison: 'AT_OR_ABOVE' | 'ABOVE';
    };

/**
 * Threshold status is an operational policy outcome, distinct from independent
 * confirmation, and never proof of learning (TUTORING_BKT_SPEC.md "Educational limitations").
 */
export function classifyMasteryThreshold(
  masteryProbability: number,
  policy: MasteryThresholdPolicy | null,
): MasteryThresholdStatus {
  if (policy === null) return { status: 'THRESHOLD_POLICY_UNRESOLVED' };
  const meets =
    policy.comparison === 'AT_OR_ABOVE'
      ? masteryProbability >= policy.threshold
      : masteryProbability > policy.threshold;
  return {
    status: meets ? 'MEETS_THRESHOLD' : 'BELOW_THRESHOLD',
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    threshold: policy.threshold,
    comparison: policy.comparison,
  };
}
