/**
 * Canonical JSON serialization (CATALOGUE_CANONICAL_SERIALIZATION_V1): UTF-8 without BOM,
 * NFC strings, LF, trailing LF, lexicographically ascending object keys, schema-defined
 * array order, shortest round-trip numbers, negative zero normalized, non-finite
 * numbers rejected.
 */
import { createHash } from 'node:crypto';

import { canonicalJson } from '@ufuq/catalogue-schema';

export { canonicalJson };

export function sha256Hex(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha1Hex(bytes: string | Uint8Array): string {
  return createHash('sha1').update(bytes).digest('hex');
}

export interface ApprovalRecord {
  readonly state: 'APPROVED' | 'NOT_APPROVED' | 'REVIEW_REQUIRED';
  readonly scope: 'SCIENTIFIC_PROFILE_V1' | 'SYNTHETIC_TECHNICAL_FIXTURE';
  readonly reviewer: string | null;
  readonly decisionDate: string | null;
  readonly decisionReference: string | null;
}

export const REVIEW_REQUIRED_PROFILE_V1: ApprovalRecord = {
  state: 'REVIEW_REQUIRED',
  scope: 'SCIENTIFIC_PROFILE_V1',
  reviewer: null,
  decisionDate: null,
  decisionReference: null,
};

export interface ArtifactEnvelope<P> {
  readonly artifactType: string;
  readonly schemaVersion: 1;
  readonly artifactId: string;
  readonly artifactVersion: string;
  readonly payloadSha256: string;
  readonly approval: ApprovalRecord;
  readonly fieldApprovals?: Readonly<Record<string, ApprovalRecord>>;
  readonly payload: P;
}

/** Wraps a payload with its canonical payload hash and the applicable approval record. */
export function envelope<P>(
  artifactType: string,
  artifactId: string,
  artifactVersion: string,
  payload: P,
  approval: ApprovalRecord,
  fieldApprovals?: Readonly<Record<string, ApprovalRecord>>,
): ArtifactEnvelope<P> {
  const payloadSha256 = sha256Hex(canonicalJson(payload));
  return {
    artifactType,
    schemaVersion: 1,
    artifactId,
    artifactVersion,
    payloadSha256,
    approval,
    ...(fieldApprovals === undefined ? {} : { fieldApprovals }),
    payload,
  };
}
