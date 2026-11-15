/**
 * Account persistence port (report tables 3-7 and 3-12 plus sessions) with a MySQL adapter
 * and an in-memory adapter for unit tests.
 */
import type { AccountRoleV1 } from '@ufuq/contracts';

import { type Pool, type RowDataPacket } from '../persistence/mysql.js';

export interface UserRecord {
  readonly userId: number;
  readonly role: AccountRoleV1;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly failedLoginCount: number;
  readonly lockedUntil: Date | null;
  readonly createdDate: Date;
}

export interface AccountStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(userId: number): Promise<UserRecord | null>;
  /** Null when the email is already registered. */
  create(user: {
    role: AccountRoleV1;
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRecord | null>;
  setLoginFailures(userId: number, count: number, lockedUntil: Date | null): Promise<void>;
  createSession(tokenHash: string, userId: number, expiresAt: Date): Promise<void>;
  findSession(tokenHash: string): Promise<{ userId: number; expiresAt: Date } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  log(userId: number | null, eventType: string, description: string): Promise<void>;
}

const userOf = (row: RowDataPacket): UserRecord => ({
  userId: Number(row.user_id),
  role: row.role,
  name: row.name,
  email: row.email,
  passwordHash: row.password_hash,
  failedLoginCount: Number(row.failed_login_count),
  lockedUntil: row.locked_until ?? null,
  createdDate: row.created_date,
});

export class MySqlAccountStore implements AccountStore {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM app_user WHERE email = ?',
      [email],
    );
    return rows[0] ? userOf(rows[0]) : null;
  }

  async findById(userId: number) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM app_user WHERE user_id = ?',
      [userId],
    );
    return rows[0] ? userOf(rows[0]) : null;
  }

  async create(user: { role: AccountRoleV1; name: string; email: string; passwordHash: string }) {
    try {
      const [result] = await this.pool.query<RowDataPacket[] & { insertId: number }>(
        `INSERT INTO app_user (role, name, email, password_hash, created_date)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [user.role, user.name, user.email, user.passwordHash],
      );
      return this.findById(Number((result as unknown as { insertId: number }).insertId));
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return null;
      throw error;
    }
  }

  async setLoginFailures(userId: number, count: number, lockedUntil: Date | null) {
    await this.pool.query(
      'UPDATE app_user SET failed_login_count = ?, locked_until = ? WHERE user_id = ?',
      [count, lockedUntil, userId],
    );
  }

  async createSession(tokenHash: string, userId: number, expiresAt: Date) {
    await this.pool.query(
      `INSERT INTO auth_session (token_hash, user_id, created_at, expires_at)
       VALUES (?, ?, UTC_TIMESTAMP(3), ?)`,
      [tokenHash, userId, expiresAt],
    );
  }

  async findSession(tokenHash: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT user_id, expires_at FROM auth_session WHERE token_hash = ?',
      [tokenHash],
    );
    const row = rows[0];
    return row ? { userId: Number(row.user_id), expiresAt: row.expires_at as Date } : null;
  }

  async deleteSession(tokenHash: string) {
    await this.pool.query('DELETE FROM auth_session WHERE token_hash = ?', [tokenHash]);
  }

  async log(userId: number | null, eventType: string, description: string) {
    await this.pool.query(
      `INSERT INTO system_log (user_id, event_type, event_description, timestamp)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
      [userId, eventType.slice(0, 50), description],
    );
  }
}

/** In-memory adapter for unit tests; never composed by the server. */
export class InMemoryAccountStore implements AccountStore {
  readonly users: UserRecord[] = [];
  readonly sessions = new Map<string, { userId: number; expiresAt: Date }>();
  readonly logs: { userId: number | null; eventType: string; description: string }[] = [];

  findByEmail(email: string) {
    return Promise.resolve(this.users.find((u) => u.email === email) ?? null);
  }
  findById(userId: number) {
    return Promise.resolve(this.users.find((u) => u.userId === userId) ?? null);
  }
  create(user: { role: AccountRoleV1; name: string; email: string; passwordHash: string }) {
    if (this.users.some((u) => u.email === user.email)) return Promise.resolve(null);
    const record: UserRecord = {
      ...user,
      userId: this.users.length + 1,
      failedLoginCount: 0,
      lockedUntil: null,
      createdDate: new Date(),
    };
    this.users.push(record);
    return Promise.resolve(record);
  }
  setLoginFailures(userId: number, count: number, lockedUntil: Date | null) {
    const index = this.users.findIndex((u) => u.userId === userId);
    const user = this.users[index];
    if (user) this.users[index] = { ...user, failedLoginCount: count, lockedUntil };
    return Promise.resolve();
  }
  createSession(tokenHash: string, userId: number, expiresAt: Date) {
    this.sessions.set(tokenHash, { userId, expiresAt });
    return Promise.resolve();
  }
  findSession(tokenHash: string) {
    return Promise.resolve(this.sessions.get(tokenHash) ?? null);
  }
  deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
    return Promise.resolve();
  }
  log(userId: number | null, eventType: string, description: string) {
    this.logs.push({ userId, eventType, description });
    return Promise.resolve();
  }
}
