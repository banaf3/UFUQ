/**
 * Shared tutoring vocabulary (docs/TUTORING_BKT_SPEC.md). It names the confirmed knowledge
 * components, scaffold states, session purposes and model-update kinds. It holds no
 * parameter, threshold, cue or policy value: those are versioned configuration inputs.
 */

/** The five separate learner skill states (CONFIRMED in TUTORING_BKT_SPEC.md). */
export const KNOWLEDGE_COMPONENTS = [
  { id: 'KC-01', name: "Identify Banat Na'sh" },
  { id: 'KC-02', name: 'Recognise Dhat al-Kursi' },
  { id: 'KC-03', name: 'Locate Al-Jady/Polaris' },
  { id: 'KC-04', name: 'Estimate True North' },
  { id: 'KC-05', name: 'Derive Qibla from True North' },
] as const;

export type KnowledgeComponentId = (typeof KNOWLEDGE_COMPONENTS)[number]['id'];

export const KNOWLEDGE_COMPONENT_IDS: readonly KnowledgeComponentId[] = KNOWLEDGE_COMPONENTS.map(
  (component) => component.id,
);

export function isKnowledgeComponentId(value: unknown): value is KnowledgeComponentId {
  return (
    typeof value === 'string' && (KNOWLEDGE_COMPONENT_IDS as readonly string[]).includes(value)
  );
}

/** Proposed scaffold states (DEV-004). Their cue content is BKT-004 configuration. */
export const SCAFFOLD_STATES = ['GUIDED', 'FADING', 'INDEPENDENT'] as const;
export type ScaffoldState = (typeof SCAFFOLD_STATES)[number];

/** Evidence labels of the specification's scaffolding table. */
export type AssistanceClass = 'ASSISTED' | 'ASSISTED_FADING' | 'INDEPENDENT';

export function assistanceClassOf(state: ScaffoldState): AssistanceClass {
  if (state === 'GUIDED') return 'ASSISTED';
  if (state === 'FADING') return 'ASSISTED_FADING';
  return 'INDEPENDENT';
}

/** Session purpose is recorded independently from assistance state (BKT-005). */
export const SESSION_PURPOSES = ['PRE_TEST', 'LEARNING', 'POST_TEST', 'RECALL'] as const;
export type SessionPurpose = (typeof SESSION_PURPOSES)[number];

/** Evaluation-only purposes must not train, transition or change scaffolding (BKT-005). */
export function isEvaluationPurpose(purpose: SessionPurpose): boolean {
  return purpose !== 'LEARNING';
}

/**
 * Where a configuration value comes from. Only APPROVED values may drive learner-facing
 * behaviour; the report examples are reproducible, not calibrated (TUTORING_BKT_SPEC.md).
 */
export type ConfigurationStatus =
  'APPROVED' | 'REVIEW_REQUIRED' | 'REPORT_EXAMPLE_NOT_CALIBRATED' | 'SYNTHETIC_TECHNICAL_FIXTURE';

export const CONFIGURATION_STATUSES: readonly ConfigurationStatus[] = [
  'APPROVED',
  'REVIEW_REQUIRED',
  'REPORT_EXAMPLE_NOT_CALIBRATED',
  'SYNTHETIC_TECHNICAL_FIXTURE',
];

/** Reason codes are stable machine identifiers, never prose. */
export const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

export type BinaryEvidence = 'CORRECT' | 'INCORRECT';

/**
 * The one typed model update an accepted submission requests (ADR-005): a binary
 * observation, a learning transition without evidence, or an explicit no-op.
 */
export type ModelUpdateInstruction =
  | { readonly kind: 'OBSERVATION'; readonly evidence: BinaryEvidence; readonly reasonCode: string }
  | { readonly kind: 'TRANSITION_ONLY'; readonly reasonCode: string }
  | { readonly kind: 'NO_MODEL_UPDATE'; readonly reasonCode: string };

/** Probability guard shared by the validators: finite and inside [0, 1]. */
export function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isNonEmptyIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}
