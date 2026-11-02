import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const node = process.execPath;
const servers = [];
const startupTimeoutMs = Number.parseInt(process.env.UFUQ_E2E_STARTUP_TIMEOUT_MS ?? '30000', 10);
const playwrightTimeoutMs = Number.parseInt(process.env.UFUQ_E2E_PROCESS_TIMEOUT_MS ?? '90000', 10);
const terminationGraceMs = 5_000;
// Defaults match CI; override both to run beside another server (e.g. preview:review).
const webPort = process.env.UFUQ_E2E_WEB_PORT ?? '4173';
const apiPort = process.env.UFUQ_E2E_API_PORT ?? '4174';
const webOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
let playwrightProcess;
let cleanupPromise;

function start(script, arguments_, extraEnvironment = {}) {
  const child = spawn(node, [join(repositoryRoot, script), ...arguments_], {
    cwd: repositoryRoot,
    env: { ...process.env, ...extraEnvironment },
    stdio: 'inherit',
    windowsHide: true,
  });
  servers.push(child);
  return child;
}

async function waitFor(url) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The direct child process may still be starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function isRunning(child) {
  return child.exitCode === null && child.signalCode === null;
}

function waitForExit(child, timeoutMs) {
  if (!isRunning(child)) return Promise.resolve(true);

  return new Promise((resolvePromise) => {
    const onExit = () => {
      clearTimeout(timeout);
      child.off('exit', onExit);
      child.off('error', onExit);
      resolvePromise(true);
    };
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      child.off('error', onExit);
      resolvePromise(false);
    }, timeoutMs);
    child.once('exit', onExit);
    child.once('error', onExit);
  });
}

async function terminate(child) {
  if (!isRunning(child)) return;

  child.kill('SIGTERM');
  if (await waitForExit(child, terminationGraceMs)) return;

  child.kill('SIGKILL');
  if (!(await waitForExit(child, terminationGraceMs))) {
    throw new Error(`Unable to terminate child process ${child.pid ?? 'unknown'}.`);
  }
}

async function runPlaywright(arguments_) {
  const child = spawn(
    node,
    [join(repositoryRoot, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', ...arguments_],
    {
      cwd: repositoryRoot,
      env: { ...process.env, UFUQ_E2E_BASE_URL: webOrigin, UFUQ_E2E_API_URL: apiOrigin },
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  playwrightProcess = child;
  let timeout;

  try {
    return await Promise.race([
      new Promise((resolvePromise, rejectPromise) => {
        child.once('error', rejectPromise);
        child.once('exit', (code, signal) => {
          if (signal) rejectPromise(new Error(`Playwright exited from signal ${signal}.`));
          else resolvePromise(code ?? 1);
        });
      }),
      new Promise((_, rejectPromise) => {
        timeout = setTimeout(
          () => rejectPromise(new Error('Playwright process timed out.')),
          playwrightTimeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    await terminate(child);
    playwrightProcess = undefined;
  }
}

function cleanup() {
  cleanupPromise ??= Promise.allSettled(
    [playwrightProcess, ...servers].filter(Boolean).map(terminate),
  ).then((results) => {
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        'One or more child processes could not be terminated.',
      );
    }
  });
  return cleanupPromise;
}

function handleSignal(exitCode) {
  return () => {
    void cleanup().finally(() => {
      process.exit(exitCode);
    });
  };
}

const handleInterrupt = handleSignal(130);
const handleTermination = handleSignal(143);
process.once('SIGINT', handleInterrupt);
process.once('SIGTERM', handleTermination);

/** True when something already answers on the URL (a server this runner does not own). */
async function answers(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1_000) });
    return true;
  } catch {
    return false;
  }
}

const occupied = [];
for (const url of [`${apiOrigin}/health`, webOrigin]) {
  if (await answers(url)) occupied.push(url);
}
if (occupied.length > 0) {
  // Without this guard the journeys would silently test another server (for example a
  // running preview:review with REVIEW_PREVIEW enabled) instead of the fresh build.
  console.error(
    `E2E needs ports ${webPort} and ${apiPort} for its own servers, but ${occupied.join(' and ')} already answer. Stop the other server (for example npm run preview:review), or set UFUQ_E2E_WEB_PORT and UFUQ_E2E_API_PORT to free ports.`,
  );
  process.exit(1);
}

try {
  // The browser journeys use the IMP-016 development fixture identity (local only).
  start('apps/api/dist/server.js', [], { UFUQ_ENABLE_DEVELOPMENT_IDENTITY: '1', PORT: apiPort });
  start(
    'node_modules/vite/bin/vite.js',
    ['preview', 'apps/web', '--host', '127.0.0.1', '--port', webPort, '--strictPort'],
    { UFUQ_API_PORT: apiPort },
  );
  await Promise.all([waitFor(`${apiOrigin}/health`), waitFor(webOrigin)]);
  process.exitCode = await runPlaywright(process.argv.slice(2));
} finally {
  await cleanup();
  process.off('SIGINT', handleInterrupt);
  process.off('SIGTERM', handleTermination);
}
