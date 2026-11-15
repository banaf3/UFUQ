import { MySqlAccountStore } from './accounts/account-store.js';
import { MySqlReportStore } from './accounts/reports.js';
import { type AppOptions, createApp } from './app.js';
import { createPool, migrate } from './persistence/mysql.js';
import { MySqlLearnerStore } from './persistence/mysql-learner-store.js';

const port = Number.parseInt(process.env.PORT ?? '4174', 10);
// REVIEW_PREVIEW is an explicit local reviewer opt-in; it is never on by default.
const enableReviewPreview = process.env.UFUQ_ENABLE_REVIEW_PREVIEW === '1';
// IMP-016 development fixture identity: explicit local opt-in; never set in production.
const enableDevelopmentIdentity = process.env.UFUQ_ENABLE_DEVELOPMENT_IDENTITY === '1';
const dataDirectory = process.env.UFUQ_DATA_DIR;
// Accounts and durable learner models (IMP-015): MySQL 8.4, migrated on start.
const mysqlUrl = process.env.UFUQ_MYSQL_URL;

let accounts: AppOptions['accounts'];
if (mysqlUrl) {
  const pool = createPool(mysqlUrl);
  const ran = await migrate(pool);
  if (ran.length > 0) console.log(`Applied database migrations ${ran.join(', ')}.`);
  accounts = {
    accountStore: new MySqlAccountStore(pool),
    learnerStore: new MySqlLearnerStore(pool),
    reports: new MySqlReportStore(pool),
    secureCookies: process.env.UFUQ_SECURE_COOKIES === '1',
  };
}

const app = createApp({
  enableReviewPreview,
  enableDevelopmentIdentity,
  ...(dataDirectory ? { dataDirectory } : {}),
  ...(accounts ? { accounts } : {}),
});

app.listen(port, '127.0.0.1', () => {
  console.log(
    `UFUQ API listening on http://127.0.0.1:${port}${enableReviewPreview ? ' (REVIEW_PREVIEW enabled)' : ''}${enableDevelopmentIdentity ? ' (development fixture identity enabled)' : ''}${accounts ? ' (accounts: MySQL)' : ' (accounts off: no UFUQ_MYSQL_URL)'}`,
  );
});
