/**
 * Account, progress and analytics contracts (account.v1; report UC-101, UC-104, UC-105).
 * Probabilities are model estimates of the learner's mastery, never grades (report
 * section 2.5.5): the web labels them so.
 */

export type AccountContractVersion = 'account.v1';
export const ACCOUNT_CONTRACT_VERSION: AccountContractVersion = 'account.v1';

export type AccountRoleV1 = 'LEARNER' | 'ADMIN';

export interface AccountUserV1 {
  readonly contractVersion: AccountContractVersion;
  /** The learner id lessons use for this account (`u-<id>`). */
  readonly learnerId: string;
  readonly name: string;
  readonly email: string;
  readonly role: AccountRoleV1;
}

export interface RegisterRequestV1 {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export interface LoginRequestV1 {
  readonly email: string;
  readonly password: string;
}

export interface SkillProgressV1 {
  readonly knowledgeComponentId: string;
  readonly name: string;
  /** Null until the learner has a mastery row for the current configuration. */
  readonly masteryProbability: number | null;
  readonly scaffoldState: 'GUIDED' | 'FADING' | 'INDEPENDENT' | null;
  readonly attempts: number;
  readonly correct: number;
  readonly lastUpdated: string | null;
}

export interface ProgressV1 {
  readonly contractVersion: AccountContractVersion;
  readonly user: AccountUserV1;
  /** The configuration's mastery threshold, when it has one. */
  readonly masteryThreshold: number | null;
  readonly skills: readonly SkillProgressV1[];
  readonly sessions: readonly {
    readonly lessonId: string;
    readonly locationName: string;
    readonly routeId: string;
    readonly startTime: string;
    readonly endTime: string | null;
    readonly attempts: number;
    readonly correct: number;
  }[];
  readonly attempts: readonly {
    readonly time: string;
    readonly knowledgeComponentId: string;
    readonly stepId: string;
    readonly responseStatus: string;
    readonly hintsShown: boolean;
    readonly scaffoldState: string | null;
    readonly masteryBefore: number;
    readonly masteryAfter: number;
    readonly timeTakenSeconds: number;
  }[];
}

export interface AnalyticsV1 {
  readonly contractVersion: AccountContractVersion;
  readonly totals: {
    readonly learners: number;
    readonly administrators: number;
    readonly sessions: number;
    readonly completedSessions: number;
    readonly attempts: number;
    readonly correctAttempts: number;
  };
  readonly masteryThreshold: number | null;
  readonly skills: readonly {
    readonly knowledgeComponentId: string;
    readonly name: string;
    readonly learners: number;
    readonly meanMastery: number | null;
    readonly learnersAtThreshold: number;
    readonly attempts: number;
    readonly correct: number;
  }[];
  readonly attemptsByDay: readonly { readonly day: string; readonly attempts: number }[];
  readonly recentLogs: readonly {
    readonly time: string;
    readonly eventType: string;
    readonly description: string;
    readonly userId: number | null;
  }[];
}

type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

function fields(value: unknown, allowed: readonly string[]): Record<string, unknown> | string {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return 'Body must be an object.';
  const body = value as Record<string, unknown>;
  for (const key of Object.keys(body)) if (!allowed.includes(key)) return `Unknown field ${key}.`;
  return body;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,63}\.[^\s@]{2,}$/;
/** OWASP ASVS 5.0 V6.2: at least 8 characters, at least 64 allowed, no composition rules. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export function parseRegisterRequest(value: unknown): Parsed<RegisterRequestV1> {
  const body = fields(value, ['name', 'email', 'password']);
  if (typeof body === 'string') return { ok: false, reason: body };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (name.length < 1 || name.length > 100) return { ok: false, reason: 'Enter your name.' };
  if (email.length > 100 || !EMAIL.test(email))
    return { ok: false, reason: 'Enter a valid email address.' };
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH)
    return {
      ok: false,
      reason: `Use a password of ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.`,
    };
  if (password.toLowerCase() === email)
    return { ok: false, reason: 'Do not use your email address as the password.' };
  return { ok: true, value: { name, email, password } };
}

export function parseLoginRequest(value: unknown): Parsed<LoginRequestV1> {
  const body = fields(value, ['email', 'password']);
  if (typeof body === 'string') return { ok: false, reason: body };
  if (typeof body.email !== 'string' || typeof body.password !== 'string')
    return { ok: false, reason: 'Email and password are required.' };
  if (body.email.length > 100 || body.password.length > 4 * PASSWORD_MAX_LENGTH)
    return { ok: false, reason: 'Email or password is too long.' };
  return { ok: true, value: { email: body.email.trim().toLowerCase(), password: body.password } };
}
