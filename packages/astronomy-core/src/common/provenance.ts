/** Shared provenance, approval and execution-scope vocabulary for scientific states. */

export type ScientificApprovalState = 'APPROVED' | 'NOT_APPROVED' | 'REVIEW_REQUIRED';

/**
 * The scope an approval record applies to. `SCIENTIFIC_PROFILE_V1` is the only real-data
 * scope. `SYNTHETIC_TECHNICAL_FIXTURE` exists for visibly non-production technical tests
 * (IMP-011/IMP-012); it never authorizes real data or learner content.
 */
export type ApprovalScope = 'SCIENTIFIC_PROFILE_V1' | 'SYNTHETIC_TECHNICAL_FIXTURE';

/**
 * The scope a request executes under.
 *
 * - `SCIENTIFIC_PROFILE_V1`: real data; every required state must be APPROVED.
 * - `REVIEW_PREVIEW`: real ScientificProfileV1 data for reviewer inspection before
 *   approval. Accepts APPROVED or REVIEW_REQUIRED (never NOT_APPROVED). Its results are
 *   labelled unreviewed, are never learner content, and are never scientific approval.
 *   Owner-delegated PROJECT_DECISION (2026-11-02); disabled unless a composition root
 *   enables it explicitly.
 * - `SYNTHETIC_TECHNICAL_FIXTURE`: synthetic technical fixtures only.
 */
export type ExecutionScope =
  'SCIENTIFIC_PROFILE_V1' | 'REVIEW_PREVIEW' | 'SYNTHETIC_TECHNICAL_FIXTURE';

export interface ScientificApproval {
  readonly state: ScientificApprovalState;
  readonly scope: ApprovalScope;
  readonly reviewer: string | null;
  readonly decisionDate: string | null;
  readonly decisionReference: string | null;
}

export interface ArtifactIdentity {
  readonly artifactId: string;
  readonly artifactVersion: string;
  /** SHA-256 of the canonical payload the approval binds to. */
  readonly payloadSha256: string;
}

export type ArtifactAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'INTEGRITY_FAILURE';

/** The approval scope whose records a given execution scope consults. */
export function approvalScopeFor(scope: ExecutionScope): ApprovalScope {
  return scope === 'SYNTHETIC_TECHNICAL_FIXTURE'
    ? 'SYNTHETIC_TECHNICAL_FIXTURE'
    : 'SCIENTIFIC_PROFILE_V1';
}

/**
 * True when the approval permits execution under `scope`: an explicit APPROVED record of
 * the matching approval scope, or (REVIEW_PREVIEW only) a REVIEW_REQUIRED record.
 */
export function isApprovedFor(approval: ScientificApproval, scope: ExecutionScope): boolean {
  if (approval.scope !== approvalScopeFor(scope)) return false;
  if (approval.state === 'APPROVED') return true;
  return scope === 'REVIEW_PREVIEW' && approval.state === 'REVIEW_REQUIRED';
}
