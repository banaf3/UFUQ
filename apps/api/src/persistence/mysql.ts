/**
 * MySQL connection and migrations (IMP-015). The exact profile is MySQL 8.4 LTS, InnoDB,
 * utf8mb4, UTC session time zone, READ COMMITTED isolation for attempt transactions with
 * row locks taken in a fixed order (the mastery row, then the attempt insert).
 */
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';

import { MIGRATIONS } from './migrations.js';

export type { Pool, PoolConnection, RowDataPacket };

export function createPool(url: string): Pool {
  return mysql.createPool({
    uri: url,
    connectionLimit: 10,
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    // Return DECIMAL and BIGINT as numbers within the safe range only.
    decimalNumbers: true,
  });
}

/** Applies every migration not yet recorded, each in its own transaction-less step. */
export async function migrate(pool: Pool): Promise<number[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migration (
    version INT UNSIGNED NOT NULL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    applied_at DATETIME(3) NOT NULL
  ) ENGINE=InnoDB`);
  const [rows] = await pool.query<RowDataPacket[]>('SELECT version FROM schema_migration');
  const applied = new Set(rows.map((row) => Number(row.version)));
  const ran: number[] = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    // MySQL DDL commits implicitly; a failed migration leaves an unrecorded version that
    // must be repaired by hand, never re-run blindly.
    for (const statement of migration.statements) await pool.query(statement);
    await pool.query(
      'INSERT INTO schema_migration (version, name, applied_at) VALUES (?, ?, UTC_TIMESTAMP(3))',
      [migration.version, migration.name],
    );
    ran.push(migration.version);
  }
  return ran;
}

/** Runs `work` in one READ COMMITTED transaction; rolls back on any error. */
export async function transaction<T>(
  pool: Pool,
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
