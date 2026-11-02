/** Versioned SupportedTimeDomain (ScientificProfileV1 UTC contract). */
import type { ApprovalScope, ScientificApproval } from '../common/provenance.js';
import { gregorianToModifiedJulianDay } from './calendar.js';
import { compareUtcInstants, parseCanonicalUtc, type ValidatedUtcInstant } from './utc.js';

export type DomainBoundary = 'INCLUSIVE' | 'EXCLUSIVE';

export interface DomainEndpoint {
  readonly canonicalUtc: string;
  readonly boundary: DomainBoundary;
}

export interface SupportedTimeDomain {
  readonly profileId: string;
  readonly executionScope: ApprovalScope;
  readonly domainVersion: string;
  readonly earliest: DomainEndpoint;
  readonly latest: DomainEndpoint;
  readonly inputResolution: 'WHOLE_SECOND';
  readonly contributingDomainIdentities: readonly string[];
  readonly requiredLeapAndEopPolicyIdentities: readonly string[];
  readonly requiredArtifactManifestIdentities: readonly string[];
  readonly requiredFieldCoverage: readonly ('UT1_MINUS_UTC' | 'XP' | 'YP')[];
  readonly interpolationSupportRequirements: string;
  readonly derivationMethodAndVersion: string;
  readonly approval: ScientificApproval;
}

function endpointPosition(endpoint: DomainEndpoint): { mjd: number; secondsOfDay: number } {
  const parsed = parseCanonicalUtc(endpoint.canonicalUtc);
  if (!parsed.ok) throw new RangeError(`Invalid domain endpoint ${endpoint.canonicalUtc}.`);
  const value = parsed.value;
  return {
    mjd: gregorianToModifiedJulianDay(value.year, value.month, value.day),
    secondsOfDay: 3600 * value.hour + 60 * value.minute + value.second,
  };
}

/** Stage 4: explicit endpoint membership; boundaries are never implied. */
export function isInsideSupportedDomain(
  instant: ValidatedUtcInstant,
  domain: SupportedTimeDomain,
): boolean {
  const lower = compareUtcInstants(instant, endpointPosition(domain.earliest));
  const upper = compareUtcInstants(instant, endpointPosition(domain.latest));
  const aboveLower = domain.earliest.boundary === 'INCLUSIVE' ? lower >= 0 : lower > 0;
  const belowUpper = domain.latest.boundary === 'INCLUSIVE' ? upper <= 0 : upper < 0;
  return aboveLower && belowUpper;
}
