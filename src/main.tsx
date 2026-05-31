import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

// Capture the beforeinstallprompt early so later mounts (Settings page) can use it.
window.addEventListener('beforeinstallprompt', (event: Event) => {
  try {
    event.preventDefault();
  } catch (e) {
    // ignore
  }
  // store globally for pages/components mounted later
  (window as any).__deferredInstallPrompt = event;
  // notify any listeners that a deferred prompt is available
  window.dispatchEvent(new CustomEvent('pwa-deferred'));
});

window.addEventListener('appinstalled', () => {
  (window as any).__deferredInstallPrompt = null;
  window.dispatchEvent(new CustomEvent('pwa-installed'));
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
