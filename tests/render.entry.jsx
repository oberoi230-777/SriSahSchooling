import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../web/src/App.jsx';
import PublicSite from '../web/src/PublicSite.jsx';

const portalRoute = window.location.pathname === '/portal' || window.location.pathname.startsWith('/portal/');
const view = portalRoute ? <App /> : <PublicSite />;
createRoot(document.getElementById('root')).render(<Suspense fallback={<p>Loading the site…</p>}>{view}</Suspense>);
