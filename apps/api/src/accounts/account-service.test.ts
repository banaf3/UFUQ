import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { parseLoginRequest, parseRegisterRequest } from '@ufuq/contracts';

import { createApp } from '../app.js';
import { DevelopmentLearnerRegistry } from '../learners/development-learners.js';
import { ACCOUNT_POLICY, AccountService, readCookie, sessionCookie } from './account-service.js';
import { InMemoryAccountStore } from './account-store.js';
import { hashPassword, verifyPassword } from './password.js';

describe('password storage (OWASP scrypt minimum)', () => {
  it('stores a salted scrypt hash and verifies only the right password', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).toMatch(/^scrypt\$17\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    expect(await hashPassword('correct horse battery')).not.toBe(stored); // fresh salt
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('correct horse batterY', stored)).toBe(false);
    expect(await verifyPassword('anything', 'plain-text')).toBe(false);
  }, 30_000);
});

describe('account requests (UC-101 rules)', () => {
  it('normalises the email and enforces 8 to 64 characters without composition rules', () => {
    expect(
      parseRegisterRequest({ name: ' Aisyah ', email: ' A@B.example ', password: 'eightchr' }),
    ).toEqual({ ok: true, value: { name: 'Aisyah', email: 'a@b.example', password: 'eightchr' } });
    expect(parseRegisterRequest({ name: 'x', email: 'a@b.example', password: 'short' }).ok).toBe(
      false,
    );
    expect(
      parseRegisterRequest({ name: 'x', email: 'a@b.example', password: 'x'.repeat(65) }).ok,
    ).toBe(false);
    expect(
      parseRegisterRequest({ name: 'x', email: 'not-an-email', password: 'long enough' }).ok,
    ).toBe(false);
    expect(
      parseRegisterRequest({ name: 'x', email: 'a@b.example', password: 'a@b.example' }).ok,
    ).toBe(false);
    expect(
      parseRegisterRequest({ name: 'x', email: 'a@b.example', password: 'p', role: 'ADMIN' }),
    ).toEqual({ ok: false, reason: 'Unknown field role.' });
    expect(parseLoginRequest({ email: 'A@B.example', password: 'p' })).toEqual({
      ok: true,
      value: { email: 'a@b.example', password: 'p' },
    });
  });
});

describe('account service (lockout and sessions)', () => {
  it('locks after the policy count of failures and unlocks after the lock time', async () => {
    let now = new Date('2026-11-15T00:00:00Z');
    const store = new InMemoryAccountStore();
    const service = new AccountService(store, () => now);
    await service.register({ name: 'A', email: 'a@b.example', password: 'right password' });
    for (let i = 1; i < ACCOUNT_POLICY.maximumConsecutiveFailures; i += 1)
      await expect(
        service.login({ email: 'a@b.example', password: 'wrong' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    // A success resets the count, so the next failures start again from one.
    await service.login({ email: 'a@b.example', password: 'right password' });
    expect(store.users[0]?.failedLoginCount).toBe(0);
    for (let i = 0; i < ACCOUNT_POLICY.maximumConsecutiveFailures; i += 1)
      await expect(service.login({ email: 'a@b.example', password: 'wrong' })).rejects.toBeTruthy();
    await expect(
      service.login({ email: 'a@b.example', password: 'right password' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
    now = new Date(now.getTime() + ACCOUNT_POLICY.lockMinutes * 60_000 + 1);
    const { token } = await service.login({ email: 'a@b.example', password: 'right password' });
    expect((await service.userForToken(token))?.email).toBe('a@b.example');
    // Unknown emails get the same answer as wrong passwords.
    await expect(service.login({ email: 'x@b.example', password: 'p' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    // Sessions expire and are stored only as a hash.
    expect([...store.sessions.keys()].every((key) => /^[0-9a-f]{64}$/.test(key))).toBe(true);
    now = new Date(now.getTime() + ACCOUNT_POLICY.sessionHours * 3_600_000 + 1);
    expect(await service.userForToken(token)).toBeNull();
  }, 60_000);

  it('writes HttpOnly SameSite=Strict cookies and reads them back', () => {
    const cookie = sessionCookie('abc', true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Secure');
    expect(readCookie('a=1; ufuq_session=abc; b=2', 'ufuq_session')).toBe('abc');
    expect(readCookie(undefined, 'ufuq_session')).toBeUndefined();
  });
});

describe('HTTP accounts without and with a store', () => {
  it('reports accounts unavailable without a database', async () => {
    const response = await request(createApp()).get('/api/v2/auth/me');
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('ACCOUNTS_UNAVAILABLE');
  });

  it('registers, signs in, and keeps an account lesson to its own account', async () => {
    const accounts = new InMemoryAccountStore();
    const learners = new DevelopmentLearnerRegistry();
    const app = createApp({
      accounts: { accountStore: accounts, learnerStore: learners, reports: null },
    });
    const agent = request.agent(app);
    const registered = await agent
      .post('/api/v2/auth/register')
      .send({ name: 'Learner', email: 'l@b.example', password: 'a long password' });
    expect(registered.status).toBe(201);
    expect(registered.body).toMatchObject({ learnerId: 'u-1', role: 'LEARNER' });
    expect(
      (
        await request(app)
          .post('/api/v2/auth/register')
          .send({ name: 'x', email: 'l@b.example', password: 'another one!' })
      ).status,
    ).toBe(409);
    expect((await agent.get('/api/v2/auth/me')).body.email).toBe('l@b.example');
    // Analytics are for administrators only, and the refusal is logged.
    expect((await agent.get('/api/v2/admin/analytics')).status).toBe(403);
    expect(accounts.logs.map((log) => log.eventType)).toContain('ACCESS_DENIED');
    // Someone else's lesson cannot be created.
    const lesson = (learnerId: string, client = agent) =>
      client.post('/api/v2/lessons').send({
        contractVersion: 'lesson.v2',
        datasetId: 'synthetic-technical',
        executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
        scenarioId: 'synthetic-scenario-a',
        learnerId,
        sessionPurpose: 'LEARNING',
      });
    expect((await lesson('u-2')).status).toBe(403);
    expect((await lesson('u-1', request.agent(app))).status).toBe(401);
    expect((await agent.post('/api/v2/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/v2/auth/me')).status).toBe(401);
  }, 30_000);
});
