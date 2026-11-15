/**
 * Demo accounts for local demonstrations and supervisor evaluations (owner request,
 * 2026-11-15): two administrators and two learners, all with the password 1234567. The
 * password is deliberately weak and public, so only the local seed command creates these
 * accounts and it refuses a production-like setup (see seed-demo.ts). Self-registration
 * still needs 8 to 64 characters.
 */
export const DEMO_PASSWORD = '1234567';
export const DEMO_ACCOUNTS = [
  { name: 'Admin One', email: 'admin1@ufuq.test', role: 'ADMIN' },
  { name: 'Admin Two', email: 'admin2@ufuq.test', role: 'ADMIN' },
  { name: 'Learner One', email: 'user1@ufuq.test', role: 'LEARNER' },
  { name: 'Learner Two', email: 'user2@ufuq.test', role: 'LEARNER' },
] as const;
