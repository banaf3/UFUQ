// Starts the built API with the REVIEW_PREVIEW scope enabled plus the built web app, for
// local reviewer inspection of real ScientificProfileV1 data that is still
// REVIEW_REQUIRED. Results are labelled unreviewed and are never learner content.
// Stop with Ctrl+C.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
// Accounts and saved progress use the local MySQL server when it has been set up
// (npm run db:local -- init); otherwise the preview runs with the in-memory learner only.
const mysqlConfig = join(
  process.env.UFUQ_MYSQL_HOME ??
    join(process.env.LOCALAPPDATA ?? join(process.env.HOME ?? '.', '.local'), 'UFUQ', 'mysql-8.4'),
  'ufuq-dev.json',
);
let mysqlUrl = process.env.UFUQ_MYSQL_URL;
if (!mysqlUrl && existsSync(mysqlConfig)) {
  spawnSync(process.execPath, [join(root, 'scripts/dev/mysql-local.mjs'), 'start'], {
    stdio: 'inherit',
  });
  mysqlUrl = JSON.parse(readFileSync(mysqlConfig, 'utf8')).url;
}
// Demo accounts (admin1/admin2/user1/user2 @ufuq.test, password 1234567): local database only.
if (mysqlUrl && !process.env.UFUQ_NO_DEMO_ACCOUNTS) {
  spawnSync(process.execPath, [join(root, 'apps/api/dist/seed-demo.js')], {
    stdio: 'inherit',
    env: { ...process.env, UFUQ_MYSQL_URL: mysqlUrl },
  });
}
const children = [
  spawn(process.execPath, [join(root, 'apps/api/dist/server.js')], {
    cwd: root,
    env: {
      ...process.env,
      UFUQ_ENABLE_REVIEW_PREVIEW: '1',
      UFUQ_ENABLE_DEVELOPMENT_IDENTITY: '1',
      ...(mysqlUrl ? { UFUQ_MYSQL_URL: mysqlUrl } : {}),
    },
    stdio: 'inherit',
    windowsHide: true,
  }),
  spawn(
    process.execPath,
    [
      join(root, 'node_modules/vite/bin/vite.js'),
      'preview',
      'apps/web',
      '--host',
      '127.0.0.1',
      '--port',
      '4173',
    ],
    { cwd: root, stdio: 'inherit', windowsHide: true },
  ),
];
console.log(
  'Review preview: open http://127.0.0.1:4173 and choose "Review preview" as the execution scope.',
);
const stop = () => {
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
