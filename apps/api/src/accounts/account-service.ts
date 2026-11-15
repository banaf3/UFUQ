/**
 * Accounts (report UC-101). Registration creates a LEARNER; administrators are created
 * only from the command line (`npm run admin:create`). Sessions are random 256-bit tokens
 * in an HttpOnly, SameSite=Strict cookie; only their SHA-256 is stored.
 *
 * Provisional account policy (IMP-017, owner review): passwords of 8 to 64 characters with
 * no composition rules (OWASP ASVS 5.0 V6.2); five consecutive failed logins lock the
 * account for 15 minutes (the report's UC-101 E1 asks for a temporary lock, without
 * numbers); sessions expire after 8 hours.
 */
import { createHash, randomBytes } from 'node:crypto';

import {
  ACCOUNT_CONTRACT_VERSION,
  type AccountRoleV1,
  type AccountUserV1,
  type LoginRequestV1,
  type RegisterRequestV1,
} from '@ufuq/contracts';

import type { AccountStore, UserRecord } from './account-store.js';
import { dummyHash, hashPassword, verifyPassword } from './password.js';

export const SESSION_COOKIE = 'ufuq_session';
export const ACCOUNT_POLICY = {
  maximumConsecutiveFailures: 5,
  lockMinutes: 15,
  sessionHours: 8,
} as const;

export class AccountError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const tokenHash = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

export function publicUser(user: UserRecord): AccountUserV1 {
  return {
    contractVersion: ACCOUNT_CONTRACT_VERSION,
    learnerId: `u-${user.userId}`,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export class AccountService {
  constructor(
    private readonly store: AccountStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async register(request: RegisterRequestV1, role: AccountRoleV1 = 'LEARNER') {
    const user = await this.store.create({
      role,
      name: request.name,
      email: request.email,
      passwordHash: await hashPassword(request.password),
    });
    if (!user)
      throw new AccountError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    await this.store.log(user.userId, 'REGISTER', `${role} account created.`);
    return user;
  }

  /** Returns the user and a new session token, or throws an AccountError. */
  async login(request: LoginRequestV1): Promise<{ user: UserRecord; token: string }> {
    const user = await this.store.findByEmail(request.email);
    const now = this.now();
    if (!user) {
      await verifyPassword(request.password, await dummyHash()); // same work either way
      await this.store.log(null, 'LOGIN_FAILURE', 'Unknown email.');
      throw new AccountError(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      await this.store.log(user.userId, 'LOGIN_LOCKED', 'Login refused while locked.');
      throw new AccountError(
        423,
        'ACCOUNT_LOCKED',
        `Too many failed attempts. Try again after ${ACCOUNT_POLICY.lockMinutes} minutes.`,
      );
    }
    if (!(await verifyPassword(request.password, user.passwordHash))) {
      const failures = (user.lockedUntil ? 0 : user.failedLoginCount) + 1;
      const lock = failures >= ACCOUNT_POLICY.maximumConsecutiveFailures;
      await this.store.setLoginFailures(
        user.userId,
        lock ? 0 : failures,
        lock ? new Date(now.getTime() + ACCOUNT_POLICY.lockMinutes * 60_000) : null,
      );
      await this.store.log(
        user.userId,
        lock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILURE',
        lock ? 'Locked after consecutive failures.' : `Failure ${failures}.`,
      );
      throw new AccountError(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');
    }
    if (user.failedLoginCount > 0 || user.lockedUntil)
      await this.store.setLoginFailures(user.userId, 0, null);
    await this.store.log(user.userId, 'LOGIN_SUCCESS', 'Signed in.');
    return { user, token: await this.startSession(user) };
  }

  /** Issues a new session token for a user (after login or registration). */
  async startSession(user: UserRecord): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.store.createSession(
      tokenHash(token),
      user.userId,
      new Date(this.now().getTime() + ACCOUNT_POLICY.sessionHours * 3_600_000),
    );
    return token;
  }

  async userForToken(token: string | undefined): Promise<UserRecord | null> {
    if (!token || token.length > 128) return null;
    const session = await this.store.findSession(tokenHash(token));
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      await this.store.deleteSession(tokenHash(token));
      return null;
    }
    return this.store.findById(session.userId);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const user = await this.userForToken(token);
    await this.store.deleteSession(tokenHash(token));
    if (user) await this.store.log(user.userId, 'LOGOUT', 'Signed out.');
  }

  log(userId: number | null, eventType: string, description: string) {
    return this.store.log(userId, eventType, description);
  }
}

/** Reads one cookie from a Cookie header without a dependency. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name)
      return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${ACCOUNT_POLICY.sessionHours * 3600}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export const clearedSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
