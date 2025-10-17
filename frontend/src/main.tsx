/**
 * Application entry point. Mounts the React component tree and wires global styles.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

/**
 * Bootstraps the root React tree. In larger applications this would be a good hook for providers
 * and cross-cutting concerns.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
