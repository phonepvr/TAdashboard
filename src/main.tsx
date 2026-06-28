import React from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted Albert Sans — AM/NS primary typeface (bundled woff2, zero network).
import '@fontsource-variable/albert-sans';
import './index.css';
import { App } from './App';

const el = document.getElementById('root');
if (!el) throw new Error('Root element not found');
createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
