/**
 * MySQL 8.4 / InnoDB schema (IMP-015), following the founding report's data design
 * (ERD figure 3-9, tables 3-7 to 3-12) with the additions the implemented learner model
 * needs. Table names are lower-case; `user` is a reserved word, so the report's USER table
 * is `app_user`. Probabilities are DOUBLE (the report's FLOAT is single precision, which
 * would break the BKT reference comparison at 1e-14). Applied in order, once each, by
 * `migrate`; a migration is never edited after release, only followed by a new one.
 */
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'report data design: users, skills, mastery, sessions, attempts, logs',
    statements: [
      `CREATE TABLE app_user (
        user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        role ENUM('LEARNER', 'ADMIN') NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
        locked_until DATETIME(3) NULL,
        created_date DATETIME(3) NOT NULL,
        PRIMARY KEY (user_id),
        UNIQUE KEY uq_app_user_email (email)
      ) ENGINE=InnoDB`,
      `CREATE TABLE auth_session (
        token_hash CHAR(64) NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        PRIMARY KEY (token_hash),
        KEY ix_auth_session_user (user_id),
        CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES app_user (user_id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB`,
      `CREATE TABLE cognitive_skill (
        skill_id TINYINT UNSIGNED NOT NULL,
        kc_code CHAR(5) NOT NULL,
        skill_name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        PRIMARY KEY (skill_id),
        UNIQUE KEY uq_cognitive_skill_kc (kc_code)
      ) ENGINE=InnoDB`,
      `INSERT INTO cognitive_skill (skill_id, kc_code, skill_name, description) VALUES
        (1, 'KC-01', 'Identify Banat Na''sh', 'Recognise the greater Banat Na''sh among the northern stars.'),
        (2, 'KC-02', 'Recognise Dhat al-Kursi', 'Recognise the five-star W of Dhat al-Kursi (al-Kaff al-Khadib).'),
        (3, 'KC-03', 'Locate Al-Jady/Polaris', 'Trace from a recognised figure to al-Jady near the celestial pole.'),
        (4, 'KC-04', 'Estimate True North', 'Face the point on the horizon directly below al-Jady.'),
        (5, 'KC-05', 'Derive Qibla from True North', 'Turn from True North by the Qibla bearing of the place.')`,
      `CREATE TABLE bkt_mastery_state (
        mastery_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        skill_id TINYINT UNSIGNED NOT NULL,
        configuration_sha256 CHAR(64) NOT NULL,
        current_probability DOUBLE NOT NULL,
        mastery_revision INT UNSIGNED NOT NULL,
        scaffold_state ENUM('GUIDED', 'FADING', 'INDEPENDENT') NULL,
        hints_enabled BOOLEAN NOT NULL,
        mastery_json JSON NOT NULL,
        history_json JSON NOT NULL,
        last_updated DATETIME(3) NOT NULL,
        PRIMARY KEY (mastery_id),
        UNIQUE KEY uq_mastery_chain (user_id, configuration_sha256, skill_id),
        KEY ix_mastery_skill (skill_id),
        CONSTRAINT fk_mastery_user FOREIGN KEY (user_id) REFERENCES app_user (user_id)
          ON DELETE CASCADE,
        CONSTRAINT fk_mastery_skill FOREIGN KEY (skill_id) REFERENCES cognitive_skill (skill_id),
        CONSTRAINT ck_mastery_probability CHECK (current_probability BETWEEN 0 AND 1)
      ) ENGINE=InnoDB`,
      `CREATE TABLE assessment_session (
        session_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        lesson_uuid CHAR(36) NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        location_name VARCHAR(100) NOT NULL,
        dataset_id VARCHAR(128) NOT NULL,
        scenario_id VARCHAR(128) NOT NULL,
        route_id VARCHAR(128) NOT NULL,
        start_time DATETIME(3) NOT NULL,
        end_time DATETIME(3) NULL,
        PRIMARY KEY (session_id),
        UNIQUE KEY uq_assessment_session_lesson (lesson_uuid),
        KEY ix_assessment_session_user (user_id),
        CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES app_user (user_id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB`,
      `CREATE TABLE assessment_attempt (
        attempt_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        session_id INT UNSIGNED NOT NULL,
        skill_id TINYINT UNSIGNED NOT NULL,
        step_id VARCHAR(64) NOT NULL,
        user_answer VARCHAR(255) NOT NULL,
        is_correct BOOLEAN NULL,
        response_status VARCHAR(32) NOT NULL,
        time_taken INT UNSIGNED NOT NULL,
        bkt_state_before DOUBLE NOT NULL,
        bkt_state_after DOUBLE NOT NULL,
        hints_shown BOOLEAN NOT NULL,
        scaffold_state VARCHAR(16) NULL,
        attempt_order INT UNSIGNED NOT NULL,
        trace_json JSON NOT NULL,
        attempt_timestamp DATETIME(3) NOT NULL,
        PRIMARY KEY (attempt_id),
        KEY ix_attempt_session (session_id),
        KEY ix_attempt_skill (skill_id),
        CONSTRAINT fk_attempt_session FOREIGN KEY (session_id)
          REFERENCES assessment_session (session_id) ON DELETE CASCADE,
        CONSTRAINT fk_attempt_skill FOREIGN KEY (skill_id) REFERENCES cognitive_skill (skill_id)
      ) ENGINE=InnoDB`,
      `CREATE TABLE system_log (
        log_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NULL,
        event_type VARCHAR(50) NOT NULL,
        event_description TEXT NOT NULL,
        timestamp DATETIME(3) NOT NULL,
        PRIMARY KEY (log_id),
        KEY ix_system_log_time (timestamp),
        CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES app_user (user_id)
          ON DELETE SET NULL
      ) ENGINE=InnoDB`,
    ],
  },
];
