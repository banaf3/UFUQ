/**
 * IMP-016 development fixture identity: an in-memory learner register for local technical
 * work and tests. It is composed only when the server is started with the explicit opt-in
 * (or as the store of a test) and holds no personal data. Each learner keeps one
 * learner-model chain per learning-configuration payload hash, so a new configuration
 * version starts a new chain instead of silently continuing an old one (BKT-002).
 */
import { randomBytes } from 'node:crypto';

import {
  type KnowledgeComponentId,
  type LearnerModelState,
  type LearningConfigurationPayload,
  provisionLearnerModel,
} from '@ufuq/tutoring-core';

import type {
  CommitResult,
  LearnerStore,
  StoredAttempt,
  StoredLessonSession,
} from './learner-store.js';

export type { StoredAttempt } from './learner-store.js';

interface DevelopmentLearner {
  readonly learnerId: string;
  readonly chains: Map<string, LearnerModelState>;
  readonly attempts: StoredAttempt[];
}

export class DevelopmentLearnerRegistry implements LearnerStore {
  readonly kind = 'IN_MEMORY' as const;
  private readonly learners = new Map<string, DevelopmentLearner>();
  private readonly sessions = new Map<string, StoredLessonSession & { endedAt: string | null }>();

  constructor(private readonly maximumLearners = 200) {}

  create(learnerId?: string): { readonly learnerId: string } {
    if (this.learners.size >= this.maximumLearners) {
      const oldest = this.learners.keys().next().value;
      if (oldest !== undefined) this.learners.delete(oldest);
    }
    let id = learnerId;
    if (id === undefined) {
      do id = `dev-learner-${randomBytes(8).toString('hex')}`;
      while (this.learners.has(id));
    }
    const learner: DevelopmentLearner = { learnerId: id, chains: new Map(), attempts: [] };
    this.learners.set(id, learner);
    return learner;
  }

  learnerExists(learnerId: string): Promise<boolean> {
    return Promise.resolve(this.learners.has(learnerId));
  }

  chain(
    learnerId: string,
    chainKey: string,
    configuration: LearningConfigurationPayload,
  ): Promise<LearnerModelState | null> {
    const learner = this.learners.get(learnerId);
    if (!learner) return Promise.resolve(null);
    const existing = learner.chains.get(chainKey);
    if (existing) return Promise.resolve(existing);
    const provisioned = provisionLearnerModel(configuration);
    if (provisioned !== null) learner.chains.set(chainKey, provisioned);
    return Promise.resolve(provisioned);
  }

  /** Stores the next model state and its attempt record together (one synchronous step). */
  commit(
    learnerId: string,
    chainKey: string,
    knowledgeComponentId: KnowledgeComponentId,
    expectedRevision: number,
    nextState: LearnerModelState,
    attempt: StoredAttempt,
  ): Promise<CommitResult> {
    const learner = this.learners.get(learnerId);
    const current = learner?.chains.get(chainKey);
    if (!learner || !current) return Promise.resolve('STALE_MASTERY_REVISION');
    if (current[knowledgeComponentId].mastery.masteryRevision !== expectedRevision)
      return Promise.resolve('STALE_MASTERY_REVISION');
    learner.chains.set(chainKey, nextState);
    learner.attempts.push(attempt);
    return Promise.resolve('COMMITTED');
  }

  attempts(learnerId: string): Promise<readonly StoredAttempt[]> {
    return Promise.resolve(this.learners.get(learnerId)?.attempts ?? []);
  }

  openSession(session: StoredLessonSession): Promise<void> {
    this.sessions.set(session.lessonId, { ...session, endedAt: null });
    return Promise.resolve();
  }

  closeSession(lessonId: string, endedAt: string): Promise<void> {
    const session = this.sessions.get(lessonId);
    if (session) session.endedAt = endedAt;
    return Promise.resolve();
  }
}
