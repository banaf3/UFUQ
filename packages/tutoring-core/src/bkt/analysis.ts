/**
 * Pure model-behaviour analysis for the sensitivity plan (TUTORING_BKT_SPEC.md
 * "Sensitivity and validation plan"). These functions describe what a candidate parameter
 * set does; they never select or approve one (BKT-002/BKT-003).
 */
import type { BinaryEvidence } from '../vocabulary.js';
import {
  type BktParameterSet,
  learningTransition,
  type MasteryThresholdPolicy,
  posteriorAfterObservation,
  validateBktParameters,
} from './model.js';

export type SequenceStep = BinaryEvidence | 'TRANSITION_ONLY' | 'NO_MODEL_UPDATE';

export interface SequencePoint {
  readonly step: SequenceStep;
  readonly prior: number;
  readonly posterior: number;
  readonly next: number;
}

function assertValid(parameters: BktParameterSet) {
  const errors = validateBktParameters(parameters);
  if (errors.length > 0) throw new RangeError(errors.join(' '));
}

/** Replays a sequence from P(L0); TRANSITION_ONLY skips the likelihood, NO_MODEL_UPDATE both. */
export function runSequence(
  parameters: BktParameterSet,
  steps: readonly SequenceStep[],
  start = parameters.initialMastery,
): SequencePoint[] {
  assertValid(parameters);
  const points: SequencePoint[] = [];
  let prior = start;
  for (const step of steps) {
    if (step === 'NO_MODEL_UPDATE') {
      points.push({ step, prior, posterior: prior, next: prior });
      continue;
    }
    let posterior = prior;
    if (step !== 'TRANSITION_ONLY') {
      const value = posteriorAfterObservation(prior, step, parameters);
      if (value === null) throw new RangeError(`A ${step} observation has zero likelihood here.`);
      posterior = value;
    }
    const next = learningTransition(posterior, parameters);
    points.push({ step, prior, posterior, next });
    prior = next;
  }
  return points;
}

export function meetsThreshold(value: number, policy: MasteryThresholdPolicy): boolean {
  return policy.comparison === 'AT_OR_ABOVE' ? value >= policy.threshold : value > policy.threshold;
}

/**
 * The lower fixed point of repeated incorrect evidence, T(1-G)/(1-S-G). Below it an
 * incorrect response still finishes higher after the transition (DEV-008). Null when the
 * value is not inside [0, 1).
 */
export function incorrectEvidenceLowerFixedPoint(parameters: BktParameterSet): number | null {
  assertValid(parameters);
  const value =
    (parameters.learn * (1 - parameters.guess)) / (1 - parameters.slip - parameters.guess);
  return value >= 0 && value < 1 ? value : null;
}

/** Opportunities needed by an always-correct sequence to meet the threshold, or null. */
export function attemptsToThreshold(
  parameters: BktParameterSet,
  policy: MasteryThresholdPolicy,
  step: SequenceStep,
  maximumAttempts: number,
  start = parameters.initialMastery,
): number | null {
  if (meetsThreshold(start, policy)) return 0;
  const points = runSequence(parameters, Array<SequenceStep>(maximumAttempts).fill(step), start);
  const index = points.findIndex((point) => meetsThreshold(point.next, policy));
  return index === -1 ? null : index + 1;
}

/**
 * Exact probability that a learner who never masters the skill, answering correctly with
 * probability `correctProbability` (by default the guess parameter), meets the threshold
 * at least once within `opportunities` observations. Enumerates all 2^n outcomes.
 */
export function falseMasteryProbability(
  parameters: BktParameterSet,
  policy: MasteryThresholdPolicy,
  opportunities: number,
  correctProbability = parameters.guess,
): number {
  assertValid(parameters);
  if (!Number.isInteger(opportunities) || opportunities < 0 || opportunities > 20) {
    throw new RangeError('opportunities must be an integer in [0, 20].');
  }
  const visit = (prior: number, remaining: number): number => {
    if (remaining === 0) return 0;
    let total = 0;
    for (const evidence of ['CORRECT', 'INCORRECT'] as const) {
      const weight = evidence === 'CORRECT' ? correctProbability : 1 - correctProbability;
      if (weight === 0) continue;
      const posterior = posteriorAfterObservation(prior, evidence, parameters);
      if (posterior === null) continue;
      const next = learningTransition(posterior, parameters);
      total += weight * (meetsThreshold(next, policy) ? 1 : visit(next, remaining - 1));
    }
    return total;
  };
  return meetsThreshold(parameters.initialMastery, policy)
    ? 1
    : visit(parameters.initialMastery, opportunities);
}

/** Correct observations needed to meet the threshold after `errors` incorrect ones from P(L0). */
export function recoveryAfterErrors(
  parameters: BktParameterSet,
  policy: MasteryThresholdPolicy,
  errors: number,
  maximumAttempts: number,
): number | null {
  const after = runSequence(parameters, Array<SequenceStep>(errors).fill('INCORRECT'));
  const start =
    after.length === 0 ? parameters.initialMastery : (after.at(-1) as SequencePoint).next;
  return attemptsToThreshold(parameters, policy, 'CORRECT', maximumAttempts, start);
}

/** Steps whose posterior is below the threshold but whose transitioned value meets it. */
export function crossingsCausedByTransition(
  points: readonly SequencePoint[],
  policy: MasteryThresholdPolicy,
): number {
  return points.filter(
    (point) => !meetsThreshold(point.posterior, policy) && meetsThreshold(point.next, policy),
  ).length;
}
