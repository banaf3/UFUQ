/** Generated catalogue artifact and provenance schemas. */

export const CATALOGUE_CANONICAL_SERIALIZATION_V1 = {
  encoding: 'UTF-8',
  byteOrderMark: false,
  unicodeNormalization: 'NFC',
  lineEnding: 'LF',
  trailingLineFeed: true,
  objectKeyOrder: 'LEXICOGRAPHIC_ASCENDING',
  recordOrder: 'HIP_ID_NUMERIC_ASCENDING',
  arrayOrder: 'SCHEMA_DEFINED',
  numberFormat: 'SHORTEST_ROUND_TRIP_JSON_NUMBER',
  negativeZero: 'NORMALIZE_TO_ZERO',
  nonFiniteNumbers: 'REJECT',
  volatileFieldsInCanonicalPayload: false,
} as const;

const sha256Pattern = '^[a-f0-9]{64}$';

export const CATALOGUE_ARTIFACT_SCHEMA_V1 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:ufuq:schema:artifact:catalogue:v1',
  title: 'UFUQ canonical numerical catalogue artifact',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'catalogue', 'selection', 'records'],
  properties: {
    schemaVersion: { const: 1 },
    catalogue: {
      type: 'object',
      additionalProperties: false,
      required: ['catalogueId', 'tableId', 'archiveVariant', 'referenceFrame', 'referenceEpoch'],
      properties: {
        catalogueId: { const: 'CDS_I311' },
        tableId: { const: 'hip2.dat' },
        archiveVariant: { const: 'AUTHOR_REPLACEMENT_2008-09-16' },
        referenceFrame: { const: 'ICRS' },
        referenceEpoch: {
          type: 'object',
          additionalProperties: false,
          required: ['value', 'sourceNotation', 'timeScale'],
          properties: {
            value: { const: 1991.25 },
            sourceNotation: { const: 'Ep=1991.25' },
            timeScale: { const: 'UNSPECIFIED_BY_I311_METADATA' },
          },
        },
      },
    },
    selection: {
      type: 'object',
      additionalProperties: false,
      required: ['selectionId', 'approvalStatus', 'hipIds'],
      properties: {
        selectionId: { type: 'string', minLength: 1 },
        approvalStatus: {
          enum: ['TECHNICAL_CANDIDATE_ONLY', 'DOMAIN_APPROVED'],
        },
        hipIds: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { type: 'integer', minimum: 1, maximum: 999999 },
        },
      },
    },
    records: {
      type: 'array',
      minItems: 1,
      items: { $ref: 'urn:ufuq:schema:catalogue:hipparcos-i311-main-record:v1' },
    },
  },
} as const;

export const CATALOGUE_PROVENANCE_MANIFEST_SCHEMA_V1 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:ufuq:schema:manifest:catalogue-provenance:v1',
  title: 'UFUQ catalogue provenance manifest',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'source',
    'licence',
    'selection',
    'generator',
    'schemas',
    'canonicalSerialization',
    'artifact',
  ],
  properties: {
    schemaVersion: { const: 1 },
    source: {
      type: 'object',
      additionalProperties: false,
      required: [
        'catalogueId',
        'tableId',
        'archiveVariant',
        'sourceUrl',
        'documentationUrls',
        'acquiredAtUtc',
        'acquisitionMethod',
        'rawFiles',
        'acquisitionProvenanceStatus',
      ],
      properties: {
        catalogueId: { const: 'CDS_I311' },
        tableId: { const: 'hip2.dat' },
        archiveVariant: { const: 'AUTHOR_REPLACEMENT_2008-09-16' },
        sourceUrl: { type: 'string', minLength: 1 },
        documentationUrls: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { type: 'string', minLength: 1 },
        },
        acquiredAtUtc: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$',
        },
        acquisitionMethod: { type: 'string', minLength: 1 },
        rawFiles: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['relativePath', 'byteLength', 'recordCount', 'recordWidth', 'sha256'],
            properties: {
              relativePath: { type: 'string', minLength: 1 },
              byteLength: { type: 'integer', minimum: 1 },
              recordCount: { type: 'integer', minimum: 1 },
              recordWidth: { type: 'integer', minimum: 1 },
              sha256: { type: 'string', pattern: sha256Pattern },
            },
          },
        },
        acquisitionProvenanceStatus: {
          enum: ['VERIFIED', 'PARTIAL', 'UNVERIFIED'],
        },
      },
    },
    licence: {
      type: 'object',
      additionalProperties: false,
      required: ['useStatus', 'termsUrls', 'requiredAttribution', 'redistributionDecision'],
      properties: {
        useStatus: {
          enum: [
            'LOCAL_SCIENTIFIC_USE_ONLY',
            'REDISTRIBUTION_UNRESOLVED',
            'REDISTRIBUTION_APPROVED',
            'USE_NOT_PERMITTED',
          ],
        },
        termsUrls: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { type: 'string', minLength: 1 },
        },
        requiredAttribution: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { type: 'string', minLength: 1 },
        },
        redistributionDecision: {
          enum: ['BLOCK_TRACKING_AND_DEPLOYMENT', 'APPROVED'],
        },
      },
    },
    selection: {
      type: 'object',
      additionalProperties: false,
      required: ['selectionId', 'hipIds', 'approvalStatus', 'evidenceRecord'],
      properties: {
        selectionId: { type: 'string', minLength: 1 },
        hipIds: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { type: 'integer', minimum: 1, maximum: 999999 },
        },
        approvalStatus: {
          enum: ['TECHNICAL_CANDIDATE_ONLY', 'DOMAIN_APPROVED'],
        },
        evidenceRecord: { type: 'string', minLength: 1 },
      },
    },
    generator: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'version', 'gitCommit'],
      properties: {
        name: { type: 'string', minLength: 1 },
        version: { type: 'string', minLength: 1 },
        gitCommit: { type: 'string', pattern: '^[a-f0-9]{40}$' },
      },
    },
    schemas: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', minLength: 1 },
    },
    canonicalSerialization: {
      const: CATALOGUE_CANONICAL_SERIALIZATION_V1,
    },
    artifact: {
      type: 'object',
      additionalProperties: false,
      required: ['relativePath', 'byteLength', 'recordCount', 'sha256'],
      properties: {
        relativePath: { type: 'string', minLength: 1 },
        byteLength: { type: 'integer', minimum: 1 },
        recordCount: { type: 'integer', minimum: 1 },
        sha256: { type: 'string', pattern: sha256Pattern },
      },
    },
  },
} as const;

function canonicalize(value: unknown, path: string): unknown {
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`Non-finite number at ${path}.`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item === undefined) throw new TypeError(`Undefined value at ${path}.${key}.`);
      result[key.normalize('NFC')] = canonicalize(item, `${path}.${key}`);
    }
    return result;
  }
  throw new TypeError(`Unsupported value at ${path}.`);
}

/**
 * Canonical JSON text under CATALOGUE_CANONICAL_SERIALIZATION_V1: sorted keys, NFC
 * strings, two-space indentation, LF, trailing LF, -0 normalized, non-finite rejected.
 */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value, '$'), null, 2)}\n`;
}

export interface ArtifactApprovalRecord {
  readonly state: 'APPROVED' | 'NOT_APPROVED' | 'REVIEW_REQUIRED';
  readonly scope: 'SCIENTIFIC_PROFILE_V1' | 'SYNTHETIC_TECHNICAL_FIXTURE';
  readonly reviewer: string | null;
  readonly decisionDate: string | null;
  readonly decisionReference: string | null;
}

/** Serialized runtime artifact envelope written by tools/catalogue `data:generate`. */
export interface RuntimeArtifactEnvelope<P = unknown> {
  readonly artifactType: string;
  readonly schemaVersion: 1;
  readonly artifactId: string;
  readonly artifactVersion: string;
  readonly payloadSha256: string;
  readonly approval: ArtifactApprovalRecord;
  readonly fieldApprovals?: Readonly<Record<string, ArtifactApprovalRecord>>;
  readonly payload: P;
}

const APPROVAL_STATES = new Set(['APPROVED', 'NOT_APPROVED', 'REVIEW_REQUIRED']);
const APPROVAL_SCOPES = new Set(['SCIENTIFIC_PROFILE_V1', 'SYNTHETIC_TECHNICAL_FIXTURE']);

function isApprovalRecord(value: unknown): value is ArtifactApprovalRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const optionalText = (key: string) => record[key] === null || typeof record[key] === 'string';
  return (
    APPROVAL_STATES.has(record.state as string) &&
    APPROVAL_SCOPES.has(record.scope as string) &&
    optionalText('reviewer') &&
    optionalText('decisionDate') &&
    optionalText('decisionReference')
  );
}

/**
 * Structural envelope check for untrusted artifact JSON (IMP-019). The caller supplies
 * the payload hash computed over `canonicalJson(payload)`; a mismatch is an integrity
 * failure, never a silently accepted artifact.
 */
export function validateArtifactEnvelope(
  value: unknown,
  expectedType: string,
  payloadSha256: (canonicalPayload: string) => string,
): { ok: true; envelope: RuntimeArtifactEnvelope } | { ok: false; reason: string } {
  if (typeof value !== 'object' || value === null) return { ok: false, reason: 'Not an object.' };
  const record = value as Record<string, unknown>;
  if (record.artifactType !== expectedType) {
    return { ok: false, reason: `Expected ${expectedType}, found ${String(record.artifactType)}.` };
  }
  if (record.schemaVersion !== 1) return { ok: false, reason: 'Unsupported schemaVersion.' };
  if (typeof record.artifactId !== 'string' || typeof record.artifactVersion !== 'string') {
    return { ok: false, reason: 'Missing artifact identity.' };
  }
  if (typeof record.payloadSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.payloadSha256)) {
    return { ok: false, reason: 'Missing payload hash.' };
  }
  if (!isApprovalRecord(record.approval)) return { ok: false, reason: 'Malformed approval.' };
  if (record.fieldApprovals !== undefined) {
    const fields = record.fieldApprovals as Record<string, unknown>;
    if (typeof fields !== 'object' || fields === null) {
      return { ok: false, reason: 'Malformed field approvals.' };
    }
    for (const approval of Object.values(fields)) {
      if (!isApprovalRecord(approval)) return { ok: false, reason: 'Malformed field approval.' };
    }
  }
  if (typeof record.payload !== 'object' || record.payload === null) {
    return { ok: false, reason: 'Missing payload.' };
  }
  if (payloadSha256(canonicalJson(record.payload)) !== record.payloadSha256) {
    return { ok: false, reason: 'Payload hash mismatch (INTEGRITY_FAILURE).' };
  }
  return { ok: true, envelope: record as unknown as RuntimeArtifactEnvelope };
}
