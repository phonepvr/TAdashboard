import React from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted Inter (bundled woff2, served from 'self' — zero network).
import '@fontsource-variable/inter';
import './index.css';
import { App } from './App';

const el = document.getElementById('root');
if (!el) throw new Error('Root element not found');
createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
