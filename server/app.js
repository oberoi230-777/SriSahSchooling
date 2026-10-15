import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, sep } from 'node:path';
import { withSystemTransaction, withUserTransaction, withPublicOrganizationTransaction, getPool } from './db.js';
import {
  clearSessionCookies, createEmailToken, createSession, deliverEmail, findPrincipal,
  hashPassword, normalizeEmail, randomToken, revokeSession, sha256, validatePassword,
  verifyPassword,
} from './security.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBJECTS = new Set(['Mathematics','Science','English']);
const GRADES = new Set(Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`).concat(Array.from({ length: 12 }, (_, index) => `Year ${index + 1}`)));
const ARTICLE_CATEGORIES = new Set(['meditation','healing','awareness','homeschooling','learning']);
const CONTACT_INTERESTS = new Set(['group_meditation','homeschooling','learning_portal','general']);
const unsafeMethods = new Set(['POST','PUT','PATCH','DELETE']);
const exemptCsrfPaths = new Set(['/api/auth/register','/api/auth/login','/api/auth/verify-email','/api/auth/accept-invite','/api/auth/resend-verification','/api/auth/forgot-password','/api/auth/reset-password','/api/enquiries']);
const rateWindows = new Map();

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function fail(status, code, message) { throw new HttpError(status, code, message); }
function requireText(value, label, max = 240) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) fail(400, 'INVALID_INPUT', `${label} is required and must be under ${max} characters.`);
  return text;
}
function optionalText(value, max = 1000) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > max) fail(400, 'INVALID_INPUT', `Text must be under ${max} characters.`);
  return text;
}
function asArray(value, label, maxCount = 12) {
  if (!Array.isArray(value) || value.length > maxCount || value.some((item) => typeof item !== 'string' || item.trim().length > 100)) {
    fail(400, 'INVALID_INPUT', `${label} must be a list of up to ${maxCount} short text values.`);
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}
function validUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function ensureUuid(value, label = 'id') { if (!validUuid(value)) fail(400, 'INVALID_ID', `${label} is invalid.`); return value; }
function ensureSubject(value) { const subject = requireText(value, 'Subject', 80); if (!SUBJECTS.has(subject)) fail(400, 'INVALID_SUBJECT', 'Choose Mathematics, Science or English.'); return subject; }
function ensureGrade(value) { const grade = requireText(value, 'Grade / Year level', 40); if (!GRADES.has(grade)) fail(400, 'INVALID_GRADE', 'Choose a grade from Grade 1–12 or Year 1–12.'); return grade; }
function validateWebsiteArticle(body) {
  const title = requireText(body?.title, 'Article title', 180);
  const category = requireText(body?.category, 'Article category', 40);
  if (!ARTICLE_CATEGORIES.has(category)) fail(400, 'INVALID_CATEGORY', 'Choose a supported article category.');
  const excerpt = requireText(body?.excerpt, 'Article summary', 320);
  const content = requireText(body?.content, 'Article content', 40000);
  if (typeof body?.published !== 'boolean') fail(400, 'INVALID_PUBLISH_STATE', 'Choose whether to save this article as a draft or publish it.');
  return { title, category, excerpt, content, published: body.published };
}
function ensureScore(score, maxScore) {
  const points = Number(score), maximum = Number(maxScore);
  if (!Number.isFinite(points) || !Number.isFinite(maximum) || maximum <= 0 || points < 0 || points > maximum) fail(400, 'INVALID_SCORE', 'Score must be between zero and the maximum score.');
  return [points, maximum];
}
function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a)); const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}
function setCsrfCookie(res, value) {
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  res.append('Set-Cookie', `srisah_csrf=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=43200${secure ? '; Secure' : ''}`);
}
function getCsrfCookie(req) {
  const pair = String(req.headers.cookie || '').split(';').map((item) => item.trim()).find((item) => item.startsWith('srisah_csrf='));
  if (!pair) return '';
  try { return decodeURIComponent(pair.slice('srisah_csrf='.length)); } catch { return ''; }
}
function allowedOrigins() {
  return new Set(String(process.env.ALLOWED_ORIGINS || process.env.PUBLIC_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean).map((origin) => new URL(origin).origin));
}
function secureRequest(req) {
  const origin = req.get('origin');
  const arenaPreview = process.env.NODE_ENV !== 'production' && /^https:\/\/\d+-[a-z0-9-]+\.e2b\.app$/i.test(origin || '');
  if (!origin || (!allowedOrigins().has(origin) && !arenaPreview)) fail(403, 'ORIGIN_REJECTED', 'Request origin is not permitted.');
  if (!exemptCsrfPaths.has(req.path)) {
    const cookie = getCsrfCookie(req); const header = req.get('x-csrf-token') || '';
    if (!cookie || !header || !constantTimeEqual(cookie, header)) fail(403, 'CSRF_REJECTED', 'Security token is missing or invalid. Refresh the page and try again.');
  }
}
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const old = rateWindows.get(key);
  const entry = !old || old.until < now ? { count: 0, until: now + windowMs } : old;
  entry.count += 1; rateWindows.set(key, entry);
  if (rateWindows.size > 10_000) for (const [id, value] of rateWindows) if (value.until < now) rateWindows.delete(id);
  if (entry.count > limit) fail(429, 'RATE_LIMITED', 'Too many requests. Please wait and try again.');
}
function requireRole(principal, roles) { if (!roles.includes(principal.role)) fail(403, 'FORBIDDEN', 'You do not have permission to do that.'); }
async function audit(client, principal, action, targetType, targetId = null) {
  await client.query('INSERT INTO audit_events(org_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,$3,$4,$5)', [principal.orgId, principal.id, action, targetType, targetId]);
}
async function findOrgBySlug(slug) {
  const result = await getPool().query('SELECT id,join_code_hash FROM organizations WHERE slug=$1 AND active=true', [String(slug || '').trim().toLowerCase()]);
  return result.rows[0] || null;
}
async function sendAccountLink(user, purpose, token) {
  const invite = purpose === 'invite';
  const action = invite ? 'activate your SriSah account and choose a password' : purpose === 'verify' ? 'verify your email address' : 'reset your password';
  const key = invite ? 'invite' : purpose === 'verify' ? 'verify' : 'reset';
  const link = `${new URL('/portal', process.env.PUBLIC_ORIGIN).origin}/portal?${key}=${encodeURIComponent(token)}`;
  const subject = invite ? 'Your SriSah Schooling account invitation' : purpose === 'verify' ? 'Verify your SriSah account' : 'Reset your SriSah password';
  await deliverEmail({ to: user.email, subject, text: `Hello ${user.full_name},\n\nUse this one-time link to ${action}:\n${link}\n\nThe link expires in two hours. If you did not request this, ignore this email.` });
}

function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }

// A pg Client is a single connection: queries must be awaited in order, not launched
// simultaneously (pg 9 rejects client.query while another query is in progress).
async function sequentialQueries(queries) {
  const results = [];
  for (const query of queries) results.push(await query());
  return results;
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:");
    next();
  });
  app.use(express.json({ limit: '64kb', strict: true }));
  app.use((req, res, next) => {
    if (unsafeMethods.has(req.method)) {
      try { secureRequest(req); } catch (error) { return next(error); }
    }
    next();
  });
  app.use(asyncRoute(async (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/api/auth/') || req.path === '/api/health' || req.path === '/api/site/config' || (req.path === '/api/articles' && req.method === 'GET') || (req.path === '/api/enquiries' && req.method === 'POST')) return next();
    req.principal = await findPrincipal(req);
    if (!req.principal) fail(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    next();
  }));

  const api = express.Router();

  api.get('/health', asyncRoute(async (_req,res) => {
    await getPool().query('SELECT 1');
    res.json({ ok: true, database: 'ok' });
  }));

  api.get('/site/config', (_req,res) => {
    const organizationSlug = String(process.env.PUBLIC_SITE_ORG_SLUG || process.env.BOOTSTRAP_ORG_SLUG || 'srisah').trim().toLowerCase();
    res.setHeader('Cache-Control','public, max-age=300, stale-while-revalidate=3600');
    res.json({ organizationSlug });
  });

  // Auth: parents join an organization with an out-of-band enrollment code. Staff/student users are provisioned by an admin.
  api.post('/auth/register', asyncRoute(async (req,res) => {
    rateLimit(`register:${req.ip}`, 8, 60 * 60 * 1000);
    const email = normalizeEmail(req.body?.email);
    if (!EMAIL_RE.test(email) || email.length > 254) fail(400,'INVALID_EMAIL','Enter a valid email address.');
    const name = requireText(req.body?.name,'Full name',120);
    const password = String(req.body?.password || '');
    const passwordError = validatePassword(password); if (passwordError) fail(400,'WEAK_PASSWORD',passwordError);
    const org = await findOrgBySlug(req.body?.organizationSlug);
    if (!org || !constantTimeEqual(sha256(String(req.body?.organizationCode || '')), org.join_code_hash)) fail(400,'INVALID_ENROLLMENT','Check your organization name and family enrollment code.');
    const passwordHash = await hashPassword(password);
    let user, token;
    try {
      await withSystemTransaction(async (client) => {
        const inserted = await client.query(`INSERT INTO users(org_id,email,full_name,role,password_hash,status)
          VALUES($1,$2,$3,'parent',$4,'pending') RETURNING id,org_id,email,full_name,role`, [org.id,email,name,passwordHash]);
        user = inserted.rows[0];
        token = await createEmailToken(client,user.id,'verify');
      });
    } catch (error) {
      if (error.code === '23505') fail(409,'ACCOUNT_EXISTS','An account with that email already exists.');
      throw error;
    }
    await sendAccountLink(user,'verify',token);
    res.status(201).json({ message: 'Check your email for a verification link. The link expires in two hours.' });
  }));

  api.post('/auth/verify-email', asyncRoute(async (req,res) => {
    const token = requireText(req.body?.token,'Verification token',256);
    let user;
    await withSystemTransaction(async (client) => {
      const found = await client.query(`SELECT t.id AS token_id,u.id,u.org_id,u.email,u.full_name,u.role
        FROM email_tokens t JOIN users u ON u.id=t.user_id
        WHERE t.token_hash=$1 AND t.purpose='verify' AND t.used_at IS NULL AND t.expires_at>now()
          AND u.role='parent' AND u.status='pending' AND u.email_verified_at IS NULL FOR UPDATE OF t,u`, [sha256(token)]);
      if (!found.rowCount) fail(400,'INVALID_TOKEN','This verification link is invalid or expired.');
      user = found.rows[0];
      await client.query("UPDATE users SET email_verified_at=now(),status='active' WHERE id=$1",[user.id]);
      await client.query('UPDATE email_tokens SET used_at=now() WHERE id=$1',[user.token_id]);
    });
    const sessionUser = await createSession(res,user);
    res.json({ user: sessionUser });
  }));

  api.post('/auth/accept-invite', asyncRoute(async (req,res) => {
    rateLimit(`accept-invite:${req.ip}`,10,60*60*1000);
    const token=requireText(req.body?.token,'Invitation token',256);
    const password=String(req.body?.password||'');
    const passwordError=validatePassword(password); if(passwordError)fail(400,'WEAK_PASSWORD',passwordError);
    const passwordHash=await hashPassword(password); let user;
    await withSystemTransaction(async(client)=>{
      const found=await client.query(`SELECT t.id AS token_id,u.id,u.org_id,u.email,u.full_name,u.role
        FROM email_tokens t JOIN users u ON u.id=t.user_id
        WHERE t.token_hash=$1 AND t.purpose='invite' AND t.used_at IS NULL AND t.expires_at>now() AND u.status='pending' FOR UPDATE OF t,u`,[sha256(token)]);
      if(!found.rowCount)fail(400,'INVALID_TOKEN','This invitation is invalid or expired.');
      user=found.rows[0];
      await client.query("UPDATE users SET password_hash=$1,email_verified_at=now(),status='active' WHERE id=$2",[passwordHash,user.id]);
      await client.query('UPDATE email_tokens SET used_at=now() WHERE id=$1',[user.token_id]);
    });
    const sessionUser=await createSession(res,user);res.json({user:sessionUser});
  }));

  api.post('/auth/resend-verification', asyncRoute(async (req,res) => {
    rateLimit(`resend:${req.ip}`, 5, 60 * 60 * 1000);
    const email = normalizeEmail(req.body?.email);
    const found = await getPool().query("SELECT id,org_id,email,full_name,role FROM users WHERE email=$1 AND role='parent' AND email_verified_at IS NULL AND status='pending'",[email]);
    if (found.rowCount) {
      const user = found.rows[0];
      const token = await withSystemTransaction((client) => createEmailToken(client,user.id,'verify'));
      await sendAccountLink(user,'verify',token);
    }
    res.json({ message: 'If an unverified account exists, a new link has been sent.' });
  }));

  api.post('/auth/login', asyncRoute(async (req,res) => {
    rateLimit(`login:${req.ip}`, 12, 15 * 60 * 1000);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const result = await getPool().query('SELECT id,org_id,email,full_name,role,password_hash,status,email_verified_at FROM users WHERE email=$1',[email]);
    const user = result.rows[0];
    const valid = user && await verifyPassword(password,user.password_hash);
    if (!valid || user.status !== 'active') fail(401,'INVALID_CREDENTIALS','Email or password is incorrect.');
    if (!user.email_verified_at) fail(403,'EMAIL_NOT_VERIFIED','Verify your email before signing in.');
    const sessionUser = await createSession(res,user);
    res.json({ user: sessionUser });
  }));

  api.post('/auth/forgot-password', asyncRoute(async (req,res) => {
    rateLimit(`forgot:${req.ip}`, 5, 60 * 60 * 1000);
    const email = normalizeEmail(req.body?.email);
    const result = await getPool().query("SELECT id,org_id,email,full_name,role FROM users WHERE email=$1 AND status='active' AND email_verified_at IS NOT NULL",[email]);
    if (result.rowCount) {
      const user = result.rows[0];
      const token = await withSystemTransaction((client) => createEmailToken(client,user.id,'reset'));
      await sendAccountLink(user,'reset',token);
    }
    res.json({ message: 'If an account exists, password reset instructions have been sent.' });
  }));

  api.post('/auth/reset-password', asyncRoute(async (req,res) => {
    const token = requireText(req.body?.token,'Reset token',256);
    const password = String(req.body?.password || '');
    const passwordError = validatePassword(password); if (passwordError) fail(400,'WEAK_PASSWORD',passwordError);
    const passwordHash = await hashPassword(password);
    await withSystemTransaction(async (client) => {
      const found = await client.query("SELECT t.id,t.user_id FROM email_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.purpose='reset' AND t.used_at IS NULL AND t.expires_at>now() AND u.status='active' AND u.email_verified_at IS NOT NULL FOR UPDATE OF t,u",[sha256(token)]);
      if (!found.rowCount) fail(400,'INVALID_TOKEN','This reset link is invalid or expired.');
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[passwordHash,found.rows[0].user_id]);
      await client.query('UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[found.rows[0].user_id]);
      await client.query('UPDATE email_tokens SET used_at=now() WHERE id=$1',[found.rows[0].id]);
    });
    res.json({ message: 'Password updated. Sign in with your new password.' });
  }));

  api.get('/auth/me', asyncRoute(async (req,res) => {
    const principal = await findPrincipal(req);
    if (!principal) return res.json({ user: null });
    const csrf = getCsrfCookie(req) || randomToken();
    setCsrfCookie(res,csrf);
    res.json({ user: { id: principal.id,email: principal.email,name: principal.name,role: principal.role,orgId: principal.orgId }, csrf });
  }));

  api.post('/auth/logout', asyncRoute(async (req,res) => {
    await revokeSession(req);
    clearSessionCookies(res);
    res.status(204).end();
  }));

  api.get('/students', asyncRoute(async (req,res) => {
    const rows = await withUserTransaction(req.principal,(client) => client.query(`SELECT id,first_name,last_name,grade_year,country,school,curriculum,subjects,current_level,learning_goals,improvement_areas,created_at,updated_at
      FROM students ORDER BY first_name,last_name`));
    res.json({ students: rows.rows });
  }));

  api.post('/students', asyncRoute(async (req,res) => {
    requireRole(req.principal,['parent','admin']);
    const input = req.body || {};
    const id = randomUUID();
    const firstName = requireText(input.firstName,'First name',80);
    const lastName = optionalText(input.lastName,80);
    const gradeYear = ensureGrade(input.gradeYear);
    const country = requireText(input.country,'Country',100);
    const school = optionalText(input.school,180);
    const curriculum = requireText(input.curriculum,'Curriculum',120);
    const subjects = asArray(input.subjects,'Subjects');
    if (!subjects.length || subjects.some((item) => !SUBJECTS.has(item))) fail(400,'INVALID_SUBJECTS','Choose one or more supported subjects.');
    const currentLevel = optionalText(input.currentLevel,800);
    const learningGoals = optionalText(input.learningGoals,1500);
    const improvementAreas = asArray(input.improvementAreas || [],'Improvement areas');
    const created = await withUserTransaction(req.principal,async (client) => {
      await client.query(`INSERT INTO students(id,org_id,created_by,first_name,last_name,grade_year,country,school,curriculum,subjects,current_level,learning_goals,improvement_areas)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[id,req.principal.orgId,req.principal.id,firstName,lastName,gradeYear,country,school,curriculum,subjects,currentLevel,learningGoals,improvementAreas]);
      if (req.principal.role === 'parent') await client.query(`INSERT INTO student_guardians(org_id,student_id,guardian_user_id,relationship,is_primary) VALUES($1,$2,$3,'Parent',true)`,[req.principal.orgId,id,req.principal.id]);
      await audit(client,req.principal,'student.created','student',id);
      const row = await client.query('SELECT id,first_name,last_name,grade_year,country,school,curriculum,subjects,current_level,learning_goals,improvement_areas FROM students WHERE id=$1',[id]);
      return row.rows[0];
    });
    res.status(201).json({ student: created });
  }));

  api.delete('/students/:id',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    const id=ensureUuid(req.params.id,'Student id');
    await withUserTransaction(req.principal,async(client)=>{
      const student=await client.query('SELECT id,linked_user_id FROM students WHERE id=$1',[id]);
      if(!student.rowCount)fail(404,'NOT_FOUND','Student profile not found.');
      await audit(client,req.principal,'student.deleted','student',id);
      if(student.rows[0].linked_user_id){
        await client.query("UPDATE users SET status='suspended' WHERE id=$1 AND org_id=$2",[student.rows[0].linked_user_id,req.principal.orgId]);
        await client.query('UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[student.rows[0].linked_user_id]);
      }
      await client.query('DELETE FROM students WHERE id=$1',[id]);
    });
    res.status(204).end();
  }));

  api.patch('/students/:id', asyncRoute(async (req,res) => {
    requireRole(req.principal,['parent','admin']);
    const id = ensureUuid(req.params.id,'Student id');
    const input = req.body || {};
    const mapping = {
      firstName: ['first_name',(v) => requireText(v,'First name',80)], lastName: ['last_name',(v) => optionalText(v,80)],
      gradeYear: ['grade_year',ensureGrade], country: ['country',(v) => requireText(v,'Country',100)],
      school: ['school',(v) => optionalText(v,180)], curriculum: ['curriculum',(v) => requireText(v,'Curriculum',120)],
      currentLevel: ['current_level',(v) => optionalText(v,800)], learningGoals: ['learning_goals',(v) => optionalText(v,1500)],
      subjects: ['subjects',(v) => { const items=asArray(v,'Subjects'); if (!items.length || items.some((item)=>!SUBJECTS.has(item))) fail(400,'INVALID_SUBJECTS','Choose one or more supported subjects.'); return items; }],
      improvementAreas: ['improvement_areas',(v) => asArray(v,'Improvement areas')],
    };
    const updates=[]; const values=[];
    for (const [key,[column,parse]] of Object.entries(mapping)) if (Object.hasOwn(input,key)) { values.push(parse(input[key])); updates.push(`${column}=$${values.length}`); }
    if (!updates.length) fail(400,'EMPTY_UPDATE','Provide at least one profile field to update.');
    values.push(new Date(),id);
    const result = await withUserTransaction(req.principal,async (client) => {
      const updated = await client.query(`UPDATE students SET ${updates.join(',')},updated_at=$${values.length-1} WHERE id=$${values.length} RETURNING id,first_name,last_name,grade_year,country,school,curriculum,subjects,current_level,learning_goals,improvement_areas`,values);
      if (!updated.rowCount) fail(404,'NOT_FOUND','Student profile not found.');
      await audit(client,req.principal,'student.updated','student',id);
      return updated.rows[0];
    });
    res.json({ student: result });
  }));

  api.get('/dashboard', asyncRoute(async (req,res) => {
    let studentId = req.query.studentId ? ensureUuid(req.query.studentId,'Student id') : null;
    const result = await withUserTransaction(req.principal,async (client) => {
      let student;
      if (studentId) {
        const found = await client.query(`SELECT id,first_name,last_name,grade_year,country,school,curriculum,subjects,current_level,learning_goals,improvement_areas FROM students WHERE id=$1`,[studentId]);
        if (!found.rowCount) fail(404,'NOT_FOUND','Student profile not found.');
        student = found.rows[0];
      } else if (req.principal.role !== 'admin' && req.principal.role !== 'teacher') {
        const found = await client.query(`SELECT id,first_name,last_name,grade_year,country,school,curriculum,subjects,current_level,learning_goals,improvement_areas FROM students ORDER BY first_name LIMIT 1`);
        student = found.rows[0] || null;
        studentId = student?.id || null;
      }
      if (!student) {
        const summary = await client.query(`SELECT count(*)::int AS students FROM students`);
        const classes = await client.query(`SELECT count(*)::int AS upcoming_classes FROM classes WHERE starts_at >= now() AND status='scheduled'`);
        const homework = await client.query(`SELECT count(*)::int AS to_review FROM homework_submissions WHERE status='submitted'`);
        const attendance = await client.query(`SELECT count(*) FILTER (WHERE status IN ('present','late'))::int AS attended,count(*)::int AS total FROM attendance_records`);
        const attendancePercent=attendance.rows[0].total?Math.round(attendance.rows[0].attended/attendance.rows[0].total*100):null;
        return { student:null, summary:{ students:summary.rows[0].students,upcomingClasses:classes.rows[0].upcoming_classes,submissionsToReview:homework.rows[0].to_review }, stats:{attendancePercent}, homework:[],classes:[],updates:[],tests:[],actions:[] };
      }
      const [homework,classes,updates,tests,attendance,actions] = await sequentialQueries([
        () => client.query(`SELECT h.id,h.subject,h.title,h.description,h.due_at,s.id AS submission_id,s.status AS submission_status,s.submitted_at,s.submission_text,s.teacher_feedback,s.score
          FROM homework h LEFT JOIN homework_submissions s ON s.homework_id=h.id AND s.student_id=h.student_id
          WHERE h.student_id=$1 ORDER BY h.due_at NULLS LAST,h.created_at DESC LIMIT 10`,[studentId]),
        () => client.query(`SELECT c.id,c.title,c.subject,c.topic,c.starts_at,c.duration_minutes,c.meeting_url,c.status,c.teacher_user_id,u.full_name AS teacher_name
          FROM classes c JOIN class_enrollments e ON e.class_id=c.id JOIN users u ON u.id=c.teacher_user_id
          WHERE e.student_id=$1 AND c.status='scheduled' AND c.starts_at >= now() ORDER BY c.starts_at LIMIT 5`,[studentId]),
        () => client.query(`SELECT id,subject,title,summary,teacher_observation,strengths,next_steps,concept_score,concept_max_score,created_at FROM learning_updates WHERE student_id=$1 ORDER BY created_at DESC LIMIT 5`,[studentId]),
        () => client.query(`SELECT id,subject,title,score,max_score,teacher_note,tested_at FROM test_results WHERE student_id=$1 ORDER BY tested_at DESC LIMIT 8`,[studentId]),
        () => client.query(`SELECT count(*) FILTER (WHERE status IN ('present','late'))::int AS attended,count(*)::int AS total FROM attendance_records WHERE student_id=$1`,[studentId]),
        () => client.query(`SELECT id,subject,title,description,practice_rhythm,due_at,completed_at FROM improvement_actions WHERE student_id=$1 ORDER BY completed_at NULLS FIRST,due_at NULLS LAST LIMIT 8`,[studentId]),
      ]);
      const counts = await client.query(`SELECT count(*)::int AS assigned,
        count(*) FILTER (WHERE s.status IN ('submitted','reviewed'))::int AS completed
        FROM homework h LEFT JOIN homework_submissions s ON s.homework_id=h.id AND s.student_id=h.student_id
        WHERE h.student_id=$1`,[studentId]);
      const average = await client.query('SELECT round(avg(score/max_score)*100)::int AS percent FROM test_results WHERE student_id=$1',[studentId]);
      const testAverage = average.rows[0].percent;
      const homeworkTotal = counts.rows[0].assigned;
      const completed = counts.rows[0].completed;
      return {
        student,
        stats:{ homeworkAssigned:homeworkTotal,homeworkCompleted:completed,homeworkPercent:homeworkTotal?Math.round(completed/homeworkTotal*100):null,testAverage,attendancePercent:attendance.rows[0].total?Math.round(attendance.rows[0].attended/attendance.rows[0].total*100):null,upcomingClasses:classes.rowCount },
        homework:homework.rows,classes:classes.rows,updates:updates.rows,tests:tests.rows,actions:actions.rows,
      };
    });
    res.json(result);
  }));

  api.get('/classes', asyncRoute(async (req,res) => {
    const studentId = req.query.studentId ? ensureUuid(req.query.studentId,'Student id') : null;
    const result = await withUserTransaction(req.principal,async (client) => {
      const values=[]; let where='';
      if (studentId) { values.push(studentId); where='AND e.student_id=$1'; }
      const rows = await client.query(`SELECT c.id,c.title,c.subject,c.curriculum,c.topic,c.starts_at,c.duration_minutes,c.meeting_url,c.status,c.teacher_user_id,u.full_name AS teacher_name,e.student_id
        FROM classes c JOIN users u ON u.id=c.teacher_user_id LEFT JOIN class_enrollments e ON e.class_id=c.id
        WHERE c.status <> 'cancelled' ${where} ORDER BY c.starts_at DESC LIMIT 100`,values);
      return rows.rows;
    });
    res.json({ classes:result });
  }));

  api.post('/classes', asyncRoute(async (req,res) => {
    requireRole(req.principal,['teacher','admin']);
    const body=req.body||{}; const subject=ensureSubject(body.subject); const title=requireText(body.title,'Class title',160);
    const topic=optionalText(body.topic,240); const curriculum=optionalText(body.curriculum,120);
    let classTeacherId=req.principal.id;
    if(req.principal.role==='admin'&&body.teacherId){classTeacherId=ensureUuid(body.teacherId,'Teacher id');}
    const startsAt=new Date(body.startsAt); const duration=Number(body.durationMinutes||45);
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime()<Date.now()-60_000) fail(400,'INVALID_TIME','Choose a valid upcoming class time.');
    if (!Number.isInteger(duration)||duration<10||duration>240) fail(400,'INVALID_DURATION','Class duration must be 10–240 minutes.');
    if (!Array.isArray(body.studentIds)||!body.studentIds.length||body.studentIds.length>40) fail(400,'INVALID_STUDENTS','Select at least one student.');
    const students=[...new Set(body.studentIds.map((id)=>ensureUuid(id,'Student id')))];
    const meetingUrl=optionalText(body.meetingUrl,500);
    if (meetingUrl && !/^https:\/\//i.test(meetingUrl)) fail(400,'INVALID_URL','Class link must use HTTPS.');
    const created=await withUserTransaction(req.principal,async(client)=>{
      const accessible=await client.query('SELECT id FROM students WHERE id=ANY($1::uuid[])',[students]);
      if (accessible.rowCount!==students.length) fail(404,'STUDENT_NOT_FOUND','One or more students are unavailable.');
      if(req.principal.role==='admin'){
        const teacher=await client.query("SELECT id FROM users WHERE id=$1 AND org_id=$2 AND role IN ('teacher','admin')",[classTeacherId,req.principal.orgId]);
        if(!teacher.rowCount)fail(404,'TEACHER_NOT_FOUND','The selected teacher is unavailable.');
      }
      const id=randomUUID();
      await client.query(`INSERT INTO classes(id,org_id,teacher_user_id,title,subject,curriculum,topic,starts_at,duration_minutes,meeting_url)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,req.principal.orgId,classTeacherId,title,subject,curriculum,topic,startsAt,duration,meetingUrl]);
      for (const student of students) await client.query('INSERT INTO class_enrollments(org_id,class_id,student_id) VALUES($1,$2,$3)',[req.principal.orgId,id,student]);
      await audit(client,req.principal,'class.created','class',id);
      return {id,title,subject,topic,startsAt,durationMinutes:duration,meetingUrl};
    });
    res.status(201).json({ class:created });
  }));

  api.get('/homework', asyncRoute(async (req,res) => {
    const studentId=req.query.studentId?ensureUuid(req.query.studentId,'Student id'):null;
    const rows=await withUserTransaction(req.principal,async(client)=>{
      const values=[]; let where=''; if(studentId){values.push(studentId);where='AND h.student_id=$1';}
      const out=await client.query(`SELECT h.id,h.student_id,h.subject,h.title,h.description,h.due_at,h.created_at,s.id AS submission_id,s.status AS submission_status,s.submitted_at,s.submission_text,s.teacher_feedback,s.score
        FROM homework h LEFT JOIN homework_submissions s ON s.homework_id=h.id AND s.student_id=h.student_id
        WHERE true ${where} ORDER BY h.due_at NULLS LAST,h.created_at DESC LIMIT 200`,values);
      return out.rows;
    });
    res.json({homework:rows});
  }));

  api.post('/homework', asyncRoute(async(req,res)=>{
    requireRole(req.principal,['teacher','admin']); const b=req.body||{};
    const studentId=ensureUuid(b.studentId,'Student id'); const subject=ensureSubject(b.subject); const title=requireText(b.title,'Title',180); const description=optionalText(b.description,3000);
    const dueAt=b.dueAt?new Date(b.dueAt):null; if(dueAt&&!Number.isFinite(dueAt.getTime()))fail(400,'INVALID_DATE','Due date is invalid.');
    const created=await withUserTransaction(req.principal,async(client)=>{
      const student=await client.query('SELECT id FROM students WHERE id=$1',[studentId]); if(!student.rowCount)fail(404,'NOT_FOUND','Student not found.');
      const id=randomUUID(); await client.query(`INSERT INTO homework(id,org_id,student_id,assigned_by,subject,title,description,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,req.principal.orgId,studentId,req.principal.id,subject,title,description,dueAt]);
      await audit(client,req.principal,'homework.assigned','homework',id); return {id,studentId,subject,title,description,dueAt};
    }); res.status(201).json({homework:created});
  }));

  api.post('/homework/:id/submit', asyncRoute(async(req,res)=>{
    requireRole(req.principal,['student']); const homeworkId=ensureUuid(req.params.id,'Homework id'); const submissionText=requireText(req.body?.text,'Submission',4000);
    const result=await withUserTransaction(req.principal,async(client)=>{
      const task=await client.query('SELECT id,student_id FROM homework WHERE id=$1',[homeworkId]); if(!task.rowCount)fail(404,'NOT_FOUND','Homework not found.');
      const id=randomUUID(); const saved=await client.query(`INSERT INTO homework_submissions(id,org_id,homework_id,student_id,submission_text) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(homework_id,student_id) DO UPDATE SET submission_text=EXCLUDED.submission_text,status='submitted',submitted_at=now(),teacher_feedback='',score=NULL
        WHERE homework_submissions.status <> 'reviewed'
        RETURNING id,homework_id,status,submitted_at`,[id,req.principal.orgId,homeworkId,task.rows[0].student_id,submissionText]);
      if (!saved.rowCount) fail(409,'ALREADY_REVIEWED','Reviewed homework cannot be resubmitted unless the teacher requests a revision.');
      await audit(client,req.principal,'homework.submitted','homework',homeworkId); return saved.rows[0];
    }); res.status(201).json({submission:result});
  }));

  api.patch('/homework/:id/feedback',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['teacher','admin']); const id=ensureUuid(req.params.id,'Submission id'); const feedback=optionalText(req.body?.feedback,2000); const score=req.body?.score===undefined||req.body?.score===null||req.body?.score===''?null:Number(req.body.score);const status=String(req.body?.status||'reviewed');
    if(!['reviewed','needs_revision'].includes(status))fail(400,'INVALID_STATUS','Choose reviewed or needs revision.');
    if(score!==null&&(!Number.isFinite(score)||score<0||score>100))fail(400,'INVALID_SCORE','Score must be between 0 and 100.');
    const result=await withUserTransaction(req.principal,async(client)=>{
      const updated=await client.query(`UPDATE homework_submissions SET teacher_feedback=$1,score=$2,status=$3,reviewed_by=$4 WHERE id=$5 RETURNING id,homework_id,status,teacher_feedback,score`,[feedback,score,status,req.principal.id,id]);
      if(!updated.rowCount)fail(404,'NOT_FOUND','Submission not found.'); await audit(client,req.principal,'homework.reviewed','submission',id); return updated.rows[0];
    });res.json({submission:result});
  }));

  api.get('/tests',asyncRoute(async(req,res)=>{
    const studentId=req.query.studentId?ensureUuid(req.query.studentId,'Student id'):null;
    const rows=await withUserTransaction(req.principal,async(client)=>{const values=[];let where='';if(studentId){values.push(studentId);where='AND student_id=$1';}return (await client.query(`SELECT id,student_id,subject,title,score,max_score,teacher_note,tested_at FROM test_results WHERE true ${where} ORDER BY tested_at DESC LIMIT 200`,values)).rows;});
    res.json({tests:rows});
  }));

  api.post('/tests',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['teacher','admin']);const b=req.body||{};const studentId=ensureUuid(b.studentId,'Student id');const subject=ensureSubject(b.subject);const title=requireText(b.title,'Test title',180);const [score,maxScore]=ensureScore(b.score,b.maxScore);const note=optionalText(b.teacherNote,2000);
    const row=await withUserTransaction(req.principal,async(client)=>{if(!(await client.query('SELECT id FROM students WHERE id=$1',[studentId])).rowCount)fail(404,'NOT_FOUND','Student not found.');const id=randomUUID();await client.query('INSERT INTO test_results(id,org_id,student_id,created_by,subject,title,score,max_score,teacher_note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,req.principal.orgId,studentId,req.principal.id,subject,title,score,maxScore,note]);await audit(client,req.principal,'test.recorded','test_result',id);return {id,studentId,subject,title,score,maxScore,teacherNote:note};});res.status(201).json({test:row});
  }));

  api.get('/attendance',asyncRoute(async(req,res)=>{const studentId=req.query.studentId?ensureUuid(req.query.studentId,'Student id'):null;const rows=await withUserTransaction(req.principal,async(client)=>{const values=[];let where='';if(studentId){values.push(studentId);where='AND a.student_id=$1';}return (await client.query(`SELECT a.id,a.student_id,a.class_id,a.status,a.note,a.marked_at,c.title,c.subject,c.starts_at FROM attendance_records a JOIN classes c ON c.id=a.class_id WHERE true ${where} ORDER BY a.marked_at DESC LIMIT 200`,values)).rows;});res.json({attendance:rows});}));

  api.post('/attendance',asyncRoute(async(req,res)=>{requireRole(req.principal,['teacher','admin']);const b=req.body||{};const classId=ensureUuid(b.classId,'Class id');const studentId=ensureUuid(b.studentId,'Student id');const status=String(b.status||'');if(!['present','late','absent','excused'].includes(status))fail(400,'INVALID_STATUS','Attendance status is invalid.');const note=optionalText(b.note,500);const row=await withUserTransaction(req.principal,async(client)=>{const enrollment=await client.query(`SELECT e.student_id FROM class_enrollments e JOIN classes c ON c.id=e.class_id WHERE e.class_id=$1 AND e.student_id=$2`,[classId,studentId]);if(!enrollment.rowCount)fail(404,'NOT_FOUND','Class enrollment not found.');const id=randomUUID();await client.query(`INSERT INTO attendance_records(id,org_id,class_id,student_id,marked_by,status,note) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(class_id,student_id) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,marked_by=EXCLUDED.marked_by,marked_at=now() RETURNING id,class_id,student_id,status,note,marked_at`,[id,req.principal.orgId,classId,studentId,req.principal.id,status,note]);await audit(client,req.principal,'attendance.marked','attendance',id);return (await client.query('SELECT id,class_id,student_id,status,note,marked_at FROM attendance_records WHERE class_id=$1 AND student_id=$2',[classId,studentId])).rows[0];});res.status(201).json({attendance:row});}));

  api.get('/updates',asyncRoute(async(req,res)=>{const studentId=req.query.studentId?ensureUuid(req.query.studentId,'Student id'):null;const rows=await withUserTransaction(req.principal,async(client)=>{const values=[];let where='';if(studentId){values.push(studentId);where='AND student_id=$1';}return (await client.query(`SELECT id,student_id,teacher_user_id,subject,title,summary,teacher_observation,strengths,next_steps,concept_score,concept_max_score,created_at FROM learning_updates WHERE true ${where} ORDER BY created_at DESC LIMIT 100`,values)).rows;});res.json({updates:rows});}));

  api.post('/updates',asyncRoute(async(req,res)=>{requireRole(req.principal,['teacher','admin']);const b=req.body||{};const studentId=ensureUuid(b.studentId,'Student id');const subject=ensureSubject(b.subject);const title=requireText(b.title,'Title',180);const summary=requireText(b.summary,'Summary',2500);const observation=optionalText(b.teacherObservation,1800);const strengths=asArray(b.strengths||[],'Strengths');const nextSteps=asArray(b.nextSteps||[],'Next steps');let score=null,max=null;if(b.conceptScore!==undefined||b.conceptMaxScore!==undefined)[score,max]=ensureScore(b.conceptScore,b.conceptMaxScore);const row=await withUserTransaction(req.principal,async(client)=>{if(!(await client.query('SELECT id FROM students WHERE id=$1',[studentId])).rowCount)fail(404,'NOT_FOUND','Student not found.');const id=randomUUID();await client.query(`INSERT INTO learning_updates(id,org_id,student_id,teacher_user_id,subject,title,summary,teacher_observation,strengths,next_steps,concept_score,concept_max_score) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[id,req.principal.orgId,studentId,req.principal.id,subject,title,summary,observation,strengths,nextSteps,score,max]);await audit(client,req.principal,'learning_update.created','learning_update',id);return (await client.query('SELECT id,student_id,subject,title,summary,teacher_observation,strengths,next_steps,concept_score,concept_max_score,created_at FROM learning_updates WHERE id=$1',[id])).rows[0];});res.status(201).json({update:row});}));

  api.get('/improvement-plan',asyncRoute(async(req,res)=>{const studentId=req.query.studentId?ensureUuid(req.query.studentId,'Student id'):null;const rows=await withUserTransaction(req.principal,async(client)=>{const values=[];let where='';if(studentId){values.push(studentId);where='AND student_id=$1';}return (await client.query(`SELECT id,student_id,created_by,subject,title,description,practice_rhythm,due_at,completed_at,created_at FROM improvement_actions WHERE true ${where} ORDER BY completed_at NULLS FIRST,due_at NULLS LAST`,values)).rows;});res.json({actions:rows});}));

  api.post('/improvement-plan',asyncRoute(async(req,res)=>{requireRole(req.principal,['teacher','admin']);const b=req.body||{};const studentId=ensureUuid(b.studentId,'Student id');const subject=ensureSubject(b.subject);const title=requireText(b.title,'Title',180);const description=optionalText(b.description,1200);const rhythm=optionalText(b.practiceRhythm,160);const dueAt=b.dueAt?new Date(b.dueAt):null;if(dueAt&&!Number.isFinite(dueAt.getTime()))fail(400,'INVALID_DATE','Due date is invalid.');const row=await withUserTransaction(req.principal,async(client)=>{if(!(await client.query('SELECT id FROM students WHERE id=$1',[studentId])).rowCount)fail(404,'NOT_FOUND','Student not found.');const id=randomUUID();await client.query(`INSERT INTO improvement_actions(id,org_id,student_id,created_by,subject,title,description,practice_rhythm,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,req.principal.orgId,studentId,req.principal.id,subject,title,description,rhythm,dueAt]);await audit(client,req.principal,'improvement_action.created','improvement_action',id);return (await client.query('SELECT id,student_id,subject,title,description,practice_rhythm,due_at,completed_at FROM improvement_actions WHERE id=$1',[id])).rows[0];});res.status(201).json({action:row});}));

  api.patch('/improvement-plan/:id',asyncRoute(async(req,res)=>{const id=ensureUuid(req.params.id,'Action id');const completed=!!req.body?.completed;const row=await withUserTransaction(req.principal,async(client)=>{const result=await client.query(`UPDATE improvement_actions SET completed_at=CASE WHEN $1 THEN COALESCE(completed_at,now()) ELSE NULL END WHERE id=$2 RETURNING id,student_id,subject,title,description,practice_rhythm,due_at,completed_at`,[completed,id]);if(!result.rowCount)fail(404,'NOT_FOUND','Improvement step not found.');await audit(client,req.principal,completed?'improvement.completed':'improvement.reopened','improvement_action',id);return result.rows[0];});res.json({action:row});}));

  api.get('/messages',asyncRoute(async(req,res)=>{const studentId=req.query.studentId?ensureUuid(req.query.studentId,'Student id'):null;if(!studentId)fail(400,'STUDENT_REQUIRED','Select a student conversation.');const rows=await withUserTransaction(req.principal,(client)=>client.query(`SELECT m.id,m.student_id,m.sender_user_id,u.full_name AS sender_name,u.role AS sender_role,m.body,m.created_at FROM messages m JOIN users u ON u.id=m.sender_user_id WHERE m.student_id=$1 ORDER BY m.created_at ASC LIMIT 250`,[studentId]));res.json({messages:rows.rows});}));

  api.post('/messages',asyncRoute(async(req,res)=>{const studentId=ensureUuid(req.body?.studentId,'Student id');const body=requireText(req.body?.body,'Message',4000);const row=await withUserTransaction(req.principal,async(client)=>{if(!(await client.query('SELECT id FROM students WHERE id=$1',[studentId])).rowCount)fail(404,'NOT_FOUND','Student not found.');const id=randomUUID();await client.query('INSERT INTO messages(id,org_id,student_id,sender_user_id,body) VALUES($1,$2,$3,$4,$5)',[id,req.principal.orgId,studentId,req.principal.id,body]);await audit(client,req.principal,'message.sent','message',id);return (await client.query(`SELECT m.id,m.student_id,m.sender_user_id,u.full_name AS sender_name,u.role AS sender_role,m.body,m.created_at FROM messages m JOIN users u ON u.id=m.sender_user_id WHERE m.id=$1`,[id])).rows[0];});res.status(201).json({message:row});}));

  api.get('/invoices',asyncRoute(async(req,res)=>{requireRole(req.principal,['parent','admin']);const studentId=req.query.studentId?ensureUuid(req.query.studentId,'Student id'):null;const rows=await withUserTransaction(req.principal,async(client)=>{const values=[];let where='';if(studentId){values.push(studentId);where='AND student_id=$1';}return (await client.query(`SELECT id,student_id,invoice_number,amount_minor,currency,due_at,status,provider_reference,created_at FROM invoices WHERE true ${where} ORDER BY created_at DESC LIMIT 100`,values)).rows;});res.json({invoices:rows});}));

  api.post('/invoices',asyncRoute(async(req,res)=>{requireRole(req.principal,['admin']);const b=req.body||{};const studentId=ensureUuid(b.studentId,'Student id');const invoiceNumber=requireText(b.invoiceNumber,'Invoice number',60);const amountMinor=Number(b.amountMinor);const currency=requireText(b.currency,'Currency',3).toUpperCase();if(!Number.isSafeInteger(amountMinor)||amountMinor<0||!/^[A-Z]{3}$/.test(currency))fail(400,'INVALID_AMOUNT','Provide a non-negative integer amount in minor units and ISO currency.');const dueAt=b.dueAt?new Date(b.dueAt):null;if(dueAt&&!Number.isFinite(dueAt.getTime()))fail(400,'INVALID_DATE','Due date is invalid.');const row=await withUserTransaction(req.principal,async(client)=>{if(!(await client.query('SELECT id FROM students WHERE id=$1',[studentId])).rowCount)fail(404,'NOT_FOUND','Student not found.');const id=randomUUID();await client.query(`INSERT INTO invoices(id,org_id,student_id,invoice_number,amount_minor,currency,due_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,req.principal.orgId,studentId,invoiceNumber,amountMinor,currency,dueAt]);await audit(client,req.principal,'invoice.created','invoice',id);return (await client.query('SELECT id,student_id,invoice_number,amount_minor,currency,due_at,status,created_at FROM invoices WHERE id=$1',[id])).rows[0];});res.status(201).json({invoice:row});}));

  api.get('/materials',asyncRoute(async(req,res)=>{const rows=await withUserTransaction(req.principal,(client)=>client.query(`SELECT id,subject,curriculum,grade_year,title,description,resource_url,resource_type,created_at FROM learning_materials ORDER BY subject,title LIMIT 200`));res.json({materials:rows.rows});}));

  api.post('/materials',asyncRoute(async(req,res)=>{requireRole(req.principal,['teacher','admin']);const b=req.body||{};const subject=ensureSubject(b.subject);const title=requireText(b.title,'Title',180);const curriculum=optionalText(b.curriculum,120);const gradeYear=optionalText(b.gradeYear,40);const description=optionalText(b.description,1200);const url=requireText(b.resourceUrl,'Resource URL',1000);let parsed;try{parsed=new URL(url);}catch{fail(400,'INVALID_URL','Resource URL is invalid.');}if(parsed.protocol!=='https:')fail(400,'INVALID_URL','Learning materials must use HTTPS.');const type=String(b.resourceType||'link');if(!['link','document','video','interactive'].includes(type))fail(400,'INVALID_TYPE','Resource type is invalid.');const row=await withUserTransaction(req.principal,async(client)=>{const id=randomUUID();await client.query(`INSERT INTO learning_materials(id,org_id,subject,curriculum,grade_year,title,description,resource_url,resource_type,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,req.principal.orgId,subject,curriculum,gradeYear,title,description,url,type,req.principal.id]);await audit(client,req.principal,'material.created','learning_material',id);return (await client.query('SELECT id,subject,curriculum,grade_year,title,description,resource_url,resource_type,created_at FROM learning_materials WHERE id=$1',[id])).rows[0];});res.status(201).json({material:row});}));

  api.get('/articles',asyncRoute(async(req,res)=>{
    rateLimit(`public-articles:${req.ip}`,120,15*60*1000);
    const slug=String(req.query.organizationSlug||'').trim().toLowerCase();
    const org=await findOrgBySlug(slug);
    if(!org)fail(404,'NOT_FOUND','Website organization not found.');
    const rows=await withPublicOrganizationTransaction(org.id,(client)=>client.query(`
      SELECT id,title,category,excerpt,content,author_name,published,created_at,updated_at
      FROM website_articles WHERE published=true ORDER BY updated_at DESC LIMIT 50
    `));
    res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=300');
    res.json({articles:rows.rows});
  }));

  api.get('/admin/articles',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    const rows=await withUserTransaction(req.principal,(client)=>client.query(`
      SELECT id,title,category,excerpt,content,author_name,published,created_at,updated_at
      FROM website_articles ORDER BY updated_at DESC LIMIT 200
    `));
    res.json({articles:rows.rows});
  }));

  api.post('/admin/articles',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    rateLimit(`article-create:${req.principal.id}`,60,60*60*1000);
    const article=validateWebsiteArticle(req.body||{});
    const row=await withUserTransaction(req.principal,async(client)=>{
      const id=randomUUID();
      const inserted=await client.query(`INSERT INTO website_articles(id,org_id,title,category,excerpt,content,author_name,published,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id,title,category,excerpt,content,author_name,published,created_at,updated_at`,
        [id,req.principal.orgId,article.title,article.category,article.excerpt,article.content,req.principal.name,article.published,req.principal.id]);
      await audit(client,req.principal,'website_article.created','website_article',id);
      return inserted.rows[0];
    });
    res.status(201).json({article:row});
  }));

  api.patch('/admin/articles/:id',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    const id=ensureUuid(req.params.id,'Article id');
    const article=validateWebsiteArticle(req.body||{});
    const row=await withUserTransaction(req.principal,async(client)=>{
      const updated=await client.query(`UPDATE website_articles SET title=$1,category=$2,excerpt=$3,content=$4,published=$5,updated_at=now()
        WHERE id=$6 RETURNING id,title,category,excerpt,content,author_name,published,created_at,updated_at`,
        [article.title,article.category,article.excerpt,article.content,article.published,id]);
      if(!updated.rowCount)fail(404,'NOT_FOUND','Article not found.');
      await audit(client,req.principal,'website_article.updated','website_article',id);
      return updated.rows[0];
    });
    res.json({article:row});
  }));

  api.delete('/admin/articles/:id',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    const id=ensureUuid(req.params.id,'Article id');
    const deleted=await withUserTransaction(req.principal,async(client)=>{
      const result=await client.query('DELETE FROM website_articles WHERE id=$1 RETURNING id',[id]);
      if(!result.rowCount)fail(404,'NOT_FOUND','Article not found.');
      await audit(client,req.principal,'website_article.deleted','website_article',id);
      return result.rows[0];
    });
    res.json({deleted:true,id:deleted.id});
  }));

  api.get('/enquiries',asyncRoute(async(req,res)=>{requireRole(req.principal,['admin']);const rows=await withUserTransaction(req.principal,(client)=>client.query(`SELECT id,parent_name,email,phone,interest,enquiry_type,country,grade_year,subject,message,status,created_at FROM enquiries ORDER BY created_at DESC LIMIT 200`));res.json({enquiries:rows.rows});}));

  api.post('/enquiries',asyncRoute(async(req,res)=>{
    rateLimit(`enquiry:${req.ip}`,6,60*60*1000);
    const body=req.body||{};
    const org=await findOrgBySlug(body.organizationSlug);
    if(!org)fail(404,'NOT_FOUND','Learning organization not found.');
    const enquiryType=String(body.enquiryType||'admission');
    if(!['admission','contact'].includes(enquiryType))fail(400,'INVALID_ENQUIRY_TYPE','Enquiry type is invalid.');
    const name=requireText(enquiryType==='contact'?(body.name||body.parentName):body.parentName,enquiryType==='contact'?'Name':'Parent name',120);
    const email=normalizeEmail(body.email);
    if(!EMAIL_RE.test(email)||email.length>254)fail(400,'INVALID_EMAIL','Enter a valid email address.');
    const phone=optionalText(body.phone,40);
    if(phone&&!/^[+()\d .-]{5,40}$/.test(phone))fail(400,'INVALID_PHONE','Enter a valid phone number.');
    const interest=enquiryType==='contact'?requireText(body.interest,'Interest',40):optionalText(body.interest,40);
    if(enquiryType==='contact'&&!CONTACT_INTERESTS.has(interest))fail(400,'INVALID_INTEREST','Choose a supported area of interest.');
    const country=enquiryType==='admission'?requireText(body.country,'Country',100):optionalText(body.country,100)||null;
    const grade=enquiryType==='admission'?ensureGrade(body.gradeYear):null;
    const subject=enquiryType==='admission'?ensureSubject(body.subject):null;
    const message=optionalText(body.message,1500);
    const row=await withPublicOrganizationTransaction(org.id,async(client)=>{
      const id=randomUUID();
      await client.query(`INSERT INTO enquiries(id,org_id,parent_name,email,phone,interest,enquiry_type,country,grade_year,subject,message)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id,org.id,name,email,phone,interest,enquiryType,country,grade,subject,message]);
      return {id};
    });
    res.status(201).json({received:true,enquiryId:row.id,message:'Thank you. Your message has been received.'});
  }));

  api.patch('/enquiries/:id',asyncRoute(async(req,res)=>{requireRole(req.principal,['admin']);const id=ensureUuid(req.params.id,'Enquiry id');const status=String(req.body?.status||'');if(!['new','contacted','enrolled','closed'].includes(status))fail(400,'INVALID_STATUS','Enquiry status is invalid.');const row=await withUserTransaction(req.principal,async(client)=>{const updated=await client.query('UPDATE enquiries SET status=$1 WHERE id=$2 RETURNING id,status',[status,id]);if(!updated.rowCount)fail(404,'NOT_FOUND','Enquiry not found.');await audit(client,req.principal,'enquiry.updated','enquiry',id);return updated.rows[0];});res.json({enquiry:row});}));

  api.post('/students/:id/invite',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['parent','admin']);
    rateLimit(`student-invite:${req.principal.id}`,10,60*60*1000);
    const studentId=ensureUuid(req.params.id,'Student id');
    const email=normalizeEmail(req.body?.email);
    if(!EMAIL_RE.test(email)||email.length>254)fail(400,'INVALID_EMAIL','Enter a valid student email address.');
    let user,token;
    try{
      await withUserTransaction(req.principal,async(client)=>{
        const student=await client.query('SELECT id,org_id,linked_user_id,first_name,last_name FROM students WHERE id=$1',[studentId]);
        if(!student.rowCount)fail(404,'NOT_FOUND','Student profile not found.');
        if(student.rows[0].linked_user_id){
          const existing=await client.query("SELECT id,org_id,email,full_name,role,status FROM users WHERE id=$1 AND org_id=$2 AND role='student'",[student.rows[0].linked_user_id,req.principal.orgId]);
          if(!existing.rowCount||existing.rows[0].status!=='pending'||existing.rows[0].email!==email)fail(409,'STUDENT_ALREADY_LINKED','This student already has an account, or a different invitation is pending.');
          user=existing.rows[0];
          token=await createEmailToken(client,user.id,'invite');
          await audit(client,req.principal,'student.invitation_resent','student',studentId);
        }else{
          const fullName=`${student.rows[0].first_name} ${student.rows[0].last_name||''}`.trim();
          const pendingPassword=await hashPassword(randomToken());
          const created=await client.query(`INSERT INTO users(org_id,email,full_name,role,password_hash,status)
            VALUES($1,$2,$3,'student',$4,'pending') RETURNING id,org_id,email,full_name,role,status`,[req.principal.orgId,email,fullName,pendingPassword]);
          user=created.rows[0];
          await client.query('UPDATE students SET linked_user_id=$1,updated_at=now() WHERE id=$2',[user.id,studentId]);
          token=await createEmailToken(client,user.id,'invite');
          await audit(client,req.principal,'student.invited','student',studentId);
        }
      });
    }catch(error){if(error.code==='23505')fail(409,'ACCOUNT_EXISTS','An account with that email already exists.');throw error;}
    await sendAccountLink(user,'invite',token);
    res.status(201).json({message:'A one-time student activation link has been sent.'});
  }));

  api.post('/admin/users',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    rateLimit(`admin-invite:${req.principal.id}`,30,60*60*1000);
    const email=normalizeEmail(req.body?.email);if(!EMAIL_RE.test(email)||email.length>254)fail(400,'INVALID_EMAIL','Enter a valid email address.');
    const name=requireText(req.body?.name,'Full name',120);const role=String(req.body?.role||'');
    if(!['teacher','student'].includes(role))fail(400,'INVALID_ROLE','Only teacher or student accounts can be provisioned here.');
    const studentId=role==='student'?ensureUuid(req.body?.studentId,'Student id'):null;
    let user,token;
    try{
      await withUserTransaction(req.principal,async(client)=>{
        if(studentId){const student=await client.query('SELECT id,linked_user_id FROM students WHERE id=$1',[studentId]);if(!student.rowCount)fail(404,'NOT_FOUND','Student profile not found.');if(student.rows[0].linked_user_id)fail(409,'STUDENT_ALREADY_LINKED','This student already has a sign-in account.');}
        const pendingPassword=await hashPassword(randomToken());
        const created=await client.query(`INSERT INTO users(org_id,email,full_name,role,password_hash,status)
          VALUES($1,$2,$3,$4,$5,'pending') RETURNING id,org_id,email,full_name,role`,[req.principal.orgId,email,name,role,pendingPassword]);
        user=created.rows[0];
        if(studentId)await client.query('UPDATE students SET linked_user_id=$1,updated_at=now() WHERE id=$2',[user.id,studentId]);
        token=await createEmailToken(client,user.id,'invite');
        await audit(client,req.principal,'account.invited',role,user.id);
      });
    }catch(error){if(error.code==='23505')fail(409,'ACCOUNT_EXISTS','An account with that email already exists.');throw error;}
    await sendAccountLink(user,'invite',token);
    res.status(201).json({message:`A one-time ${role} activation link has been sent.`});
  }));

  api.post('/admin/users/:id/resend-invite',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    rateLimit(`admin-resend:${req.principal.id}`,30,60*60*1000);
    const userId=ensureUuid(req.params.id,'User id');let user,token;
    await withUserTransaction(req.principal,async(client)=>{
      const found=await client.query("SELECT id,org_id,email,full_name,role,status FROM users WHERE id=$1 AND org_id=$2 AND role IN ('teacher','student')",[userId,req.principal.orgId]);
      if(!found.rowCount||found.rows[0].status!=='pending')fail(404,'PENDING_ACCOUNT_NOT_FOUND','Pending teacher or student account not found.');
      user=found.rows[0];token=await createEmailToken(client,user.id,'invite');
      await audit(client,req.principal,'account.invitation_resent',user.role,user.id);
    });
    await sendAccountLink(user,'invite',token);
    res.json({message:'A fresh one-time activation link has been sent.'});
  }));

  api.get('/admin/parents',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    const result=await getPool().query("SELECT id,email,full_name FROM users WHERE org_id=$1 AND role='parent' AND status='active' AND email_verified_at IS NOT NULL ORDER BY full_name",[req.principal.orgId]);
    res.json({parents:result.rows});
  }));

  api.post('/admin/student-guardians',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    const studentId=ensureUuid(req.body?.studentId,'Student id');
    const email=normalizeEmail(req.body?.parentEmail);if(!EMAIL_RE.test(email)||email.length>254)fail(400,'INVALID_EMAIL','Enter a valid parent email address.');
    const relationship=requireText(req.body?.relationship||'Parent','Relationship',60);
    const isPrimary=Boolean(req.body?.isPrimary);
    await withUserTransaction(req.principal,async(client)=>{
      if(!(await client.query('SELECT id FROM students WHERE id=$1',[studentId])).rowCount)fail(404,'NOT_FOUND','Student not found.');
      const parent=await client.query("SELECT id FROM users WHERE org_id=$1 AND email=$2 AND role='parent' AND status='active' AND email_verified_at IS NOT NULL",[req.principal.orgId,email]);
      if(!parent.rowCount)fail(404,'PARENT_NOT_FOUND','Verified parent account not found in this organization.');
      if(isPrimary)await client.query('UPDATE student_guardians SET is_primary=false WHERE org_id=$1 AND student_id=$2',[req.principal.orgId,studentId]);
      await client.query(`INSERT INTO student_guardians(org_id,student_id,guardian_user_id,relationship,is_primary)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(student_id,guardian_user_id) DO UPDATE SET relationship=EXCLUDED.relationship,is_primary=EXCLUDED.is_primary`,[req.principal.orgId,studentId,parent.rows[0].id,relationship,isPrimary]);
      await audit(client,req.principal,'student.guardian_linked','student',studentId);
    });
    res.status(201).json({linked:true});
  }));

  api.get('/admin/teachers',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    const result=await withUserTransaction(req.principal,(client)=>client.query(`SELECT id,email,full_name,status FROM users WHERE org_id=$1 AND role='teacher' ORDER BY full_name`,[req.principal.orgId]));
    res.json({teachers:result.rows});
  }));

  api.get('/admin/teacher-assignments',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    const result=await withUserTransaction(req.principal,(client)=>client.query(`SELECT a.teacher_user_id,a.student_id,a.subject,u.full_name AS teacher_name,u.email AS teacher_email,s.first_name,s.last_name,s.grade_year
      FROM teacher_assignments a JOIN users u ON u.id=a.teacher_user_id JOIN students s ON s.id=a.student_id
      WHERE a.org_id=$1 ORDER BY u.full_name,s.first_name,a.subject`,[req.principal.orgId]));
    res.json({assignments:result.rows});
  }));

  api.post('/admin/teacher-assignments',asyncRoute(async(req,res)=>{requireRole(req.principal,['admin']);const teacherId=ensureUuid(req.body?.teacherId,'Teacher id');const studentId=ensureUuid(req.body?.studentId,'Student id');const subject=ensureSubject(req.body?.subject);await withUserTransaction(req.principal,async(client)=>{const teacher=await client.query("SELECT id FROM users WHERE id=$1 AND org_id=$2 AND role='teacher'",[teacherId,req.principal.orgId]);const student=await client.query('SELECT id FROM students WHERE id=$1',[studentId]);if(!teacher.rowCount||!student.rowCount)fail(404,'NOT_FOUND','Teacher or student not found in this organization.');await client.query('INSERT INTO teacher_assignments(org_id,teacher_user_id,student_id,subject) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[req.principal.orgId,teacherId,studentId,subject]);await audit(client,req.principal,'teacher.assigned','student',studentId);});res.status(201).json({assigned:true});}));

  api.delete('/admin/teacher-assignments',asyncRoute(async(req,res)=>{
    requireRole(req.principal,['admin']);
    const teacherId=ensureUuid(req.body?.teacherId,'Teacher id');
    const studentId=ensureUuid(req.body?.studentId,'Student id');
    const subject=ensureSubject(req.body?.subject);
    const removed=await withUserTransaction(req.principal,async(client)=>{
      const result=await client.query('DELETE FROM teacher_assignments WHERE org_id=$1 AND teacher_user_id=$2 AND student_id=$3 AND subject=$4 RETURNING student_id',[req.principal.orgId,teacherId,studentId,subject]);
      if(result.rowCount)await audit(client,req.principal,'teacher.assignment_removed','student',studentId);
      return result.rowCount;
    });
    res.json({removed:removed>0});
  }));

  api.get('/reports',asyncRoute(async(req,res)=>{const studentId=req.query.studentId?ensureUuid(req.query.studentId,'Student id'):null;if(!studentId)fail(400,'STUDENT_REQUIRED','Select a student to view a report.');const report=await withUserTransaction(req.principal,async(client)=>{const student=await client.query('SELECT id,first_name,last_name,grade_year,curriculum,subjects FROM students WHERE id=$1',[studentId]);if(!student.rowCount)fail(404,'NOT_FOUND','Student not found.');const [scores,attendance,homework,updates]=await sequentialQueries([
      () => client.query(`SELECT subject,round(avg(score/max_score)*100,1) AS average,count(*)::int AS tests FROM test_results WHERE student_id=$1 GROUP BY subject ORDER BY subject`,[studentId]),
      () => client.query(`SELECT status,count(*)::int AS total FROM attendance_records WHERE student_id=$1 GROUP BY status`,[studentId]),
      () => client.query(`SELECT h.subject,count(*)::int AS assigned,count(s.id)::int AS submitted FROM homework h LEFT JOIN homework_submissions s ON s.homework_id=h.id AND s.student_id=h.student_id WHERE h.student_id=$1 GROUP BY h.subject ORDER BY h.subject`,[studentId]),
      () => client.query(`SELECT subject,title,summary,teacher_observation,strengths,next_steps,created_at FROM learning_updates WHERE student_id=$1 ORDER BY created_at DESC LIMIT 20`,[studentId]),
    ]);return {student:student.rows[0],scores:scores.rows,attendance:attendance.rows,homework:homework.rows,updates:updates.rows};});res.json({report});}));

  api.use((req,res,next)=>next(new HttpError(404,'API_NOT_FOUND','API route not found.')));
  app.use('/api',api);

  // The compiled SPA is served from the same origin as the API, which is what keeps session
  // cookies, the CSRF double-submit pair and the content security policy same-site. This is
  // enabled whenever a build exists (web/dist/index.html); `npm run build` creates it and the
  // Docker image copies it in. Without a build, only the API responds — start `npm run dev`
  // for the Vite development server instead.
  const webDist = fileURLToPath(new URL('../web/dist/', import.meta.url));
  const indexFile = join(webDist, 'index.html');
  if (existsSync(indexFile)) {
    app.use(express.static(webDist, {
      index: false,
      immutable: true,
      maxAge: '1h',
      setHeaders(res, file) {
        // The shell, the service worker and the manifest must never be cached, or installed
        // apps keep running an old build.
        if (file.endsWith(`${sep}sw.js`) || file.endsWith(`${sep}manifest.webmanifest`)) res.setHeader('Cache-Control', 'no-cache');
      },
    }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(indexFile, (error) => (error ? next(error) : undefined));
    });
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('web/dist/index.html was not found: run `npm run build` so the server can serve the portal.');
  }

  app.use((error,req,res,_next)=>{
    if (res.headersSent) return;
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({error:'INVALID_JSON',message:'Request body must be valid JSON.'});
    if (error.code==='23505') return res.status(409).json({error:'CONFLICT',message:'A record with those details already exists.'});
    if (error.code==='23503'||error.code==='23514') return res.status(400).json({error:'INVALID_REFERENCE',message:'One or more selected records are invalid.'});
    if (error.code==='42501') return res.status(404).json({error:'NOT_FOUND',message:'The requested record is unavailable.'});
    const status=error.status||500;
    if(status>=500) console.error('API error', {path:req.path,code:error.code||'INTERNAL'});
    res.status(status).json({error:error.code||'INTERNAL_ERROR',message:status>=500?'The service could not complete that request.':error.message});
  });
  return app;
}
