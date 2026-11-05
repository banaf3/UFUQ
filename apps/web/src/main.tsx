import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Tajawal (SIL OFL 1.1), bundled locally: Arabic names and their transliterations.
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';

import { App } from './App.js';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('UFUQ web root element is missing.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
