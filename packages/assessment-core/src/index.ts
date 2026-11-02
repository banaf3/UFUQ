/**
 * Pure assessment scoring (Phase 2 vertical slice, extended in Phase 3).
 *
 * - Star identification is exact set membership: no tolerance is involved.
 * - "Select every member" answers are exact set equality, with diagnostics only.
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

export type StarSetScore =
  | { readonly result: 'CORRECT'; readonly selectedCount: number }
  | {
      readonly result: 'INCORRECT';
      readonly selectedCount: number;
      /** Diagnostics only: no partial-credit policy is approved (IMP-012). */
      readonly missingCount: number;
      readonly extraCount: number;
      readonly invalidSelection: boolean;
    };

/**
 * Exact set scoring for "select every member of the pattern": the answer is correct only
 * when the selection equals the approved membership. Unknown handles (null) or repeated
 * selections make the selection invalid, never partially correct.
 */
export function scoreStarSetSelection(
  selectedStarIds: readonly (string | null)[],
  acceptedStarIds: ReadonlySet<string>,
): StarSetScore {
  const known = selectedStarIds.filter((id): id is string => id !== null);
  const unique = new Set(known);
  const invalidSelection = known.length !== selectedStarIds.length || unique.size !== known.length;
  const missingCount = [...acceptedStarIds].filter((id) => !unique.has(id)).length;
  const extraCount = [...unique].filter((id) => !acceptedStarIds.has(id)).length;
  if (!invalidSelection && missingCount === 0 && extraCount === 0 && unique.size > 0) {
    return { result: 'CORRECT', selectedCount: unique.size };
  }
  return {
    result: 'INCORRECT',
    selectedCount: selectedStarIds.length,
    missingCount,
    extraCount,
    invalidSelection,
  };
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
  if (
    !Number.isFinite(policy.maximumDifferenceRadians) ||
    policy.maximumDifferenceRadians < 0 ||
    policy.maximumDifferenceRadians > Math.PI
  ) {
    throw new RangeError('A direction tolerance must be finite and in [0, pi] radians.');
  }
  return {
    result:
      angularDifferenceRadians <= policy.maximumDifferenceRadians
        ? 'WITHIN_APPROVED_TOLERANCE'
        : 'OUTSIDE_APPROVED_TOLERANCE',
    angularDifferenceRadians,
    policyId: policy.policyId,
  };
}

/** The scored outcome an assessment hands to the learner model, before any policy. */
export type ScoredOutcome = 'CORRECT' | 'INCORRECT' | 'UNCLASSIFIED';

/**
 * Binary evidence exists only for exact identity/set scores and for direction answers
 * classified against an explicit tolerance policy; a bare measurement is UNCLASSIFIED.
 */
export function scoredOutcomeOf(
  score: StarSelectionScore | StarSetScore | DirectionMeasurement,
): ScoredOutcome {
  switch (score.result) {
    case 'CORRECT':
    case 'WITHIN_APPROVED_TOLERANCE':
      return 'CORRECT';
    case 'INCORRECT':
    case 'OUTSIDE_APPROVED_TOLERANCE':
      return 'INCORRECT';
    case 'MEASURED_NO_TOLERANCE':
      return 'UNCLASSIFIED';
  }
}
