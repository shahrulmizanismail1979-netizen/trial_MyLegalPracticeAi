import { createRoot, hydrateRoot } from 'react-dom/client';
import type { ErrorInfo } from 'react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const root = document.getElementById('root')!;
const options = {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error: unknown, errorInfo: ErrorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
};
const app = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

if (import.meta.env.DEV) {
  // The development-only component inspector annotates client JSX after the
  // static prerender has been written, so hydrating those two trees would
  // report a false mismatch. Production has no inspector and hydrates normally.
  root.replaceChildren();
  createRoot(root, options).render(app);
} else if (root.hasChildNodes()) {
  hydrateRoot(root, app, options);
} else {
  createRoot(root, options).render(app);
}
