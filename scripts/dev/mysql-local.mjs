// Local MySQL 8.4 development server for UFUQ (Phase 4, IMP-015). It runs as a user
// process, not a Windows service, with its data OUTSIDE the repository so no Git command
// can touch it: %LOCALAPPDATA%\UFUQ\mysql-8.4 (or $UFUQ_MYSQL_HOME). It listens only on
// 127.0.0.1:3307. The connection URL for the application user is written to
// <home>/ufuq-dev.json (never committed, never printed).
//
//   node scripts/dev/mysql-local.mjs init     # once: initialise, create the database and users
//   node scripts/dev/mysql-local.mjs start    # start the server in the background
//   node scripts/dev/mysql-local.mjs status
//   node scripts/dev/mysql-local.mjs stop
//   node scripts/dev/mysql-local.mjs url      # print the env assignment for UFUQ_MYSQL_URL
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';

const PORT = 3307;
const home =
  process.env.UFUQ_MYSQL_HOME ??
  join(process.env.LOCALAPPDATA ?? join(process.env.HOME ?? '.', '.local'), 'UFUQ', 'mysql-8.4');
const dataDir = join(home, 'data');
const configFile = join(home, 'ufuq-dev.json');
const logFile = join(home, 'mysqld.log');
const binary = (name) => {
  const candidates = [
    process.env.UFUQ_MYSQL_BIN && join(process.env.UFUQ_MYSQL_BIN, `${name}.exe`),
    `C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\${name}.exe`,
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`${name} not found; set UFUQ_MYSQL_BIN to the MySQL bin folder.`);
  return found;
};
const serverArgs = [
  `--datadir=${dataDir}`,
  `--port=${PORT}`,
  '--bind-address=127.0.0.1',
  '--mysqlx=OFF',
  `--log-error=${logFile}`,
  '--character-set-server=utf8mb4',
  '--collation-server=utf8mb4_0900_ai_ci',
  '--default-time-zone=+00:00',
];

const listening = () =>
  new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port: PORT });
    socket.once('connect', () => (socket.end(), resolve(true)));
    socket.once('error', () => resolve(false));
  });

async function waitFor(state, seconds = 60) {
  for (let i = 0; i < seconds * 4; i += 1) {
    if ((await listening()) === state) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function client(sql, password) {
  const result = spawnSync(
    binary('mysql'),
    ['--host=127.0.0.1', `--port=${PORT}`, '--user=root', '--batch', '--skip-column-names'],
    {
      input: sql,
      encoding: 'utf8',
      env: { ...process.env, MYSQL_PWD: password ?? '' },
    },
  );
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout;
}

async function start() {
  if (await listening()) return console.log(`MySQL is already listening on 127.0.0.1:${PORT}.`);
  if (!existsSync(dataDir)) throw new Error('Not initialised: run `init` first.');
  const child = spawn(binary('mysqld'), serverArgs, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  if (!(await waitFor(true))) throw new Error(`MySQL did not start; see ${logFile}.`);
  console.log(`MySQL started on 127.0.0.1:${PORT} (data: ${dataDir}).`);
}

async function init() {
  if (existsSync(dataDir)) throw new Error(`Already initialised: ${dataDir} exists.`);
  mkdirSync(home, { recursive: true });
  const result = spawnSync(binary('mysqld'), ['--initialize-insecure', ...serverArgs], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`Initialisation failed; see ${logFile}.`);
  await start();
  const rootPassword = randomBytes(18).toString('base64url');
  const appPassword = randomBytes(18).toString('base64url');
  const testPassword = randomBytes(18).toString('base64url');
  client(
    [
      `ALTER USER 'root'@'localhost' IDENTIFIED BY '${rootPassword}';`,
      'CREATE DATABASE ufuq CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;',
      'CREATE DATABASE ufuq_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;',
      `CREATE USER 'ufuq_app'@'localhost' IDENTIFIED BY '${appPassword}';`,
      `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON ufuq.* TO 'ufuq_app'@'localhost';`,
      `CREATE USER 'ufuq_test'@'localhost' IDENTIFIED BY '${testPassword}';`,
      `GRANT ALL PRIVILEGES ON ufuq_test.* TO 'ufuq_test'@'localhost';`,
    ].join('\n'),
  );
  const url = (user, password, database) =>
    `mysql://${user}:${password}@127.0.0.1:${PORT}/${database}`;
  writeFileSync(
    configFile,
    `${JSON.stringify(
      {
        note: 'Local UFUQ development MySQL. Never commit or share.',
        rootPassword,
        url: url('ufuq_app', appPassword, 'ufuq'),
        testUrl: url('ufuq_test', testPassword, 'ufuq_test'),
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  console.log(`Initialised. Credentials are in ${configFile}.`);
}

async function stop() {
  if (!(await listening())) return console.log('MySQL is not running.');
  const { rootPassword } = JSON.parse(readFileSync(configFile, 'utf8'));
  const result = spawnSync(
    binary('mysqladmin'),
    ['--host=127.0.0.1', `--port=${PORT}`, '--user=root', 'shutdown'],
    { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: rootPassword } },
  );
  if (result.status !== 0) throw new Error(result.stderr.trim());
  await waitFor(false);
  console.log('MySQL stopped.');
}

const command = process.argv[2];
try {
  if (command === 'init') await init();
  else if (command === 'start') await start();
  else if (command === 'stop') await stop();
  else if (command === 'status')
    console.log((await listening()) ? `Running on 127.0.0.1:${PORT}.` : 'Not running.');
  else if (command === 'url') {
    const { url, testUrl } = JSON.parse(readFileSync(configFile, 'utf8'));
    console.log(process.argv[3] === 'test' ? testUrl : url);
  } else {
    console.error('Usage: node scripts/dev/mysql-local.mjs init|start|stop|status|url [test]');
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
