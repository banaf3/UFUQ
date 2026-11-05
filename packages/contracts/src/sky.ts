/**
 * Versioned sky-explorer contract (sky.v2). The explorer is not an assessment: it may name
 * stars and draw figures. Lessons never use it; they receive their own opaque star field.
 * Stars travel as compact parallel arrays (about 9,000 stars). sky.v2 (2026-11-05) teaches
 * the Arabic sky of the anwāʾ: one Arabic culture, Arabic star names with transliteration,
 * cited notes, and the modern IAU star names only as "origin" information.
 */
import type { LessonExecutionScope } from './lesson.js';

export type SkyContractVersion = 'sky.v2';
export const SKY_CONTRACT_VERSION: SkyContractVersion = 'sky.v2';

/** How far a name or figure is supported by the owner's primary anwāʾ texts. */
export type SkyEvidenceV2 =
  | 'PRIMARY_TEXT_READ'
  | 'PRIMARY_TEXT_POINTER'
  | 'COLLECTIVE_NAME_IN_PRIMARY_TEXT'
  | 'NAMED_WITH_FIGURE'
  | 'COMPILATION_ONLY';

/** A note or a recorded conflict, with its human-readable citation. */
export interface SkyCitedTextV2 {
  readonly text: string;
  readonly source: string;
}

export interface SkyAlternativeNameV2 {
  readonly arabic: string;
  readonly transliteration: string | null;
}

export interface SkyFigureV2 {
  readonly figureId: string;
  /** The smallest figure whose stars include this one's, or null for a top-level figure. */
  readonly parentId: string | null;
  readonly arabic: string;
  /** IJMES transliteration of the Arabic name (not a translation). */
  readonly transliteration: string;
  readonly alternativeNames: readonly SkyAlternativeNameV2[];
  /** FIGURE: a drawn shape; GROUP: a herd or area of stars, drawn faintly. */
  readonly style: 'FIGURE' | 'GROUP';
  /** Pairs of star indices into the star arrays (UFUQ teaching lines). */
  readonly segments: readonly (readonly [number, number])[];
  readonly memberIndices: readonly number[];
  readonly evidence: SkyEvidenceV2;
  readonly notes: readonly SkyCitedTextV2[];
  readonly conflicts: readonly SkyCitedTextV2[];
  readonly sources: readonly string[];
}

export interface SkyCultureV2 {
  readonly cultureId: string;
  readonly title: string;
  readonly layer: string;
  readonly reviewState: string;
  readonly attribution: string;
  readonly lineRule: string;
  readonly figures: readonly SkyFigureV2[];
}

/** An Arabic star name of the anwāʾ tradition. */
export interface SkyArabicNameV2 {
  readonly starIndex: number;
  readonly arabic: string;
  readonly transliteration: string;
  readonly alternativeNames: readonly SkyAlternativeNameV2[];
  /** False when the name is shared by a pair or group, or is the name of its own figure. */
  readonly labelOnSky: boolean;
  readonly evidence: SkyEvidenceV2;
  readonly notes: readonly SkyCitedTextV2[];
  readonly conflicts: readonly SkyCitedTextV2[];
  readonly sources: readonly string[];
}

/** A modern IAU WGSN star name, shown only as origin information when a star is picked. */
export interface SkyModernNameV2 {
  readonly starIndex: number;
  readonly name: string;
  readonly designation: string;
  readonly language: string;
  /** Arabic script quoted in the IAU WGSN etymology, when present. */
  readonly arabicScript: string | null;
  /** IAU WGSN etymology text (CC BY, IAU WGSN). */
  readonly origin: string;
}

export interface SkyViewV2 {
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
  /** The Arabic culture, or null when its artifact is not accepted for the scope. */
  readonly culture: SkyCultureV2 | null;
  readonly arabicNames: readonly SkyArabicNameV2[];
  readonly modernNames: readonly SkyModernNameV2[];
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
