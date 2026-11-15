/**
 * Creates an administrator account (report UC-105). Administrators are never created over
 * HTTP. The password is read from UFUQ_ADMIN_PASSWORD, so it never appears in the command
 * line or shell history:
 *
 *   UFUQ_MYSQL_URL=... UFUQ_ADMIN_PASSWORD=... npm run admin:create -- "Full Name" email@example.com
 */
import { parseRegisterRequest } from '@ufuq/contracts';

import { AccountError, AccountService } from './accounts/account-service.js';
import { MySqlAccountStore } from './accounts/account-store.js';
import { createPool, migrate } from './persistence/mysql.js';

const [name, email] = process.argv.slice(2);
const url = process.env.UFUQ_MYSQL_URL;
const password = process.env.UFUQ_ADMIN_PASSWORD;
if (!url || !password || !name || !email) {
  console.error(
    'Usage: UFUQ_MYSQL_URL=... UFUQ_ADMIN_PASSWORD=... npm run admin:create -- "Name" email',
  );
  process.exit(2);
}
const parsed = parseRegisterRequest({ name, email, password });
if (!parsed.ok) {
  console.error(parsed.reason);
  process.exit(2);
}
const pool = createPool(url);
try {
  await migrate(pool);
  const user = await new AccountService(new MySqlAccountStore(pool)).register(
    parsed.value,
    'ADMIN',
  );
  console.log(`Administrator ${user.email} created (user ${user.userId}).`);
} catch (error) {
  console.error(error instanceof AccountError ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
