import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';

const PortalApp = lazy(() => import('./App.jsx'));
const PublicSite = lazy(() => import('./PublicSite.jsx'));
const root = createRoot(document.getElementById('root'));
const route = window.location.pathname.replace(/\/+$/, '') || '/';
const portalRoute = Capacitor.isNativePlatform() || route === '/portal' || route.startsWith('/portal/');

function LoadingSurface() {
  return <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', gap: 12, color: '#594771', background: '#fbf9f5', font: '500 13px system-ui, sans-serif' }}><span style={{ width: 20, height: 20, border: '2px solid #ded4e9', borderTopColor: '#6d3fd1', borderRadius: '50%' }} />Opening your learning space…</div>;
}

root.render(
  <React.StrictMode>
    <Suspense fallback={<LoadingSurface />}>
      {portalRoute ? <PortalApp /> : <PublicSite />}
    </Suspense>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('Offline shell could not be installed:', error.message);
    });
  }, { once: true });
}
