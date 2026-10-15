/**
 * Public-site and portal render smoke tests.
 *
 * Builds the real React surfaces into a browser bundle, substitutes only the decorative
 * WebGL hero with a no-op placeholder, and mounts both route families in jsdom against a
 * stubbed API. The production build separately verifies the real Three.js scene.
 *
 * Run with: npm run test:render
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'tests', 'render.entry.jsx');
const heroStub = path.join(root, 'tests', 'hero-scene.stub.jsx');

function apiResponse(payload) {
  return { ok: true, status: 200, json: async () => payload, text: async () => JSON.stringify(payload) };
}

function createDom(url, errors, requests, articles = []) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  virtualConsole.on('error', (message) => errors.push(String(message)));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url,
    virtualConsole,
  });
  const { window } = dom;
  window.Headers = Headers;
  window.fetch = async (input) => {
    const target = String(input);
    requests.push(target);
    if (target.includes('/api/auth/me')) return apiResponse({ user: null });
    if (target.includes('/api/site/config')) return apiResponse({ organizationSlug: 'smoke-test-org' });
    if (target.includes('/api/articles')) return apiResponse({ articles });
    return apiResponse({});
  };
  return dom;
}

async function waitFor(predicate, message, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(message);
}

function render(dom, code) {
  dom.window.eval(code);
  return waitFor(() => dom.window.document.getElementById('root').children.length > 0, 'React mounted into #root');
}

test('public homepage, journal dialog and portal sign-in render without runtime errors', { timeout: 240_000 }, async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'srisah-render-'));
  const buildErrors = [];
  try {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({
        root: path.join(root, 'web'),
        plugins: [react(), {
          name: 'render-smoke-hero-stub',
          enforce: 'pre',
          resolveId(source, importer) {
            if (source === './HeroScene.jsx' && importer?.endsWith('/web/src/PublicSite.jsx')) return heroStub;
            return null;
          },
        }],
        logLevel: 'error',
        build: {
          outDir,
          emptyOutDir: true,
          copyPublicDir: false,
          lib: { entry, name: 'SriSahRenderSmoke', formats: ['iife'], fileName: () => 'site.smoke.js' },
          cssCodeSplit: false,
          rollupOptions: { output: { inlineDynamicImports: true } },
        },
        define: { 'process.env.NODE_ENV': '"production"' },
        onwarn(warning, warn) {
          buildErrors.push(warning.message);
          warn(warning);
        },
      });
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
    const files = fs.readdirSync(outDir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(outDir, entry.name);
      return entry.isDirectory() ? fs.readdirSync(full).map((name) => path.join(full, name)) : [full];
    });
    const jsPath = files.find((file) => file.endsWith('.js'));
    const cssPath = files.find((file) => file.endsWith('.css'));
    assert.ok(jsPath, 'the browser bundle was produced');
    assert.ok(cssPath, 'a compiled stylesheet was produced');
    const code = fs.readFileSync(jsPath, 'utf8');
    const styles = fs.readFileSync(cssPath, 'utf8');

    const portalErrors = [];
    const portalRequests = [];
    const portal = createDom('https://portal.example.test/portal', portalErrors, portalRequests);
    await render(portal, code);
    await waitFor(() => portal.window.document.getElementById('root').textContent.includes('Welcome back'), 'the portal sign-in screen rendered');
    const portalText = portal.window.document.getElementById('root').textContent;
    assert.match(portalText, /SriSah Schooling/, 'the learning portal brand is present');
    assert.match(portalText, /Back to The Throne of Wisdom/, 'portal users can return to the public site');
    assert.ok(portalRequests.some((url) => url.includes('/api/auth/me')), 'the portal checks its real session endpoint');
    assert.equal(portalErrors.length, 0, `portal has no runtime errors: ${portalErrors.join(' | ')}`);

    const publicErrors = [];
    const publicRequests = [];
    const publicSite = createDom('https://portal.example.test/', publicErrors, publicRequests);
    await render(publicSite, code);
    await waitFor(() => publicSite.window.document.getElementById('root').textContent.includes('A new reflection is on its way'), 'the public journal empty state rendered');
    const publicText = publicSite.window.document.getElementById('root').textContent;
    assert.match(publicText, /A calmer mind/, 'the public homepage hero rendered');
    assert.match(publicText, /A new reflection is on its way/, 'the journal has a useful empty state');
    assert.ok(publicRequests.some((url) => url.includes('/api/site/config')), 'the public site loads organization configuration');
    assert.ok(publicRequests.some((url) => url.includes('/api/articles')), 'the public journal calls the article API');
    assert.equal(publicErrors.length, 0, `public site has no runtime errors: ${publicErrors.join(' | ')}`);

    const articleErrors = [];
    const articleRequests = [];
    const article = { id: 'smoke-article-1', title: 'A practice of noticing', category: 'awareness', excerpt: 'An invitation to pause.', content: 'Notice one thing you can hear, then begin again.', author_name: 'Test Author', updated_at: '2026-10-01T00:00:00Z' };
    const articleSite = createDom('https://portal.example.test/articles', articleErrors, articleRequests, [article]);
    await render(articleSite, code);
    await waitFor(() => articleSite.window.document.getElementById('root').textContent.includes(article.title), 'the published article card rendered');
    const readButton = [...articleSite.window.document.querySelectorAll('button')].find((button) => button.textContent.includes('Read reflection'));
    assert.ok(readButton, 'published article has a read action');
    readButton.focus();
    readButton.click();
    await waitFor(() => articleSite.window.document.querySelector('[role="dialog"]'), 'the article dialog opened');
    assert.match(articleSite.window.document.querySelector('[role="dialog"]').textContent, /Notice one thing you can hear/);
    assert.equal(articleSite.window.document.activeElement, articleSite.window.document.querySelector('[role="dialog"]'), 'dialog receives focus');
    articleSite.window.dispatchEvent(new articleSite.window.KeyboardEvent('keydown', { key: 'Escape' }));
    await waitFor(() => !articleSite.window.document.querySelector('[role="dialog"]'), 'Escape closes the article dialog');
    assert.equal(articleSite.window.document.activeElement, readButton, 'focus returns to the article read action');
    assert.equal(articleErrors.length, 0, `article route has no runtime errors: ${articleErrors.join(' | ')}`);

    assert.match(styles, /#6d3fd1/i, 'the portal violet accent is in the compiled stylesheet');
    assert.ok(!/#173d32/i.test(styles), 'the legacy forest-green brand colour is gone');
    assert.ok(!/fonts\.googleapis\.com/i.test(styles), 'the public site does not depend on an external font host');
    assert.equal(buildErrors.length, 0, `the render bundle has no build warnings: ${buildErrors.join(' | ')}`);

    portal.window.close();
    publicSite.window.close();
    articleSite.window.close();
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
