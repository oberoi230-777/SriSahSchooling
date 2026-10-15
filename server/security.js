import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getPool } from './db.js';

const scrypt = promisify(nodeScrypt);
const SESSION_TTL_HOURS = 12;
const TOKEN_TTL_HOURS = 2;
const COOKIE_PATH = '/';
const sameSite = 'SameSite=Lax';

export function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
export function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
export function randomToken() { return randomBytes(32).toString('base64url'); }

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) {
    return 'Use a password between 12 and 200 characters.';
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Include at least one lowercase letter, uppercase letter and number.';
  }
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  try {
    const [scheme, n, r, p, saltText, hashText] = String(encoded).split('$');
    if (scheme !== 'scrypt' || Number(n) !== 16384 || Number(r) !== 8 || Number(p) !== 1) return false;
    const expected = Buffer.from(hashText, 'base64url');
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 }));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

function secureCookies() { return process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'; }
function sessionCookieName() { return secureCookies() ? '__Host-srisah_session' : 'srisah_session'; }
function cookieOptions(maxAgeSeconds, httpOnly) {
  return `Path=${COOKIE_PATH}; Max-Age=${maxAgeSeconds}; ${sameSite}; ${httpOnly ? 'HttpOnly; ' : ''}${secureCookies() ? 'Secure; ' : ''}`;
}

export async function createSession(res, user) {
  const token = randomToken();
  const csrf = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await getPool().query(
    'INSERT INTO user_sessions (user_id,org_id,token_hash,expires_at) VALUES ($1,$2,$3,$4)',
    [user.id, user.org_id, sha256(token), expiresAt],
  );
  res.append('Set-Cookie', `${sessionCookieName()}=${token}; ${cookieOptions(SESSION_TTL_HOURS * 3600, true)}`);
  res.append('Set-Cookie', `srisah_csrf=${csrf}; ${cookieOptions(SESSION_TTL_HOURS * 3600, false)}`);
  return { id: user.id, email: user.email, name: user.full_name, role: user.role, orgId: user.org_id, csrf };
}

export function clearSessionCookies(res) {
  res.append('Set-Cookie', `${sessionCookieName()}=; ${cookieOptions(0, true)}`);
  res.append('Set-Cookie', `srisah_csrf=; ${cookieOptions(0, false)}`);
}

function cookies(req) {
  const result = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    try { result[key] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* malformed cookie */ }
  }
  return result;
}

export function readSessionCookie(req) {
  const all = cookies(req);
  return all[sessionCookieName()] || '';
}

export function csrfCookie(req) { return cookies(req).srisah_csrf || ''; }

export async function findPrincipal(req) {
  const token = readSessionCookie(req);
  if (!token) return null;
  const result = await getPool().query(
    `SELECT u.id,u.org_id,u.email,u.full_name,u.role,u.status,u.email_verified_at,s.id AS session_id
     FROM user_sessions s JOIN users u ON u.id=s.user_id AND u.org_id=s.org_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND s.revoked_at IS NULL AND u.status='active'`,
    [sha256(token)],
  );
  const user = result.rows[0];
  if (!user || !user.email_verified_at) return null;
  return { id: user.id, orgId: user.org_id, email: user.email, name: user.full_name, role: user.role, sessionId: user.session_id };
}

export async function revokeSession(req) {
  const token = readSessionCookie(req);
  if (!token) return;
  await getPool().query('UPDATE user_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL', [sha256(token)]);
}

export async function createEmailToken(client, userId, purpose) {
  const token = randomToken();
  await client.query('DELETE FROM email_tokens WHERE user_id=$1 AND purpose=$2', [userId, purpose]);
  await client.query(
    `INSERT INTO email_tokens (user_id,purpose,token_hash,expires_at)
     VALUES ($1,$2,$3,now()+($4::text || ' hours')::interval)`,
    [userId, purpose, sha256(token), String(TOKEN_TTL_HOURS)],
  );
  return token;
}

export async function deliverEmail({ to, subject, text }) {
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  if (!publicOrigin) throw new Error('PUBLIC_ORIGIN is required to send account links.');
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_EMAIL_LOG === 'true') {
      console.info(`[DEV EMAIL] to=${to} subject=${subject}\n${text}`);
      return;
    }
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM before enabling sign-up in production.');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
  });
  if (!response.ok) throw new Error(`Email provider rejected the request (${response.status}).`);
}
