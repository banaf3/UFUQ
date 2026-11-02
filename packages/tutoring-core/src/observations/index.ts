/**
 * Observation semantics (BKT-001, BKT-005, DEV-006): maps one accepted, server-scored
 * attempt to exactly one typed model-update instruction under a versioned policy. The
 * policy is configuration; this module only enforces the specification's invariants.
 *
 * - Assistance comes only from the authoritative server-issued cue snapshot. Client
 *   telemetry and accessibility accommodations are carried separately and never change it.
 * - Evaluation-only purposes (PRE_TEST, POST_TEST, RECALL) never update the model in this
 *   policy schema version; enabling that needs an approved protocol and a new schema.
 * - Only a scored binary outcome can be an observation from the score.
 */
import {
  type AssistanceClass,
  assistanceClassOf,
  CONFIGURATION_STATUSES,
  type ConfigurationStatus,
  isEvaluationPurpose,
  isNonEmptyIdentifier,
  type ModelUpdateInstruction,
  REASON_CODE_PATTERN,
  SCAFFOLD_STATES,
  type ScaffoldState,
  SESSION_PURPOSES,
  type SessionPurpose,
} from '../vocabulary.js';

/** How the server classified the response before any model decision. */
export const RESPONSE_STATUSES = [
  'SCORED_CORRECT',
  'SCORED_INCORRECT',
  /** Measured without an approved tolerance: no binary evidence exists. */
  'SCORED_UNCLASSIFIED',
  'NO_RESPONSE',
  'TIMEOUT',
  'ABANDONED',
  'INVALID',
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const ATTEMPT_KINDS = [
  'FIRST_ATTEMPT',
  'RETRY_AFTER_FEEDBACK',
  'RETRY_AFTER_REVEAL',
] as const;
export type AttemptKind = (typeof ATTEMPT_KINDS)[number];

export const OBSERVATION_DECISIONS = [
  'OBSERVATION_FROM_SCORE',
  'OBSERVATION_AS_INCORRECT',
  'TRANSITION_ONLY',
  'NO_MODEL_UPDATE',
] as const;
export type ObservationDecisionKind = (typeof OBSERVATION_DECISIONS)[number];

const SCORED_BINARY: readonly ResponseStatus[] = ['SCORED_CORRECT', 'SCORED_INCORRECT'];
/** Responses a policy may treat as incorrect evidence; INVALID and unclassified never. */
const MAY_COUNT_AS_INCORRECT: readonly ResponseStatus[] = ['NO_RESPONSE', 'TIMEOUT', 'ABANDONED'];

/** The cue snapshot the server issued for this task; the only source of assistance. */
export interface IssuedCueSnapshot {
  readonly snapshotId: string;
  readonly cueConfigurationId: string;
  readonly cueConfigurationVersion: string;
  readonly scaffoldState: ScaffoldState;
  readonly cueIds: readonly string[];
}

export interface ObservationRule {
  readonly ruleId: string;
  /** Omitted dimensions match every value. */
  readonly when: {
    readonly purposes?: readonly SessionPurpose[];
    readonly scaffoldStates?: readonly ScaffoldState[];
    readonly responses?: readonly ResponseStatus[];
    readonly attemptKinds?: readonly AttemptKind[];
  };
  readonly decision: ObservationDecisionKind;
  readonly reasonCode: string;
}

/** Ordered rules; the first matching rule decides. Validation proves the table is total. */
export interface ObservationPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly status: ConfigurationStatus;
  readonly rules: readonly ObservationRule[];
}

export interface AttemptEvidence {
  readonly purpose: SessionPurpose;
  readonly issuedCues: IssuedCueSnapshot;
  readonly response: ResponseStatus;
  readonly attemptKind: AttemptKind;
  /** Recorded separately; an accommodation is never automatically a hint. */
  readonly accommodations: readonly string[];
  /** Untrusted diagnostics; a client claim can never upgrade assisted evidence. */
  readonly clientTelemetry: {
    readonly renderedCueIds?: readonly string[];
    readonly claimsCuesHidden?: boolean;
  } | null;
}

export interface ObservationDecision {
  readonly instruction: ModelUpdateInstruction;
  readonly decision: ObservationDecisionKind;
  readonly observationEligible: boolean;
  readonly assistanceClass: AssistanceClass;
  readonly scaffoldStateAtIssue: ScaffoldState;
  readonly cueSnapshotId: string;
  readonly ruleId: string;
  readonly policyId: string;
  readonly policyVersion: string;
}

function matches(rule: ObservationRule, cell: Cell): boolean {
  const { purposes, scaffoldStates, responses, attemptKinds } = rule.when;
  return (
    (purposes === undefined || purposes.includes(cell.purpose)) &&
    (scaffoldStates === undefined || scaffoldStates.includes(cell.scaffoldState)) &&
    (responses === undefined || responses.includes(cell.response)) &&
    (attemptKinds === undefined || attemptKinds.includes(cell.attemptKind))
  );
}

interface Cell {
  readonly purpose: SessionPurpose;
  readonly scaffoldState: ScaffoldState;
  readonly response: ResponseStatus;
  readonly attemptKind: AttemptKind;
}

function* cells(): Generator<Cell> {
  for (const purpose of SESSION_PURPOSES)
    for (const scaffoldState of SCAFFOLD_STATES)
      for (const response of RESPONSE_STATUSES)
        for (const attemptKind of ATTEMPT_KINDS)
          yield { purpose, scaffoldState, response, attemptKind };
}

function cellViolation(cell: Cell, decision: ObservationDecisionKind): string | null {
  if (isEvaluationPurpose(cell.purpose) && decision !== 'NO_MODEL_UPDATE') {
    return 'evaluation-only purposes must be NO_MODEL_UPDATE (BKT-005)';
  }
  if (decision === 'OBSERVATION_FROM_SCORE' && !SCORED_BINARY.includes(cell.response)) {
    return 'only a scored binary response can be an observation from the score';
  }
  if (decision === 'OBSERVATION_AS_INCORRECT' && !MAY_COUNT_AS_INCORRECT.includes(cell.response)) {
    return 'only no-response, timeout or abandonment may be treated as incorrect';
  }
  return null;
}

/** Proves the rule table is total over every purpose x state x response x attempt cell. */
export function validateObservationPolicy(policy: ObservationPolicy): string[] {
  const errors: string[] = [];
  if (!isNonEmptyIdentifier(policy.policyId)) errors.push('policyId is invalid.');
  if (!isNonEmptyIdentifier(policy.policyVersion)) errors.push('policyVersion is invalid.');
  if (!CONFIGURATION_STATUSES.includes(policy.status)) errors.push('status is unknown.');
  if (policy.rules.length === 0) errors.push('The policy has no rules.');
  const ids = policy.rules.map((rule) => rule.ruleId);
  if (new Set(ids).size !== ids.length) errors.push('Rule identifiers are not unique.');
  for (const rule of policy.rules) {
    if (!isNonEmptyIdentifier(rule.ruleId)) errors.push('A rule identifier is invalid.');
    if (!OBSERVATION_DECISIONS.includes(rule.decision))
      errors.push(`${rule.ruleId}: unknown decision.`);
    if (!REASON_CODE_PATTERN.test(rule.reasonCode))
      errors.push(`${rule.ruleId}: reason code is not an upper-case identifier.`);
    const { purposes, scaffoldStates, responses, attemptKinds } = rule.when;
    const known = (values: readonly string[] | undefined, domain: readonly string[]) =>
      values === undefined || (values.length > 0 && values.every((v) => domain.includes(v)));
    if (
      !known(purposes, SESSION_PURPOSES) ||
      !known(scaffoldStates, SCAFFOLD_STATES) ||
      !known(responses, RESPONSE_STATUSES) ||
      !known(attemptKinds, ATTEMPT_KINDS)
    ) {
      errors.push(`${rule.ruleId}: a condition is empty or uses an unknown value.`);
    }
  }
  if (errors.length > 0) return errors;
  const used = new Set<string>();
  for (const cell of cells()) {
    const rule = policy.rules.find((candidate) => matches(candidate, cell));
    const label = `${cell.purpose}/${cell.scaffoldState}/${cell.response}/${cell.attemptKind}`;
    if (!rule) {
      errors.push(`No rule covers ${label}.`);
      continue;
    }
    used.add(rule.ruleId);
    const violation = cellViolation(cell, rule.decision);
    if (violation) errors.push(`${rule.ruleId} at ${label}: ${violation}.`);
  }
  for (const rule of policy.rules) {
    if (!used.has(rule.ruleId)) errors.push(`${rule.ruleId} is unreachable.`);
  }
  return errors;
}

/** Decides the model instruction for one attempt under a validated policy. */
export function decideObservation(
  evidence: AttemptEvidence,
  policy: ObservationPolicy,
): ObservationDecision {
  const cell: Cell = {
    purpose: evidence.purpose,
    // Only the server-issued snapshot classifies assistance; telemetry is ignored here.
    scaffoldState: evidence.issuedCues.scaffoldState,
    response: evidence.response,
    attemptKind: evidence.attemptKind,
  };
  const rule = policy.rules.find((candidate) => matches(candidate, cell));
  if (!rule) throw new RangeError('The observation policy is not total; validate it at load.');
  const violation = cellViolation(cell, rule.decision);
  if (violation)
    throw new RangeError(`The observation policy violates an invariant: ${violation}.`);
  const instruction: ModelUpdateInstruction =
    rule.decision === 'OBSERVATION_FROM_SCORE'
      ? {
          kind: 'OBSERVATION',
          evidence: cell.response === 'SCORED_CORRECT' ? 'CORRECT' : 'INCORRECT',
          reasonCode: rule.reasonCode,
        }
      : rule.decision === 'OBSERVATION_AS_INCORRECT'
        ? { kind: 'OBSERVATION', evidence: 'INCORRECT', reasonCode: rule.reasonCode }
        : rule.decision === 'TRANSITION_ONLY'
          ? { kind: 'TRANSITION_ONLY', reasonCode: rule.reasonCode }
          : { kind: 'NO_MODEL_UPDATE', reasonCode: rule.reasonCode };
  return {
    instruction,
    decision: rule.decision,
    observationEligible: instruction.kind === 'OBSERVATION',
    assistanceClass: assistanceClassOf(cell.scaffoldState),
    scaffoldStateAtIssue: cell.scaffoldState,
    cueSnapshotId: evidence.issuedCues.snapshotId,
    ruleId: rule.ruleId,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
  };
}

/** One stored attempt as seen by the evidence-history consumers. */
export interface EvidenceHistoryEntry {
  readonly purpose: SessionPurpose;
  readonly scaffoldStateAtIssue: ScaffoldState;
  readonly attemptKind: AttemptKind;
  readonly response: ResponseStatus;
}

/** BKT-003: how many independent successes confirm independent performance. */
export interface IndependentConfirmationPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly status: ConfigurationStatus;
  readonly requiredConsecutiveIndependentCorrect: number;
}

export function validateIndependentConfirmationPolicy(
  policy: IndependentConfirmationPolicy,
): string[] {
  const errors: string[] = [];
  if (!isNonEmptyIdentifier(policy.policyId)) errors.push('policyId is invalid.');
  if (!isNonEmptyIdentifier(policy.policyVersion)) errors.push('policyVersion is invalid.');
  if (!CONFIGURATION_STATUSES.includes(policy.status)) errors.push('status is unknown.');
  const n = policy.requiredConsecutiveIndependentCorrect;
  if (!Number.isInteger(n) || n < 1 || n > 100)
    errors.push('requiredConsecutiveIndependentCorrect must be an integer in [1, 100].');
  return errors;
}

export type IndependentConfirmationStatus =
  | { readonly status: 'CONFIRMATION_POLICY_UNRESOLVED' }
  | {
      readonly status: 'INDEPENDENTLY_CONFIRMED' | 'NOT_INDEPENDENTLY_CONFIRMED';
      readonly trailingIndependentCorrect: number;
      readonly required: number;
      readonly policyId: string;
      readonly policyVersion: string;
    };

/**
 * Counts the trailing run of first-attempt, scored-correct LEARNING responses issued in
 * the INDEPENDENT state. Assisted attempts neither count nor break the run; an independent
 * scored-incorrect response ends it. Distinct from the mastery threshold (ADR-005).
 */
export function independentConfirmationStatus(
  history: readonly EvidenceHistoryEntry[],
  policy: IndependentConfirmationPolicy | null,
): IndependentConfirmationStatus {
  if (policy === null) return { status: 'CONFIRMATION_POLICY_UNRESOLVED' };
  let run = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index] as EvidenceHistoryEntry;
    if (entry.purpose !== 'LEARNING' || entry.scaffoldStateAtIssue !== 'INDEPENDENT') continue;
    if (entry.response === 'SCORED_INCORRECT') break;
    if (entry.response === 'SCORED_CORRECT' && entry.attemptKind === 'FIRST_ATTEMPT') run += 1;
  }
  return {
    status:
      run >= policy.requiredConsecutiveIndependentCorrect
        ? 'INDEPENDENTLY_CONFIRMED'
        : 'NOT_INDEPENDENTLY_CONFIRMED',
    trailingIndependentCorrect: run,
    required: policy.requiredConsecutiveIndependentCorrect,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
  };
}
