/**
 * Learner persistence port (IMP-015). The lesson service keeps lesson presentation state in
 * memory, but every learner-model state and attempt goes through this port, so a learner's
 * mastery per knowledge component survives restarts when the MySQL adapter is composed.
 *
 * One accepted attempt and the next learner-model state are committed together, guarded by
 * the knowledge component's mastery revision: a stale revision commits nothing.
 */
import type { TutoringTraceV2 } from '@ufuq/contracts';
import type {
  KnowledgeComponentId,
  LearnerModelState,
  LearningConfigurationPayload,
} from '@ufuq/tutoring-core';

export interface StoredAttempt extends TutoringTraceV2 {
  readonly lessonId: string;
  readonly stepId: string;
  readonly datasetId: string;
  readonly cueSnapshotId: string;
  readonly issuedCueIds: readonly string[];
  /** Untrusted client diagnostics, stored apart from the evidence classification. */
  readonly clientTelemetry: { readonly renderedCueIds: readonly string[] } | null;
  /** The learner's answer as recorded (a star handle set or an azimuth), never a catalogue id. */
  readonly userAnswer: string;
  /** Seconds from the step being issued to the answer. */
  readonly timeTakenSeconds: number;
  /** Whether any visual support was shown (report Table 3-11, HINTSSHOWN). */
  readonly hintsShown: boolean;
  readonly attemptedAt: string;
}

/** An assessment session row (report Table 3-10). */
export interface StoredLessonSession {
  readonly lessonId: string;
  readonly learnerId: string;
  readonly datasetId: string;
  readonly scenarioId: string;
  readonly locationName: string;
  readonly routeId: string;
  readonly startedAt: string;
}

export type CommitResult = 'COMMITTED' | 'STALE_MASTERY_REVISION';

export interface LearnerStore {
  readonly kind: 'IN_MEMORY' | 'MYSQL';
  /** True when the learner exists and may hold a learner model. */
  learnerExists(learnerId: string): Promise<boolean>;
  /**
   * The learner's model chain for one configuration payload hash; all five KC rows are
   * provisioned together on first use. Null when the configuration has no parameter set.
   */
  chain(
    learnerId: string,
    chainKey: string,
    configuration: LearningConfigurationPayload,
  ): Promise<LearnerModelState | null>;
  /** Stores the attempt and the next state of one KC atomically, or nothing if stale. */
  commit(
    learnerId: string,
    chainKey: string,
    knowledgeComponentId: KnowledgeComponentId,
    expectedRevision: number,
    nextState: LearnerModelState,
    attempt: StoredAttempt,
  ): Promise<CommitResult>;
  attempts(learnerId: string): Promise<readonly StoredAttempt[]>;
  openSession(session: StoredLessonSession): Promise<void>;
  closeSession(lessonId: string, endedAt: string): Promise<void>;
}
