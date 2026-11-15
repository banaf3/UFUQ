/**
 * Demo accounts for local demonstrations and supervisor evaluations (owner request,
 * 2026-11-15): two administrators and two learners, all with the password 1234567.
 *
 * That password is deliberately weak and is known to everyone who reads this file, so the
 * command refuses to run for a production-like composition (UFUQ_SECURE_COOKIES=1 or
 * NODE_ENV=production). Self-registration still needs a password of 8 to 64 characters.
 * It is idempotent: an account that exists is left as it is.
 *
 *   UFUQ_MYSQL_URL=... npm run db:seed-demo
 */
import { AccountError, AccountService } from './accounts/account-service.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './accounts/demo-accounts.js';
import { MySqlAccountStore } from './accounts/account-store.js';
import { createPool, migrate } from './persistence/mysql.js';

const url = process.env.UFUQ_MYSQL_URL;
if (!url) {
  console.error('UFUQ_MYSQL_URL is required.');
  process.exit(2);
}
if (process.env.UFUQ_SECURE_COOKIES === '1' || process.env.NODE_ENV === 'production') {
  console.error('Refusing to create weak-password demo accounts in a production-like setup.');
  process.exit(2);
}
const pool = createPool(url);
try {
  await migrate(pool);
  const service = new AccountService(new MySqlAccountStore(pool));
  for (const account of DEMO_ACCOUNTS) {
    try {
      await service.register(
        { name: account.name, email: account.email, password: DEMO_PASSWORD },
        account.role,
      );
      console.log(`Created ${account.role} ${account.email}.`);
    } catch (error) {
      if (error instanceof AccountError && error.code === 'EMAIL_TAKEN')
        console.log(`Kept ${account.email} (already exists).`);
      else throw error;
    }
  }
} finally {
  await pool.end();
}
