import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { useStore } from './state/store';

// Dev-only handle for driving and inspecting the demo from a test browser.
if (import.meta.env.DEV) Object.assign(window, { __store: useStore });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
