/**
 * Read-only progress (report UC-104) and analytics (UC-105) queries. A learner sees only
 * their own rows; analytics are aggregates and the recent system log, never edits.
 */
import {
  ACCOUNT_CONTRACT_VERSION,
  type AnalyticsV1,
  type ProgressV1,
  type SkillProgressV1,
} from '@ufuq/contracts';

import { type Pool, type RowDataPacket } from '../persistence/mysql.js';
import { publicUser } from './account-service.js';
import type { UserRecord } from './account-store.js';

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : null);

export interface ReportContext {
  /** The current learning configuration's payload hash and threshold. */
  readonly configurationSha256: string | null;
  readonly masteryThreshold: number | null;
}

export interface ReportStore {
  progress(user: UserRecord, context: ReportContext): Promise<ProgressV1>;
  analytics(context: ReportContext): Promise<AnalyticsV1>;
}

export class MySqlReportStore implements ReportStore {
  constructor(private readonly pool: Pool) {}

  async progress(user: UserRecord, context: ReportContext): Promise<ProgressV1> {
    const [skills] = await this.pool.query<RowDataPacket[]>(
      `SELECT s.kc_code, s.skill_name, m.current_probability, m.scaffold_state, m.last_updated,
              (SELECT COUNT(*) FROM assessment_attempt a JOIN assessment_session x
                 ON x.session_id = a.session_id
                WHERE x.user_id = ? AND a.skill_id = s.skill_id) AS attempts,
              (SELECT COUNT(*) FROM assessment_attempt a JOIN assessment_session x
                 ON x.session_id = a.session_id
                WHERE x.user_id = ? AND a.skill_id = s.skill_id AND a.is_correct) AS correct
         FROM cognitive_skill s
         LEFT JOIN bkt_mastery_state m
           ON m.skill_id = s.skill_id AND m.user_id = ? AND m.configuration_sha256 = ?
        ORDER BY s.skill_id`,
      [user.userId, user.userId, user.userId, context.configurationSha256 ?? ''],
    );
    const [sessions] = await this.pool.query<RowDataPacket[]>(
      `SELECT x.lesson_uuid, x.location_name, x.route_id, x.start_time, x.end_time,
              COUNT(a.attempt_id) AS attempts, COALESCE(SUM(a.is_correct), 0) AS correct
         FROM assessment_session x LEFT JOIN assessment_attempt a ON a.session_id = x.session_id
        WHERE x.user_id = ?
        GROUP BY x.session_id ORDER BY x.start_time DESC LIMIT 20`,
      [user.userId],
    );
    const [attempts] = await this.pool.query<RowDataPacket[]>(
      `SELECT a.attempt_timestamp, s.kc_code, a.step_id, a.response_status, a.hints_shown,
              a.scaffold_state, a.bkt_state_before, a.bkt_state_after, a.time_taken
         FROM assessment_attempt a
         JOIN assessment_session x ON x.session_id = a.session_id
         JOIN cognitive_skill s ON s.skill_id = a.skill_id
        WHERE x.user_id = ? ORDER BY a.attempt_id DESC LIMIT 50`,
      [user.userId],
    );
    return {
      contractVersion: ACCOUNT_CONTRACT_VERSION,
      user: publicUser(user),
      masteryThreshold: context.masteryThreshold,
      skills: skills.map((row): SkillProgressV1 => ({
        knowledgeComponentId: row.kc_code,
        name: row.skill_name,
        masteryProbability:
          row.current_probability === null ? null : Number(row.current_probability),
        scaffoldState: row.scaffold_state ?? null,
        attempts: Number(row.attempts),
        correct: Number(row.correct),
        lastUpdated: iso(row.last_updated),
      })),
      sessions: sessions.map((row) => ({
        lessonId: row.lesson_uuid,
        locationName: row.location_name,
        routeId: row.route_id,
        startTime: iso(row.start_time) as string,
        endTime: iso(row.end_time),
        attempts: Number(row.attempts),
        correct: Number(row.correct),
      })),
      attempts: attempts.map((row) => ({
        time: iso(row.attempt_timestamp) as string,
        knowledgeComponentId: row.kc_code,
        stepId: row.step_id,
        responseStatus: row.response_status,
        hintsShown: Boolean(row.hints_shown),
        scaffoldState: row.scaffold_state ?? null,
        masteryBefore: Number(row.bkt_state_before),
        masteryAfter: Number(row.bkt_state_after),
        timeTakenSeconds: Number(row.time_taken),
      })),
    };
  }

  async analytics(context: ReportContext): Promise<AnalyticsV1> {
    const one = async (sql: string, params: unknown[] = []) => {
      const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
      return Number(rows[0]?.n ?? 0);
    };
    const threshold = context.masteryThreshold ?? 2; // no threshold: nobody counts as at it
    const [skills] = await this.pool.query<RowDataPacket[]>(
      `SELECT s.kc_code, s.skill_name,
              COUNT(m.mastery_id) AS learners,
              AVG(m.current_probability) AS mean_mastery,
              COALESCE(SUM(m.current_probability >= ?), 0) AS at_threshold,
              (SELECT COUNT(*) FROM assessment_attempt a WHERE a.skill_id = s.skill_id) AS attempts,
              (SELECT COUNT(*) FROM assessment_attempt a
                WHERE a.skill_id = s.skill_id AND a.is_correct) AS correct
         FROM cognitive_skill s
         LEFT JOIN bkt_mastery_state m
           ON m.skill_id = s.skill_id AND m.configuration_sha256 = ?
        GROUP BY s.skill_id ORDER BY s.skill_id`,
      [threshold, context.configurationSha256 ?? ''],
    );
    const [days] = await this.pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(attempt_timestamp, '%Y-%m-%d') AS day, COUNT(*) AS attempts
         FROM assessment_attempt
        WHERE attempt_timestamp >= UTC_TIMESTAMP(3) - INTERVAL 14 DAY
        GROUP BY day ORDER BY day`,
    );
    const [logs] = await this.pool.query<RowDataPacket[]>(
      `SELECT timestamp, event_type, event_description, user_id
         FROM system_log ORDER BY log_id DESC LIMIT 50`,
    );
    return {
      contractVersion: ACCOUNT_CONTRACT_VERSION,
      totals: {
        learners: await one(`SELECT COUNT(*) AS n FROM app_user WHERE role = 'LEARNER'`),
        administrators: await one(`SELECT COUNT(*) AS n FROM app_user WHERE role = 'ADMIN'`),
        sessions: await one('SELECT COUNT(*) AS n FROM assessment_session'),
        completedSessions: await one(
          'SELECT COUNT(*) AS n FROM assessment_session WHERE end_time IS NOT NULL',
        ),
        attempts: await one('SELECT COUNT(*) AS n FROM assessment_attempt'),
        correctAttempts: await one('SELECT COUNT(*) AS n FROM assessment_attempt WHERE is_correct'),
      },
      masteryThreshold: context.masteryThreshold,
      skills: skills.map((row) => ({
        knowledgeComponentId: row.kc_code,
        name: row.skill_name,
        learners: Number(row.learners),
        meanMastery: row.mean_mastery === null ? null : Number(row.mean_mastery),
        learnersAtThreshold: Number(row.at_threshold),
        attempts: Number(row.attempts),
        correct: Number(row.correct),
      })),
      attemptsByDay: days.map((row) => ({ day: row.day, attempts: Number(row.attempts) })),
      recentLogs: logs.map((row) => ({
        time: iso(row.timestamp) as string,
        eventType: row.event_type,
        description: row.event_description,
        userId: row.user_id === null ? null : Number(row.user_id),
      })),
    };
  }
}
