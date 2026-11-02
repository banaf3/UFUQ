/**
 * Learner-model composition: one accepted attempt produces exactly one observation
 * decision, one typed model decision and one scaffold decision (ADR-005). Pure and
 * deterministic; the API persists the result together with the attempt.
 *
 * A learning configuration is ADAPTIVE only when its parameter set, observation policy,
 * scaffold policy and an adaptive cue configuration are all present. Otherwise it is
 * NON_ADAPTIVE: every attempt records an explicit NO_MODEL_UPDATE and the presentation is
 * fixed, so unresolved policies never turn into invented behaviour.
 */
import {
  type CueConfiguration,
  decideScaffold,
  type ScaffoldDecision,
  type ScaffoldPolicy,
  validateCueConfiguration,
  validateScaffoldPolicy,
} from './adaptive-policy/index.js';
import {
  applyModelDecision,
  type BktParameterSet,
  classifyMasteryThreshold,
  initialMasteryState,
  type MasteryState,
  type MasteryThresholdPolicy,
  type MasteryThresholdStatus,
  type ModelDecisionFailure,
  type ModelDecisionRecord,
  validateBktParameters,
  validateMasteryThresholdPolicy,
} from './bkt/index.js';
import {
  type AttemptEvidence,
  type AttemptKind,
  decideObservation,
  type EvidenceHistoryEntry,
  type IndependentConfirmationPolicy,
  type IndependentConfirmationStatus,
  independentConfirmationStatus,
  type ObservationDecision,
  type ObservationPolicy,
  type ResponseStatus,
  validateIndependentConfirmationPolicy,
  validateObservationPolicy,
} from './observations/index.js';
import {
  KNOWLEDGE_COMPONENT_IDS,
  KNOWLEDGE_COMPONENTS,
  type KnowledgeComponentId,
  type ModelUpdateInstruction,
  type ScaffoldState,
  type SessionPurpose,
} from './vocabulary.js';

export interface UnresolvedConfigurationItem {
  readonly field: string;
  readonly decisionId: string;
  readonly note: string;
}

/** Runtime artifact payload `UFUQ_LEARNING_CONFIGURATION` (schema version 1). */
export interface LearningConfigurationPayload {
  readonly configurationVersion: string;
  readonly configurationScope: 'SCIENTIFIC_PROFILE_V1' | 'SYNTHETIC_TECHNICAL_FIXTURE';
  readonly knowledgeComponents: readonly { readonly id: string; readonly name: string }[];
  readonly bktParameters: BktParameterSet | null;
  readonly masteryThreshold: MasteryThresholdPolicy | null;
  readonly independentConfirmation: IndependentConfirmationPolicy | null;
  readonly observationPolicy: ObservationPolicy | null;
  readonly scaffoldPolicy: ScaffoldPolicy | null;
  readonly cueConfiguration: CueConfiguration;
  /** Every null component must be listed with the decision that owns it. */
  readonly unresolved: readonly UnresolvedConfigurationItem[];
}

const NULLABLE_FIELDS = [
  'bktParameters',
  'masteryThreshold',
  'independentConfirmation',
  'observationPolicy',
  'scaffoldPolicy',
] as const;

export type LearningMode = 'ADAPTIVE' | 'NON_ADAPTIVE';

export function learningModeOf(configuration: LearningConfigurationPayload): LearningMode {
  return configuration.cueConfiguration.kind === 'ADAPTIVE' ? 'ADAPTIVE' : 'NON_ADAPTIVE';
}

export function validateLearningConfiguration(
  configuration: LearningConfigurationPayload,
): string[] {
  const errors: string[] = [];
  const names = configuration.knowledgeComponents.map((kc) => `${kc.id}:${kc.name}`).join('|');
  if (names !== KNOWLEDGE_COMPONENTS.map((kc) => `${kc.id}:${kc.name}`).join('|')) {
    errors.push(
      'knowledgeComponents must list KC-01..KC-05 exactly as the specification names them.',
    );
  }
  if (configuration.bktParameters)
    errors.push(
      ...validateBktParameters(configuration.bktParameters).map((e) => `bktParameters: ${e}`),
    );
  if (configuration.masteryThreshold)
    errors.push(
      ...validateMasteryThresholdPolicy(configuration.masteryThreshold).map(
        (e) => `masteryThreshold: ${e}`,
      ),
    );
  if (configuration.independentConfirmation)
    errors.push(
      ...validateIndependentConfirmationPolicy(configuration.independentConfirmation).map(
        (e) => `independentConfirmation: ${e}`,
      ),
    );
  if (configuration.observationPolicy)
    errors.push(
      ...validateObservationPolicy(configuration.observationPolicy).map(
        (e) => `observationPolicy: ${e}`,
      ),
    );
  if (configuration.scaffoldPolicy)
    errors.push(
      ...validateScaffoldPolicy(configuration.scaffoldPolicy).map((e) => `scaffoldPolicy: ${e}`),
    );
  errors.push(
    ...validateCueConfiguration(configuration.cueConfiguration).map(
      (e) => `cueConfiguration: ${e}`,
    ),
  );
  const adaptive = configuration.cueConfiguration.kind === 'ADAPTIVE';
  const policies =
    configuration.observationPolicy !== null || configuration.scaffoldPolicy !== null;
  if (
    adaptive &&
    (configuration.bktParameters === null ||
      configuration.observationPolicy === null ||
      configuration.scaffoldPolicy === null)
  ) {
    errors.push(
      'An ADAPTIVE configuration needs parameters, an observation and a scaffold policy.',
    );
  }
  if (!adaptive && policies) {
    errors.push('Observation or scaffold policies require an ADAPTIVE cue configuration.');
  }
  const unresolved = new Set(configuration.unresolved.map((item) => item.field));
  for (const field of NULLABLE_FIELDS) {
    if (configuration[field] === null && !unresolved.has(field))
      errors.push(`${field} is null but not listed as unresolved.`);
    if (configuration[field] !== null && unresolved.has(field))
      errors.push(`${field} is present but listed as unresolved.`);
  }
  for (const item of configuration.unresolved) {
    if (!/^(BKT|EDU|IMP|DEV)-\d{3}$/.test(item.decisionId))
      errors.push(`${item.field}: decisionId must name an owning decision (e.g. BKT-001).`);
  }
  return errors;
}

export interface KnowledgeComponentState {
  readonly mastery: MasteryState;
  /** Current scaffold state; null when the configuration is NON_ADAPTIVE. */
  readonly scaffoldState: ScaffoldState | null;
  /** Accepted attempts, oldest first (ADAPTIVE only). */
  readonly history: readonly EvidenceHistoryEntry[];
}

export type LearnerModelState = Readonly<Record<KnowledgeComponentId, KnowledgeComponentState>>;

/**
 * Provisions all five knowledge-component rows and initial scaffolds at once, before any
 * assessed task is issued. Null when no parameter set exists to anchor the chain.
 */
export function provisionLearnerModel(
  configuration: LearningConfigurationPayload,
): LearnerModelState | null {
  const parameters = configuration.bktParameters;
  if (parameters === null) return null;
  const initialScaffold =
    learningModeOf(configuration) === 'ADAPTIVE'
      ? (configuration.scaffoldPolicy as ScaffoldPolicy).initialState
      : null;
  const entries = KNOWLEDGE_COMPONENT_IDS.map((kc) => [
    kc,
    { mastery: initialMasteryState(kc, parameters), scaffoldState: initialScaffold, history: [] },
  ]);
  return Object.fromEntries(entries) as LearnerModelState;
}

/** Cue snapshot as issued; scaffoldState is null for a NON_ADAPTIVE configuration. */
export interface IssuedTaskCues {
  readonly snapshotId: string;
  readonly cueConfigurationId: string;
  readonly cueConfigurationVersion: string;
  readonly scaffoldState: ScaffoldState | null;
  readonly cueIds: readonly string[];
}

export interface SubmittedAttempt {
  readonly knowledgeComponentId: KnowledgeComponentId;
  readonly purpose: SessionPurpose;
  readonly issuedCues: IssuedTaskCues;
  readonly response: ResponseStatus;
  readonly attemptKind: AttemptKind;
  readonly accommodations: readonly string[];
  readonly clientTelemetry: AttemptEvidence['clientTelemetry'];
  /** The mastery revision the task was issued against. */
  readonly expectedMasteryRevision: number;
}

export const OBSERVATION_POLICY_UNRESOLVED = 'OBSERVATION_POLICY_UNRESOLVED';
export const SCAFFOLD_POLICY_UNRESOLVED = 'SCAFFOLD_POLICY_UNRESOLVED';

export interface AttemptDecisionRecord {
  readonly knowledgeComponentId: KnowledgeComponentId;
  readonly mode: LearningMode;
  readonly observation:
    | ObservationDecision
    | {
        readonly decision: 'NO_MODEL_UPDATE';
        readonly reasonCode: string;
        readonly policyId: null;
      };
  readonly model: ModelDecisionRecord;
  readonly scaffold:
    ScaffoldDecision | { readonly kind: 'SCAFFOLD_NOT_ADAPTIVE'; readonly reasonCode: string };
  readonly masteryThreshold: MasteryThresholdStatus;
  readonly independentConfirmation: IndependentConfirmationStatus;
}

export type AttemptFailure =
  ModelDecisionFailure | 'LEARNER_MODEL_UNAVAILABLE' | 'CUE_SNAPSHOT_MODE_MISMATCH';

export type AttemptResult =
  | {
      readonly ok: true;
      readonly record: AttemptDecisionRecord;
      readonly nextState: LearnerModelState;
    }
  | { readonly ok: false; readonly failure: AttemptFailure; readonly detail: string };

export function processAttempt(
  state: LearnerModelState,
  configuration: LearningConfigurationPayload,
  attempt: SubmittedAttempt,
): AttemptResult {
  const parameters = configuration.bktParameters;
  if (parameters === null)
    return { ok: false, failure: 'LEARNER_MODEL_UNAVAILABLE', detail: 'No parameter set exists.' };
  const kc = attempt.knowledgeComponentId;
  const current = state[kc];
  const mode = learningModeOf(configuration);
  if ((mode === 'ADAPTIVE') !== (attempt.issuedCues.scaffoldState !== null)) {
    return {
      ok: false,
      failure: 'CUE_SNAPSHOT_MODE_MISMATCH',
      detail: 'The issued cue snapshot does not match the configuration mode.',
    };
  }

  let observation: AttemptDecisionRecord['observation'];
  let instruction: ModelUpdateInstruction;
  if (mode === 'ADAPTIVE') {
    const decision = decideObservation(
      {
        purpose: attempt.purpose,
        issuedCues: {
          ...attempt.issuedCues,
          scaffoldState: attempt.issuedCues.scaffoldState as ScaffoldState,
        },
        response: attempt.response,
        attemptKind: attempt.attemptKind,
        accommodations: attempt.accommodations,
        clientTelemetry: attempt.clientTelemetry,
      },
      configuration.observationPolicy as ObservationPolicy,
    );
    observation = decision;
    instruction = decision.instruction;
  } else {
    observation = {
      decision: 'NO_MODEL_UPDATE',
      reasonCode: OBSERVATION_POLICY_UNRESOLVED,
      policyId: null,
    };
    instruction = { kind: 'NO_MODEL_UPDATE', reasonCode: OBSERVATION_POLICY_UNRESOLVED };
  }

  const model = applyModelDecision(
    current.mastery,
    instruction,
    parameters,
    attempt.expectedMasteryRevision,
  );
  if (!model.ok) return model;

  let scaffold: AttemptDecisionRecord['scaffold'];
  let history = current.history;
  let scaffoldState = current.scaffoldState;
  if (mode === 'ADAPTIVE') {
    history = [
      ...current.history,
      {
        purpose: attempt.purpose,
        scaffoldStateAtIssue: attempt.issuedCues.scaffoldState as ScaffoldState,
        attemptKind: attempt.attemptKind,
        response: attempt.response,
      },
    ];
    const decision = decideScaffold(
      {
        purpose: attempt.purpose,
        currentState: current.scaffoldState as ScaffoldState,
        masteryProbability: model.nextState.masteryProbability,
        history,
      },
      configuration.scaffoldPolicy as ScaffoldPolicy,
    );
    scaffold = decision;
    scaffoldState = decision.toState;
  } else {
    scaffold = { kind: 'SCAFFOLD_NOT_ADAPTIVE', reasonCode: SCAFFOLD_POLICY_UNRESOLVED };
  }

  const record: AttemptDecisionRecord = {
    knowledgeComponentId: kc,
    mode,
    observation,
    model: model.record,
    scaffold,
    masteryThreshold: classifyMasteryThreshold(
      model.nextState.masteryProbability,
      configuration.masteryThreshold,
    ),
    independentConfirmation: independentConfirmationStatus(
      history,
      mode === 'ADAPTIVE' ? configuration.independentConfirmation : null,
    ),
  };
  return {
    ok: true,
    record,
    nextState: { ...state, [kc]: { mastery: model.nextState, scaffoldState, history } },
  };
}

/** Deterministic replay of a stored attempt sequence: the same inputs give the same records. */
export function replayAttempts(
  configuration: LearningConfigurationPayload,
  attempts: readonly Omit<SubmittedAttempt, 'expectedMasteryRevision'>[],
): { readonly records: readonly AttemptDecisionRecord[]; readonly finalState: LearnerModelState } {
  let state = provisionLearnerModel(configuration);
  if (state === null) throw new RangeError('The configuration has no parameter set.');
  const records: AttemptDecisionRecord[] = [];
  for (const attempt of attempts) {
    const result = processAttempt(state, configuration, {
      ...attempt,
      expectedMasteryRevision: state[attempt.knowledgeComponentId].mastery.masteryRevision,
    });
    if (!result.ok) throw new RangeError(`Replay failed: ${result.failure} ${result.detail}`);
    records.push(result.record);
    state = result.nextState;
  }
  return { records, finalState: state };
}
