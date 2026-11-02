import { createApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '4174', 10);
// REVIEW_PREVIEW is an explicit local reviewer opt-in; it is never on by default.
const enableReviewPreview = process.env.UFUQ_ENABLE_REVIEW_PREVIEW === '1';
const dataDirectory = process.env.UFUQ_DATA_DIR;
const app = createApp({ enableReviewPreview, ...(dataDirectory ? { dataDirectory } : {}) });

app.listen(port, '127.0.0.1', () => {
  console.log(
    `UFUQ API listening on http://127.0.0.1:${port}${enableReviewPreview ? ' (REVIEW_PREVIEW enabled)' : ''}`,
  );
});
