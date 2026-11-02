/**
 * Versioned sky-explorer contract (sky.v1). The explorer is not an assessment: it may name
 * stars and draw figures. Lessons never use it; they receive their own opaque star field.
 * Stars travel as compact parallel arrays (about 9,000 stars).
 */
import type { LessonExecutionScope, OverlayLabelV2 } from './lesson.js';

export type SkyContractVersion = 'sky.v1';
export const SKY_CONTRACT_VERSION: SkyContractVersion = 'sky.v1';

export interface SkyFigureV1 {
  readonly figureId: string;
  /** Display name: the IAU name, or the curated pattern's first label. */
  readonly name: string;
  readonly labels: readonly OverlayLabelV2[];
  /** Pairs of star indices into the star arrays. */
  readonly segments: readonly (readonly [number, number])[];
  readonly memberIndices: readonly number[];
}

export interface SkyCultureV1 {
  readonly cultureId: string;
  readonly title: string;
  readonly layer: string;
  readonly reviewState: string;
  readonly attribution: string;
  readonly figures: readonly SkyFigureV1[];
}

export interface SkyStarNameV1 {
  readonly starIndex: number;
  readonly name: string;
  readonly designation: string;
  readonly language: string;
  /** Arabic script quoted in the IAU WGSN etymology, when present. */
  readonly arabicScript: string | null;
  /** IAU WGSN etymology text (CC BY, IAU WGSN). */
  readonly origin: string;
}

export interface SkyViewV1 {
  readonly contractVersion: SkyContractVersion;
  readonly datasetId: string;
  readonly executionScope: LessonExecutionScope;
  readonly utc: string;
  readonly scenarioId: string | null;
  readonly observer: {
    readonly label: string;
    readonly latitudeDegrees: number;
    readonly longitudeDegrees: number;
  };
  readonly stars: {
    readonly count: number;
    /** Catalogue identifiers, e.g. "hip-746" or a route-star id. */
    readonly ids: readonly string[];
    /** Unit east, north, up directions, flattened (3 per star), geometric, no refraction. */
    readonly enu: readonly number[];
    readonly visualMagnitudes: readonly number[];
    /** Johnson B-V colour index, null when the catalogue has none. */
    readonly colorIndices: readonly (number | null)[];
  };
  readonly cultures: readonly SkyCultureV1[];
  readonly starNames: readonly SkyStarNameV1[];
  readonly provenance: {
    readonly profileId: string;
    readonly displayPolicyId: string;
    readonly scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION';
    readonly artifacts: readonly { readonly artifactId: string; readonly approvalState: string }[];
    readonly omittedStarCount: number;
    readonly notices: readonly string[];
    readonly attributions: readonly string[];
  };
}

export interface SkyRequestV1 {
  readonly datasetId: string;
  readonly executionScope: LessonExecutionScope;
  /** Exactly one of utc (canonical whole-second Z) or scenarioId. */
  readonly utc?: string;
  readonly scenarioId?: string;
}

const SCOPES = new Set(['SCIENTIFIC_PROFILE_V1', 'REVIEW_PREVIEW', 'SYNTHETIC_TECHNICAL_FIXTURE']);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/** Framework-free validator for the sky query parameters (IMP-019). */
export function parseSkyRequest(
  query: Record<string, unknown>,
): { ok: true; value: SkyRequestV1 } | { ok: false; reason: string } {
  for (const key of Object.keys(query)) {
    if (!['datasetId', 'executionScope', 'utc', 'scenarioId'].includes(key))
      return { ok: false, reason: `Unknown parameter ${key}.` };
  }
  const { datasetId, executionScope, utc, scenarioId } = query;
  if (typeof datasetId !== 'string' || !IDENTIFIER.test(datasetId))
    return { ok: false, reason: 'datasetId required.' };
  if (typeof executionScope !== 'string' || !SCOPES.has(executionScope))
    return { ok: false, reason: 'Unknown executionScope.' };
  if ((utc === undefined) === (scenarioId === undefined))
    return { ok: false, reason: 'Give exactly one of utc or scenarioId.' };
  if (utc !== undefined && (typeof utc !== 'string' || utc.length > 32))
    return { ok: false, reason: 'utc must be text.' };
  if (scenarioId !== undefined && (typeof scenarioId !== 'string' || !IDENTIFIER.test(scenarioId)))
    return { ok: false, reason: 'scenarioId must be an identifier.' };
  return {
    ok: true,
    value: {
      datasetId,
      executionScope: executionScope as LessonExecutionScope,
      ...(utc === undefined ? {} : { utc: utc as string }),
      ...(scenarioId === undefined ? {} : { scenarioId: scenarioId as string }),
    },
  };
}
