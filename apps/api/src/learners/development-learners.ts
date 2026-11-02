/**
 * IMP-016 development fixture identity: an in-memory learner register for local technical
 * work before Phase 4 authentication and persistence. It is composed only when the server
 * is started with the explicit opt-in and holds no personal data. Each learner keeps one
 * learner-model chain per learning-configuration payload hash, so a new configuration
 * version starts a new chain instead of silently continuing an old one (BKT-002).
 */
import { randomBytes } from 'node:crypto';

import type { TutoringTraceV2 } from '@ufuq/contracts';
import {
  type LearnerModelState,
  type LearningConfigurationPayload,
  provisionLearnerModel,
} from '@ufuq/tutoring-core';

export interface StoredAttempt extends TutoringTraceV2 {
  readonly lessonId: string;
  readonly stepId: string;
  readonly datasetId: string;
  readonly cueSnapshotId: string;
  readonly issuedCueIds: readonly string[];
  /** Untrusted client diagnostics, stored apart from the evidence classification. */
  readonly clientTelemetry: { readonly renderedCueIds: readonly string[] } | null;
}

export interface DevelopmentLearner {
  readonly learnerId: string;
  readonly chains: Map<string, LearnerModelState>;
  readonly attempts: StoredAttempt[];
}

export class DevelopmentLearnerRegistry {
  private readonly learners = new Map<string, DevelopmentLearner>();

  constructor(private readonly maximumLearners = 200) {}

  create(): DevelopmentLearner {
    if (this.learners.size >= this.maximumLearners) {
      const oldest = this.learners.keys().next().value;
      if (oldest !== undefined) this.learners.delete(oldest);
    }
    let learnerId: string;
    do learnerId = `dev-learner-${randomBytes(8).toString('hex')}`;
    while (this.learners.has(learnerId));
    const learner: DevelopmentLearner = { learnerId, chains: new Map(), attempts: [] };
    this.learners.set(learnerId, learner);
    return learner;
  }

  get(learnerId: string): DevelopmentLearner | undefined {
    return this.learners.get(learnerId);
  }

  /** Provisions all five KC rows at once on first use of a configuration chain. */
  chain(
    learner: DevelopmentLearner,
    chainKey: string,
    configuration: LearningConfigurationPayload,
  ): LearnerModelState | null {
    const existing = learner.chains.get(chainKey);
    if (existing) return existing;
    const provisioned = provisionLearnerModel(configuration);
    if (provisioned !== null) learner.chains.set(chainKey, provisioned);
    return provisioned;
  }

  /** Stores the next model state and its attempt record together (one synchronous step). */
  commit(
    learner: DevelopmentLearner,
    chainKey: string,
    nextState: LearnerModelState,
    attempt: StoredAttempt,
  ): void {
    learner.chains.set(chainKey, nextState);
    learner.attempts.push(attempt);
  }
}
