/**
 * Pure assessment scoring for the Phase 2 vertical slice.
 *
 * - Star identification is exact set membership: no tolerance is involved.
 * - Direction answers are measured as a wrapped circular difference (ADR-003: "angular
 *   answers use robust vector separation or wrapped circular distance"). No learner
 *   tolerance is approved (IMP-012), so the result is MEASURED_NO_TOLERANCE and never a
 *   correct/incorrect classification. A tolerance policy, when approved, is a separate
 *   versioned input.
 */

export type StarSelectionScore =
  | { readonly result: 'CORRECT'; readonly selectedStarId: string }
  | { readonly result: 'INCORRECT'; readonly selectedStarId: string | null };

/** Exact identity scoring; an unknown handle (null) is incorrect. */
export function scoreStarSelection(
  selectedStarId: string | null,
  acceptedStarIds: ReadonlySet<string>,
): StarSelectionScore {
  if (selectedStarId !== null && acceptedStarIds.has(selectedStarId)) {
    return { result: 'CORRECT', selectedStarId };
  }
  return { result: 'INCORRECT', selectedStarId };
}

const TWO_PI = 2 * Math.PI;

/** Smallest absolute angle between two azimuths (rad), in [0, pi]. */
export function wrappedAzimuthDifference(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new RangeError('Azimuths must be finite.');
  let d = (a - b) % TWO_PI;
  if (d < 0) d += TWO_PI;
  return d > Math.PI ? TWO_PI - d : d;
}

export interface DirectionTolerancePolicy {
  readonly policyId: string;
  readonly maximumDifferenceRadians: number;
  readonly approvalReference: string;
}

export type DirectionMeasurement =
  | {
      readonly result: 'MEASURED_NO_TOLERANCE';
      readonly angularDifferenceRadians: number;
    }
  | {
      readonly result: 'WITHIN_APPROVED_TOLERANCE' | 'OUTSIDE_APPROVED_TOLERANCE';
      readonly angularDifferenceRadians: number;
      readonly policyId: string;
    };

/**
 * Measures a direction answer against a target azimuth. Without an approved policy the
 * measurement carries no classification.
 */
export function measureDirectionAnswer(
  answerAzimuthRadians: number,
  targetAzimuthRadians: number,
  policy: DirectionTolerancePolicy | null,
): DirectionMeasurement {
  const angularDifferenceRadians = wrappedAzimuthDifference(
    answerAzimuthRadians,
    targetAzimuthRadians,
  );
  if (policy === null) return { result: 'MEASURED_NO_TOLERANCE', angularDifferenceRadians };
  return {
    result:
      angularDifferenceRadians <= policy.maximumDifferenceRadians
        ? 'WITHIN_APPROVED_TOLERANCE'
        : 'OUTSIDE_APPROVED_TOLERANCE',
    angularDifferenceRadians,
    policyId: policy.policyId,
  };
}
