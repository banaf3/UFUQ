/**
 * MySQL adapter of the learner persistence port (IMP-015; report tables 3-9 to 3-11). A
 * learner id is `u-<user_id>`. One attempt and the next mastery state of its knowledge
 * component are written in one transaction, after locking that component's mastery row
 * and checking its revision; a stale revision writes nothing.
 */
import {
  KNOWLEDGE_COMPONENT_IDS,
  type KnowledgeComponentId,
  type KnowledgeComponentState,
  type LearnerModelState,
  type LearningConfigurationPayload,
  provisionLearnerModel,
} from '@ufuq/tutoring-core';

import type {
  CommitResult,
  LearnerStore,
  StoredAttempt,
  StoredLessonSession,
} from '../learners/learner-store.js';
import { type Pool, type RowDataPacket, transaction } from './mysql.js';

export const ACCOUNT_LEARNER_PREFIX = 'u-';

export function userIdOf(learnerId: string): number | null {
  const match = /^u-(\d{1,10})$/.exec(learnerId);
  return match ? Number(match[1]) : null;
}

const skillIdOf = (kc: KnowledgeComponentId) => Number(kc.slice(3));
const mysqlTime = (iso: string) => new Date(iso);

export class MySqlLearnerStore implements LearnerStore {
  readonly kind = 'MYSQL' as const;

  constructor(private readonly pool: Pool) {}

  async learnerExists(learnerId: string): Promise<boolean> {
    const userId = userIdOf(learnerId);
    if (userId === null) return false;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT 1 FROM app_user WHERE user_id = ?',
      [userId],
    );
    return rows.length === 1;
  }

  private async load(userId: number, chainKey: string): Promise<LearnerModelState | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT s.kc_code, m.mastery_json, m.history_json, m.scaffold_state
         FROM bkt_mastery_state m JOIN cognitive_skill s ON s.skill_id = m.skill_id
        WHERE m.user_id = ? AND m.configuration_sha256 = ?`,
      [userId, chainKey],
    );
    if (rows.length === 0) return null;
    if (rows.length !== KNOWLEDGE_COMPONENT_IDS.length)
      throw new Error(`Learner ${userId} has a partial mastery chain.`);
    const entries = rows.map((row) => [
      row.kc_code as KnowledgeComponentId,
      {
        mastery: row.mastery_json,
        history: row.history_json,
        scaffoldState: row.scaffold_state ?? null,
      } as KnowledgeComponentState,
    ]);
    return Object.fromEntries(entries) as LearnerModelState;
  }

  async chain(
    learnerId: string,
    chainKey: string,
    configuration: LearningConfigurationPayload,
  ): Promise<LearnerModelState | null> {
    const userId = userIdOf(learnerId);
    if (userId === null) return null;
    const existing = await this.load(userId, chainKey);
    if (existing) return existing;
    const provisioned = provisionLearnerModel(configuration);
    if (provisioned === null) return null;
    // All five rows at once; a concurrent first use inserts nothing twice.
    await transaction(this.pool, async (connection) => {
      for (const kc of KNOWLEDGE_COMPONENT_IDS) {
        const state = provisioned[kc];
        await connection.query(
          `INSERT IGNORE INTO bkt_mastery_state
             (user_id, skill_id, configuration_sha256, current_probability, mastery_revision,
              scaffold_state, hints_enabled, mastery_json, history_json, last_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), UTC_TIMESTAMP(3))`,
          [
            userId,
            skillIdOf(kc),
            chainKey,
            state.mastery.masteryProbability,
            state.mastery.masteryRevision,
            state.scaffoldState,
            state.scaffoldState !== 'INDEPENDENT',
            JSON.stringify(state.mastery),
            JSON.stringify(state.history),
          ],
        );
      }
    });
    return this.load(userId, chainKey);
  }

  async commit(
    learnerId: string,
    chainKey: string,
    knowledgeComponentId: KnowledgeComponentId,
    expectedRevision: number,
    nextState: LearnerModelState,
    attempt: StoredAttempt,
  ): Promise<CommitResult> {
    const userId = userIdOf(learnerId);
    if (userId === null) return 'STALE_MASTERY_REVISION';
    const skillId = skillIdOf(knowledgeComponentId);
    const next = nextState[knowledgeComponentId];
    return transaction(this.pool, async (connection) => {
      // Fixed lock order: the mastery row first.
      const [locked] = await connection.query<RowDataPacket[]>(
        `SELECT mastery_revision FROM bkt_mastery_state
          WHERE user_id = ? AND configuration_sha256 = ? AND skill_id = ? FOR UPDATE`,
        [userId, chainKey, skillId],
      );
      if (locked.length !== 1 || Number(locked[0]?.mastery_revision) !== expectedRevision)
        return 'STALE_MASTERY_REVISION' as const;
      await connection.query(
        `UPDATE bkt_mastery_state
            SET current_probability = ?, mastery_revision = ?, scaffold_state = ?,
                hints_enabled = ?, mastery_json = CAST(? AS JSON),
                history_json = CAST(? AS JSON), last_updated = UTC_TIMESTAMP(3)
          WHERE user_id = ? AND configuration_sha256 = ? AND skill_id = ?`,
        [
          next.mastery.masteryProbability,
          next.mastery.masteryRevision,
          next.scaffoldState,
          next.scaffoldState !== 'INDEPENDENT',
          JSON.stringify(next.mastery),
          JSON.stringify(next.history),
          userId,
          chainKey,
          skillId,
        ],
      );
      const [sessions] = await connection.query<RowDataPacket[]>(
        'SELECT session_id FROM assessment_session WHERE lesson_uuid = ? AND user_id = ?',
        [attempt.lessonId, userId],
      );
      const sessionId = sessions[0]?.session_id;
      if (sessionId === undefined) throw new Error('The attempt has no assessment session.');
      const [order] = await connection.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS n FROM assessment_attempt WHERE session_id = ?',
        [sessionId],
      );
      await connection.query(
        `INSERT INTO assessment_attempt
           (session_id, skill_id, step_id, user_answer, is_correct, response_status, time_taken,
            bkt_state_before, bkt_state_after, hints_shown, scaffold_state, attempt_order,
            trace_json, attempt_timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?)`,
        [
          sessionId,
          skillId,
          attempt.stepId,
          attempt.userAnswer.slice(0, 255),
          attempt.responseStatus === 'SCORED_CORRECT'
            ? true
            : attempt.responseStatus === 'SCORED_INCORRECT'
              ? false
              : null,
          attempt.responseStatus,
          attempt.timeTakenSeconds,
          attempt.masteryBefore,
          attempt.masteryAfter,
          attempt.hintsShown,
          attempt.scaffoldFrom,
          Number(order[0]?.n ?? 0) + 1,
          JSON.stringify(attempt),
          mysqlTime(attempt.attemptedAt),
        ],
      );
      return 'COMMITTED' as const;
    });
  }

  async attempts(learnerId: string): Promise<readonly StoredAttempt[]> {
    const userId = userIdOf(learnerId);
    if (userId === null) return [];
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT a.trace_json FROM assessment_attempt a
         JOIN assessment_session s ON s.session_id = a.session_id
        WHERE s.user_id = ? ORDER BY a.attempt_id`,
      [userId],
    );
    return rows.map((row) => row.trace_json as StoredAttempt);
  }

  async openSession(session: StoredLessonSession): Promise<void> {
    const userId = userIdOf(session.learnerId);
    if (userId === null) throw new Error('Not an account learner.');
    await this.pool.query(
      `INSERT INTO assessment_session
         (lesson_uuid, user_id, location_name, dataset_id, scenario_id, route_id, start_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        session.lessonId,
        userId,
        session.locationName.slice(0, 100),
        session.datasetId,
        session.scenarioId,
        session.routeId,
        mysqlTime(session.startedAt),
      ],
    );
  }

  async closeSession(lessonId: string, endedAt: string): Promise<void> {
    await this.pool.query(
      'UPDATE assessment_session SET end_time = ? WHERE lesson_uuid = ? AND end_time IS NULL',
      [mysqlTime(endedAt), lessonId],
    );
  }
}

/** Routes development learners to memory and account learners to MySQL. */
export class CompositeLearnerStore implements LearnerStore {
  readonly kind = 'MYSQL' as const;

  constructor(
    private readonly development: LearnerStore | null,
    private readonly accounts: LearnerStore | null,
  ) {}

  private pick(learnerId: string): LearnerStore | null {
    return learnerId.startsWith(ACCOUNT_LEARNER_PREFIX) ? this.accounts : this.development;
  }

  async learnerExists(learnerId: string) {
    return (await this.pick(learnerId)?.learnerExists(learnerId)) ?? false;
  }
  async chain(learnerId: string, chainKey: string, configuration: LearningConfigurationPayload) {
    return (await this.pick(learnerId)?.chain(learnerId, chainKey, configuration)) ?? null;
  }
  async commit(
    learnerId: string,
    chainKey: string,
    knowledgeComponentId: KnowledgeComponentId,
    expectedRevision: number,
    nextState: LearnerModelState,
    attempt: StoredAttempt,
  ) {
    const store = this.pick(learnerId);
    if (!store) return 'STALE_MASTERY_REVISION' as const;
    return store.commit(
      learnerId,
      chainKey,
      knowledgeComponentId,
      expectedRevision,
      nextState,
      attempt,
    );
  }
  async attempts(learnerId: string) {
    return (await this.pick(learnerId)?.attempts(learnerId)) ?? [];
  }
  async openSession(session: StoredLessonSession) {
    await this.pick(session.learnerId)?.openSession(session);
  }
  async closeSession(lessonId: string, endedAt: string) {
    await Promise.all([
      this.development?.closeSession(lessonId, endedAt),
      this.accounts?.closeSession(lessonId, endedAt),
    ]);
  }
}
