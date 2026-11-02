// Starts the built API with the REVIEW_PREVIEW scope enabled plus the built web app, for
// local reviewer inspection of real ScientificProfileV1 data that is still
// REVIEW_REQUIRED. Results are labelled unreviewed and are never learner content.
// Stop with Ctrl+C.
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const children = [
  spawn(process.execPath, [join(root, 'apps/api/dist/server.js')], {
    cwd: root,
    env: { ...process.env, UFUQ_ENABLE_REVIEW_PREVIEW: '1' },
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
