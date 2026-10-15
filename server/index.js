import http from 'node:http';
import { loadEnv } from './env.js';
import { createApp } from './app.js';
import { closePool } from './db.js';

loadEnv();

function validateRuntime() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!process.env.PUBLIC_ORIGIN) throw new Error('PUBLIC_ORIGIN is required.');
  const parseOrigin = (value, label) => {
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error(`${label} must be an absolute HTTP(S) origin.`); }
    if (!['http:','https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw new Error(`${label} must be a bare HTTP(S) origin without a path, credentials, query or fragment.`);
    }
    return parsed.origin;
  };
  const publicOrigin = parseOrigin(process.env.PUBLIC_ORIGIN,'PUBLIC_ORIGIN');
  if (process.env.NODE_ENV === 'production' && !publicOrigin.startsWith('https://')) throw new Error('Production PUBLIC_ORIGIN must use HTTPS.');
  const origins = String(process.env.ALLOWED_ORIGINS || process.env.PUBLIC_ORIGIN).split(',').map((origin) => parseOrigin(origin.trim(),'ALLOWED_ORIGINS'));
  if (!origins.includes(publicOrigin)) throw new Error('ALLOWED_ORIGINS must include PUBLIC_ORIGIN.');
  if (process.env.NODE_ENV === 'production' && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) {
    throw new Error('Production email is required for verification, password recovery and invitations. Set RESEND_API_KEY and EMAIL_FROM.');
  }
}

validateRuntime();
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
const server = http.createServer(createApp());
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;
server.listen(port, '0.0.0.0', () => console.info(`SriSah Schooling listening on 0.0.0.0:${port}`));

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.info(`${signal} received; closing SriSah Schooling.`);
  const forceTimer = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async (error) => {
    clearTimeout(forceTimer);
    try { await closePool(); } catch (poolError) { console.error('Database pool shutdown failed:', poolError.message); }
    if (error) { console.error('HTTP shutdown failed:', error.message); process.exitCode = 1; }
    process.exit();
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
