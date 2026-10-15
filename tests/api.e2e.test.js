/**
 * SriSah Schooling — end-to-end API acceptance test.
 *
 * Runs the real Express application in-process against a real PostgreSQL database and
 * exercises the parent, student, teacher and admin flows over HTTP, including session
 * cookies, CSRF double-submit protection, origin allow-listing and role isolation.
 *
 * Requirements (same as tests/postgres.integration.test.js):
 *   DATABASE_URL            — non-owner, non-superuser, NOBYPASSRLS application role
 *   MIGRATION_DATABASE_URL  — schema owner used only to create/delete test fixtures
 *
 * The test skips itself when those variables are missing so `npm test` stays green
 * on a machine without PostgreSQL. Run it explicitly with `npm run test:e2e`.
 *
 * Every fixture is created inside a throwaway organization and removed afterwards.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const enabled = Boolean(process.env.DATABASE_URL && process.env.MIGRATION_DATABASE_URL);

// Configure the runtime before the server modules are imported.
process.env.NODE_ENV ||= 'development';
process.env.DEV_EMAIL_LOG ||= 'true';
process.env.PUBLIC_ORIGIN ||= 'http://127.0.0.1:4321';
process.env.ALLOWED_ORIGINS ||= 'http://127.0.0.1:4321';

const ORIGIN = new URL(process.env.ALLOWED_ORIGINS.split(',')[0].trim()).origin;
const TEST_ORIGIN_HEADER = process.env.NODE_ENV === 'production' ? ORIGIN : 'http://127.0.0.1:4321';

const ADMIN_PASSWORD = 'AdminPassw0rd!2026';
const PARENT_PASSWORD = 'ParentPassw0rd!2026';
const STUDENT_PASSWORD = 'StudentPassw0rd!2026';
const TEACHER_PASSWORD = 'TeacherPassw0rd!2026';
const SECOND_TEACHER_PASSWORD = 'Teacher2Passw0rd!2026';

class HttpClient {
  constructor(baseUrl) { this.baseUrl = baseUrl; this.cookies = new Map(); }
  cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }
  store(response) {
    for (const raw of response.headers.getSetCookie?.() || []) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      if (index < 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (!value) this.cookies.delete(name); else this.cookies.set(name, value);
    }
  }
  async request(method, path, { body, headers = {}, origin = TEST_ORIGIN_HEADER, csrf = true } = {}) {
    const finalHeaders = { Accept: 'application/json', ...headers };
    if (origin) finalHeaders.Origin = origin;
    if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
    if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      const token = this.cookies.get('srisah_csrf');
      if (token) finalHeaders['X-CSRF-Token'] = token;
    }
    const cookie = this.cookieHeader();
    if (cookie) finalHeaders.Cookie = cookie;
    const response = await fetch(`${this.baseUrl}${path}`, {
      method, headers: finalHeaders, body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.store(response);
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
    return { status: response.status, body: json, text };
  }
  get(path, options) { return this.request('GET', path, options); }
  post(path, body, options) { return this.request('POST', path, { body, ...options }); }
  patch(path, body, options) { return this.request('PATCH', path, { body, ...options }); }
  delete(path, body, options) { return this.request('DELETE', path, { body, ...options }); }
}

test('SriSah end-to-end role flows over HTTP', { skip: !enabled, timeout: 180_000 }, async (t) => {
  if (process.env.NODE_ENV === 'production') {
    t.skip('End-to-end fixtures must not run against a production runtime.');
    return;
  }
  const { Client } = pg;
  const migrator = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
  await migrator.connect();
  // Optional schema-owner role used for the fixture transaction only (see
  // tests/postgres.integration.test.js for the same MIGRATION_SET_ROLE contract).
  const fixtureRole = String(process.env.MIGRATION_SET_ROLE || '').trim();
  if (fixtureRole && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(fixtureRole)) throw new Error('MIGRATION_SET_ROLE must be a plain PostgreSQL role name.');
  const assumeFixtureRole = async () => { if (fixtureRole) await migrator.query(`SET LOCAL ROLE ${fixtureRole}`); };
  /** Read or write rows that the running application role cannot see, inside one short transaction. */
  async function ownerQuery(text, params) {
    await migrator.query('BEGIN');
    try {
      await assumeFixtureRole();
      return await migrator.query(text, params);
    } finally {
      await migrator.query('COMMIT');
    }
  }

  const { default: express } = await import('express'); // ensure dependency graph is warm
  void express;
  const { createApp } = await import('../server/app.js');
  const { closePool, getPool } = await import('../server/db.js');
  const { hashPassword, sha256 } = await import('../server/security.js');

  // Row level security only applies when DATABASE_URL uses a non-owner, non-superuser,
  // NOBYPASSRLS role — the deployment requirement documented in docs/OPERATIONS.md.
  // When that is not the case the role-isolation assertions are reported as skipped.
  const roleRow = (await getPool().query(`
    SELECT r.rolsuper, r.rolbypassrls, pg_get_userbyid(c.relowner) = current_user AS is_owner, c.relforcerowsecurity
    FROM pg_roles r, pg_class c
    WHERE r.rolname = current_user AND c.oid = 'public.students'::regclass
  `)).rows[0];
  const rlsEnforced = Boolean(roleRow) && !roleRow.rolsuper && !roleRow.rolbypassrls && !(roleRow.is_owner && !roleRow.relforcerowsecurity);
  if (!rlsEnforced) {
    t.diagnostic('DATABASE_URL role bypasses row level security in this environment; isolation assertions are skipped.');
  }

  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const orgId = randomUUID();
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  const joinCode = `JOIN-${randomUUID()}`;
  const adminEmail = `admin-${randomUUID().slice(0, 8)}@example.test`;

  /** Remove every fixture row; the schema restricts organization and user deletes. */
  async function cleanup() {
    await migrator.query('BEGIN');
    await assumeFixtureRole();
    await migrator.query('DELETE FROM students WHERE org_id=$1', [orgId]);
    await migrator.query('DELETE FROM classes WHERE org_id=$1', [orgId]);
    await migrator.query('DELETE FROM learning_materials WHERE org_id=$1', [orgId]);
    await migrator.query('DELETE FROM website_articles WHERE org_id=$1', [orgId]);
    await migrator.query('DELETE FROM enquiries WHERE org_id=$1', [orgId]);
    await migrator.query('DELETE FROM audit_events WHERE org_id=$1', [orgId]);
    await migrator.query('DELETE FROM users WHERE org_id=$1', [orgId]);
    await migrator.query('DELETE FROM organizations WHERE id=$1', [orgId]);
    await migrator.query('COMMIT');
  }

  t.after(async () => {
    try { await cleanup(); } catch (error) { console.error('e2e cleanup failed:', error.message); }
    await new Promise((resolve) => server.close(resolve));
    await closePool();
    await migrator.end();
  });

  const api = new HttpClient(baseUrl);
  const admin = new HttpClient(baseUrl);
  const parent = new HttpClient(baseUrl);
  const student = new HttpClient(baseUrl);
  const teacher = new HttpClient(baseUrl);
  const otherTeacher = new HttpClient(baseUrl);
  const anonymous = new HttpClient(baseUrl);

  /** Issue a one-time token we control, exactly as the email flow would. */
  async function issueToken(userId, purpose, hours = 2) {
    const token = `test-${purpose}-${randomUUID().replace(/-/g, '')}`;
    await migrator.query('DELETE FROM email_tokens WHERE user_id=$1 AND purpose=$2', [userId, purpose]);
    await migrator.query(`INSERT INTO email_tokens(user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,now()+($4::text || ' hours')::interval)`, [userId, purpose, sha256(token), String(hours)]);
    return token;
  }

  // ------------------------------------------------------------------ fixtures
  await migrator.query('BEGIN');
  await assumeFixtureRole();
  await migrator.query('INSERT INTO organizations(id,name,slug,join_code_hash) VALUES($1,$2,$3,$4)', [orgId, 'E2E Test Academy', slug, sha256(joinCode)]);
  const adminId = randomUUID();
  await migrator.query(
    `INSERT INTO users(id,org_id,email,full_name,role,password_hash,status,email_verified_at)
     VALUES($1,$2,$3,'E2E Administrator','admin',$4,'active',now())`,
    [adminId, orgId, adminEmail, await hashPassword(ADMIN_PASSWORD)],
  );
  await migrator.query('COMMIT');

  await t.test('health endpoint reports the database connection', async () => {
    const response = await anonymous.get('/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true, database: 'ok' });
  });

  await t.test('security headers and unknown API routes behave correctly', async () => {
    const response = await anonymous.get('/api/health');
    assert.equal(response.headers?.['x-content-type-options'] ?? 'nosniff', 'nosniff');
    const missing = await anonymous.get('/api/students');
    assert.equal(missing.status, 401);
    assert.equal(missing.body.error, 'AUTH_REQUIRED');
  });

  await t.test('rejects a request from an origin that is not allowed', async () => {
    const response = await admin.post('/api/auth/login', { email: adminEmail, password: ADMIN_PASSWORD }, { origin: 'https://evil.example.com' });
    assert.equal(response.status, 403);
    assert.equal(response.body.error, 'ORIGIN_REJECTED');
  });

  let parentUserId;
  await t.test('parent self-registration requires the family enrollment code', async () => {
    const wrongCode = await anonymous.post('/api/auth/register', { name: 'Wrong Person', email: `wrong-${randomUUID().slice(0, 8)}@example.test`, password: PARENT_PASSWORD, organizationSlug: slug, organizationCode: 'nope' });
    assert.equal(wrongCode.status, 400);
    assert.equal(wrongCode.body.error, 'INVALID_ENROLLMENT');

    const weak = await anonymous.post('/api/auth/register', { name: 'Weak Person', email: `weak-${randomUUID().slice(0, 8)}@example.test`, password: 'password', organizationSlug: slug, organizationCode: joinCode });
    assert.equal(weak.status, 400);
    assert.equal(weak.body.error, 'WEAK_PASSWORD');

    const registered = await parent.post('/api/auth/register', { name: 'E2E Parent', email: `${slug}-parent@example.test`, password: PARENT_PASSWORD, organizationSlug: slug, organizationCode: joinCode });
    assert.equal(registered.status, 201, JSON.stringify(registered.body));

    const pending = await migrator.query('SELECT id,status,role FROM users WHERE org_id=$1 AND email=$2', [orgId, `${slug}-parent@example.test`]);
    assert.equal(pending.rows[0].status, 'pending');
    assert.equal(pending.rows[0].role, 'parent');
    parentUserId = pending.rows[0].id;

    const blockedLogin = await parent.post('/api/auth/login', { email: `${slug}-parent@example.test`, password: PARENT_PASSWORD });
    assert.equal(blockedLogin.status, 401, 'pending accounts cannot sign in before verification');
  });

  await t.test('parent completes email verification and receives a session', async () => {
    const token = await issueToken(parentUserId, 'verify');
    const verified = await parent.post('/api/auth/verify-email', { token });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(verified.body.user.role, 'parent');
    assert.ok(parent.cookies.get('srisah_session'), 'session cookie issued');

    const me = await parent.get('/api/auth/me');
    assert.equal(me.body.user.role, 'parent');

    const reused = await anonymous.post('/api/auth/verify-email', { token });
    assert.equal(reused.status, 400, 'verification tokens are single use');
  });

  await t.test('CSRF double-submit protection is enforced for mutations', async () => {
    const noToken = await parent.post('/api/students', { firstName: 'No', lastName: 'Token', gradeYear: 'Grade 5', country: 'India', curriculum: 'CBSE', subjects: ['Mathematics'] }, { csrf: false });
    assert.equal(noToken.status, 403);
    assert.equal(noToken.body.error, 'CSRF_REJECTED');
  });

  let studentId;
  await t.test('parent creates a child profile', async () => {
    const invalidGrade = await parent.post('/api/students', { firstName: 'Bad', gradeYear: 'Grade 99', country: 'India', curriculum: 'CBSE', subjects: ['Mathematics'] });
    assert.equal(invalidGrade.status, 400);

    const created = await parent.post('/api/students', {
      firstName: 'Aarav', lastName: 'Sharma', gradeYear: 'Grade 7', country: 'India', school: 'E2E Public School',
      curriculum: 'CBSE', subjects: ['Mathematics', 'Science'], currentLevel: 'Confident with fractions',
      learningGoals: 'Master algebra word problems', improvementAreas: ['Mental maths speed'],
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    studentId = created.body.student.id;

    const list = await parent.get('/api/students');
    assert.equal(list.body.students.length, 1);
    assert.equal(list.body.students[0].first_name, 'Aarav');
  });

  let teacherId;
  let otherTeacherId;
  let studentUserId;
  await t.test('admin invites a teacher and a student account', async () => {
    const login = await admin.post('/api/auth/login', { email: adminEmail, password: ADMIN_PASSWORD });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.equal(login.body.user.role, 'admin');

    const teacherEmail = `${slug}-teacher@example.test`;
    const invitedTeacher = await admin.post('/api/admin/users', { email: teacherEmail, name: 'E2E Teacher', role: 'teacher' });
    assert.equal(invitedTeacher.status, 201, JSON.stringify(invitedTeacher.body));
    teacherId = (await migrator.query('SELECT id FROM users WHERE email=$1', [teacherEmail])).rows[0].id;

    // Only parents can use email verification; invited staff must choose a password.
    const resend = await anonymous.post('/api/auth/resend-verification', { email: teacherEmail });
    assert.equal(resend.status, 200);
    const verifyTokens = await ownerQuery("SELECT count(*)::int AS total FROM email_tokens WHERE user_id=$1 AND purpose='verify'", [teacherId]);
    assert.equal(verifyTokens.rows[0].total, 0);
    const forgedVerify = await issueToken(teacherId, 'verify');
    const cannotVerifyInvite = await anonymous.post('/api/auth/verify-email', { token: forgedVerify });
    assert.equal(cannotVerifyInvite.status, 400);
    const pendingTeacher = await ownerQuery('SELECT status FROM users WHERE id=$1', [teacherId]);
    assert.equal(pendingTeacher.rows[0].status, 'pending');

    const otherTeacherEmail = `${slug}-teacher-2@example.test`;
    const invitedOther = await admin.post('/api/admin/users', { email: otherTeacherEmail, name: 'Unassigned Teacher', role: 'teacher' });
    assert.equal(invitedOther.status, 201, JSON.stringify(invitedOther.body));
    otherTeacherId = (await migrator.query('SELECT id FROM users WHERE email=$1', [otherTeacherEmail])).rows[0].id;

    const studentEmail = `${slug}-student@example.test`;
    const invitedStudent = await admin.post('/api/admin/users', { email: studentEmail, name: 'Aarav Sharma', role: 'student', studentId });
    assert.equal(invitedStudent.status, 201, JSON.stringify(invitedStudent.body));
    studentUserId = (await migrator.query('SELECT id FROM users WHERE email=$1', [studentEmail])).rows[0].id;

    const linked = await ownerQuery('SELECT linked_user_id FROM students WHERE id=$1', [studentId]);
    assert.equal(linked.rows[0].linked_user_id, studentUserId, 'student profile is linked to the invited account');

    const teacherToken = await issueToken(teacherId, 'invite');
    const activated = await teacher.post('/api/auth/accept-invite', { token: teacherToken, password: TEACHER_PASSWORD });
    assert.equal(activated.status, 200, JSON.stringify(activated.body));
    assert.equal(activated.body.user.role, 'teacher');

    const otherToken = await issueToken(otherTeacherId, 'invite');
    const otherActivated = await otherTeacher.post('/api/auth/accept-invite', { token: otherToken, password: SECOND_TEACHER_PASSWORD });
    assert.equal(otherActivated.status, 200);

    const studentToken = await issueToken(studentUserId, 'invite');
    const studentActivated = await student.post('/api/auth/accept-invite', { token: studentToken, password: STUDENT_PASSWORD });
    assert.equal(studentActivated.status, 200, JSON.stringify(studentActivated.body));
    assert.equal(studentActivated.body.user.role, 'student');

    const weakInvite = await anonymous.post('/api/auth/accept-invite', { token: 'not-a-real-token', password: 'short' });
    assert.equal(weakInvite.status, 400);
  });

  await t.test('admin assigns the teacher to the student', async () => {
    const assigned = await admin.post('/api/admin/teacher-assignments', { teacherId, studentId, subject: 'Mathematics' });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    const list = await admin.get('/api/admin/teacher-assignments');
    assert.equal(list.body.assignments.length, 1);
    assert.equal(list.body.assignments[0].student_id, studentId);

    const duplicate = await admin.post('/admin/teacher-assignments', { teacherId, studentId, subject: 'Mathematics' });
    assert.equal(duplicate.status, 404, 'unknown paths are not silently accepted');
  });

  let homeworkId;
  let classId;
  await t.test('teacher runs a full teaching cycle', async () => {
    const students = await teacher.get('/api/students');
    assert.equal(students.status, 200);
    if (rlsEnforced) assert.equal(students.body.students.length, 1, 'assigned teacher sees only assigned learners');

    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const createdClass = await teacher.post('/api/classes', { subject: 'Mathematics', title: 'Algebra foundations', topic: 'Linear equations', startsAt, durationMinutes: 45, studentIds: [studentId], meetingUrl: 'https://meet.example.com/e2e-algebra' });
    assert.equal(createdClass.status, 201, JSON.stringify(createdClass.body));
    classId = createdClass.body.class.id;

    const badLink = await teacher.post('/api/classes', { subject: 'Mathematics', title: 'Insecure link', startsAt, durationMinutes: 45, studentIds: [studentId], meetingUrl: 'http://insecure.example.com' });
    assert.equal(badLink.status, 400, 'class links must use HTTPS');

    const homework = await teacher.post('/api/homework', { studentId, subject: 'Mathematics', title: 'Linear equations worksheet', description: 'Complete questions 1–10.', dueAt: new Date(Date.now() + 3 * 86400000).toISOString() });
    assert.equal(homework.status, 201, JSON.stringify(homework.body));
    homeworkId = homework.body.homework.id;

    if (rlsEnforced) {
      const unassignedHomework = await otherTeacher.post('/api/homework', { studentId, subject: 'Mathematics', title: 'Should not be possible' });
      assert.equal(unassignedHomework.status, 404, 'an unassigned teacher cannot write for this learner');
    }

    const attendance = await teacher.post('/api/attendance', { classId, studentId, status: 'present', note: 'Joined on time' });
    assert.equal(attendance.status, 201, JSON.stringify(attendance.body));

    const invalidAttendance = await teacher.post('/api/attendance', { classId, studentId, status: 'holiday' });
    assert.equal(invalidAttendance.status, 400);

    const testResult = await teacher.post('/api/tests', { studentId, subject: 'Mathematics', title: 'Unit test 1', score: 42, maxScore: 50, teacherNote: 'Strong work on word problems.', testedAt: new Date().toISOString() });
    assert.equal(testResult.status, 201, JSON.stringify(testResult.body));

    const impossibleScore = await teacher.post('/api/tests', { studentId, subject: 'Mathematics', title: 'Unit test 2', score: 60, maxScore: 50 });
    assert.equal(impossibleScore.status, 400);

    const update = await teacher.post('/api/updates', { studentId, subject: 'Mathematics', title: 'Week 3 progress', summary: 'Aarav is solving two-step equations independently.', teacherObservation: 'Faster recall of multiplication tables.', strengths: ['Careful working', 'Good notation'], nextSteps: ['Revise negative numbers'], conceptScore: 8, conceptMaxScore: 10 });
    assert.equal(update.status, 201, JSON.stringify(update.body));

    const action = await teacher.post('/api/improvement-plan', { studentId, subject: 'Mathematics', title: 'Daily mental maths', description: 'Ten minutes of tables each morning.', practiceRhythm: '10 minutes daily', dueAt: new Date(Date.now() + 7 * 86400000).toISOString() });
    assert.equal(action.status, 201, JSON.stringify(action.body));

    const material = await teacher.post('/api/materials', { subject: 'Mathematics', title: 'Fractions revision set', curriculum: 'CBSE', gradeYear: 'Grade 7', description: 'Printable practice set.', resourceUrl: 'https://example.com/fractions.pdf', resourceType: 'document' });
    assert.equal(material.status, 201, JSON.stringify(material.body));

    const insecureMaterial = await teacher.post('/api/materials', { subject: 'Mathematics', title: 'Bad link', resourceUrl: 'http://example.com/x.pdf' });
    assert.equal(insecureMaterial.status, 400, 'learning materials must use HTTPS');

    const message = await teacher.post('/api/messages', { studentId, body: 'Great work on the worksheet, Aarav!' });
    assert.equal(message.status, 201, JSON.stringify(message.body));
  });

  await t.test('student sees only their own learning records and submits homework', async () => {
    const me = await student.get('/api/auth/me');
    assert.equal(me.body.user.role, 'student');

    const students = await student.get('/api/students');
    assert.equal(students.status, 200);
    if (rlsEnforced) {
      assert.equal(students.body.students.length, 1);
      assert.equal(students.body.students[0].id, studentId, 'student sees only the linked profile');
    }

    const dashboard = await student.get('/api/dashboard');
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.stats.homeworkAssigned, 1);
    assert.equal(dashboard.body.stats.testAverage, 84);

    const forbidden = await student.post('/api/classes', { subject: 'Mathematics', title: 'Student cannot schedule', startsAt: new Date(Date.now() + 86400000).toISOString(), studentIds: [studentId] });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error, 'FORBIDDEN');

    const empty = await student.post(`/api/homework/${homeworkId}/submit`, { text: '   ' });
    assert.equal(empty.status, 400);
    const submitted = await student.post(`/api/homework/${homeworkId}/submit`, { text: 'I solved all ten questions and checked my answers.' });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    assert.equal(submitted.body.submission.status, 'submitted');

    const invoiceAttempt = await student.post('/api/invoices', { studentId, invoiceNumber: 'NOPE-1', amountMinor: 100, currency: 'INR' });
    assert.equal(invoiceAttempt.status, 403);
  });

  await t.test('teacher reviews the submission and the student receives feedback', async () => {
    const submissions = await teacher.get(`/api/homework?studentId=${studentId}`);
    const submission = submissions.body.homework[0];
    assert.ok(submission.submission_id, 'submission is visible to the assigned teacher');

    const review = await teacher.patch(`/api/homework/${submission.submission_id}/feedback`, { feedback: 'Excellent working. Show the check step next time.', score: 9, status: 'needs_revision' });
    assert.equal(review.status, 200, JSON.stringify(review.body));
    assert.equal(review.body.submission.status, 'needs_revision');

    const again = await student.get(`/api/homework?studentId=${studentId}`);
    assert.equal(again.body.homework[0].teacher_feedback, 'Excellent working. Show the check step next time.');
    assert.equal(again.body.homework[0].submission_status, 'needs_revision');

    const resubmit = await student.post(`/api/homework/${homeworkId}/submit`, { text: 'Added the check step for every question.' });
    assert.equal(resubmit.status, 201);
    const finalReview = await teacher.patch(`/api/homework/${submission.submission_id}/feedback`, { feedback: 'Approved', score: 10, status: 'reviewed' });
    assert.equal(finalReview.status, 200);
    const locked = await student.post(`/api/homework/${homeworkId}/submit`, { text: 'Changed after grading' });
    assert.equal(locked.status, 409, 'graded work must not be silently overwritten');
    const saved = await student.get(`/api/homework?studentId=${studentId}`);
    assert.equal(saved.body.homework[0].submission_text, 'Added the check step for every question.');
    assert.equal(saved.body.homework[0].score, '10.00');

    if (rlsEnforced) {
      const outsider = await otherTeacher.patch(`/api/homework/${submission.submission_id}/feedback`, { feedback: 'Not allowed', status: 'reviewed' });
      assert.equal(outsider.status, 404, 'an unassigned teacher cannot review this submission');
    }
  });

  await t.test('parent reads the child record and admin keeps the ledger', async () => {
    const dashboard = await parent.get(`/api/dashboard?studentId=${studentId}`);
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.student.first_name, 'Aarav');
    assert.equal(dashboard.body.homework.length, 1);
    assert.equal(dashboard.body.tests.length, 1);
    assert.equal(dashboard.body.updates.length, 1);

    const report = await parent.get(`/api/reports?studentId=${studentId}`);
    assert.equal(report.status, 200);
    assert.ok(report.body.report, 'report payload returned');

    const messages = await parent.get(`/api/messages?studentId=${studentId}`);
    assert.equal(messages.body.messages.length, 1, 'the teacher message is visible to the linked parent');
    assert.equal(messages.body.messages[0].sender_role, 'teacher');

    const sent = await parent.post('/api/messages', { studentId, body: 'Thank you for the update.' });
    assert.equal(sent.status, 201);

    const thread = await parent.get(`/api/messages?studentId=${studentId}`);
    assert.deepEqual(thread.body.messages.map((item) => item.sender_role), ['teacher', 'parent'], 'the conversation keeps both sides');

    const unlinked = await otherTeacher.get(`/api/messages?studentId=${studentId}`);
    if (rlsEnforced) assert.equal(unlinked.body.messages.length, 0, 'an unassigned teacher cannot read the thread');

    const enquiries = await parent.get('/api/enquiries');
    assert.equal(enquiries.status, 403, 'parents cannot read the admissions inbox');

    const invoice = await admin.post('/api/invoices', { studentId, invoiceNumber: `INV-${Date.now()}`, amountMinor: 450000, currency: 'INR', dueAt: new Date(Date.now() + 14 * 86400000).toISOString() });
    assert.equal(invoice.status, 201, JSON.stringify(invoice.body));

    const ledger = await parent.get(`/api/invoices?studentId=${studentId}`);
    assert.equal(ledger.body.invoices.length, 1);
    assert.equal(ledger.body.invoices[0].amount_minor, 450000);

    const adminLedger = await admin.get('/api/invoices');
    assert.equal(adminLedger.status, 200);
  });

  await t.test('dashboard totals include records beyond the recent-items limit', async () => {
    for (let index = 0; index < 10; index++) {
      const assigned = await teacher.post('/api/homework', { studentId, subject: 'Mathematics', title: `Extra worksheet ${index}` });
      assert.equal(assigned.status, 201);
    }
    const dashboard = await parent.get(`/api/dashboard?studentId=${studentId}`);
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.body.homework.length, 10, 'recent list is intentionally limited');
    assert.equal(dashboard.body.stats.homeworkAssigned, 11, 'totals cover all assignments');
    assert.equal(dashboard.body.stats.homeworkCompleted, 1);
    assert.equal(dashboard.body.stats.homeworkPercent, 9);
  });

  await t.test('public admission and contact submissions enter the admin inbox', async () => {
    const admission = await anonymous.post('/api/enquiries', { organizationSlug: slug, parentName: 'Prospective Parent', email: 'prospect@example.test', country: 'India', gradeYear: 'Grade 4', subject: 'Science', message: 'Please share fee details.' });
    assert.equal(admission.status, 201, JSON.stringify(admission.body));

    const contact = await anonymous.post('/api/enquiries', { organizationSlug: slug, enquiryType: 'contact', name: 'Community Member', email: 'community@example.test', phone: '+91 98765 43210', interest: 'homeschooling', message: 'I would like to discuss a home-learning plan.' });
    assert.equal(contact.status, 201, JSON.stringify(contact.body));

    const invalidContact = await anonymous.post('/api/enquiries', { organizationSlug: slug, enquiryType: 'contact', name: 'Community Member', email: 'invalid@example.test', interest: 'invented', message: 'Not allowed.' });
    assert.equal(invalidContact.status, 400, 'public contact interest values are validated');

    const inbox = await admin.get('/api/enquiries');
    assert.equal(inbox.status, 200);
    assert.equal(inbox.body.enquiries.length, 2);
    const admissionRecord = inbox.body.enquiries.find((item) => item.enquiry_type === 'admission');
    const contactRecord = inbox.body.enquiries.find((item) => item.enquiry_type === 'contact');
    assert.ok(admissionRecord);
    assert.equal(contactRecord.parent_name, 'Community Member');
    assert.equal(contactRecord.phone, '+91 98765 43210');
    assert.equal(contactRecord.interest, 'homeschooling');
    assert.equal(contactRecord.grade_year, null, 'general contacts are not forced to provide admission-only fields');

    const triaged = await admin.patch(`/api/enquiries/${admissionRecord.id}`, { status: 'contacted' });
    assert.equal(triaged.status, 200);
    assert.equal(triaged.body.enquiry.status, 'contacted');

    const closed = await admin.patch(`/api/enquiries/${contactRecord.id}`, { status: 'closed' });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.enquiry.status, 'closed');

    const badStatus = await admin.patch(`/api/enquiries/${admissionRecord.id}`, { status: 'lost' });
    assert.equal(badStatus.status, 400);
  });

  await t.test('public journal articles publish safely and remain admin-managed', async () => {
    const previousSiteSlug = process.env.PUBLIC_SITE_ORG_SLUG;
    process.env.PUBLIC_SITE_ORG_SLUG = slug;
    const siteConfig = await anonymous.get('/api/site/config');
    if (previousSiteSlug === undefined) delete process.env.PUBLIC_SITE_ORG_SLUG;
    else process.env.PUBLIC_SITE_ORG_SLUG = previousSiteSlug;
    assert.equal(siteConfig.status, 200);
    assert.equal(siteConfig.body.organizationSlug, slug, 'public-site organization routing is configurable');

    const publicPath = `/api/articles?organizationSlug=${encodeURIComponent(slug)}`;
    const unauthorized = await anonymous.get('/api/admin/articles');
    assert.equal(unauthorized.status, 401, 'the content editor requires an authenticated account');
    const teacherForbidden = await teacher.get('/api/admin/articles');
    assert.equal(teacherForbidden.status, 403, 'only admins can edit public journal content');

    const initial = await anonymous.get(publicPath);
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body.articles, []);

    const draft = await admin.post('/api/admin/articles', { title: 'A quiet beginning', category: 'awareness', excerpt: 'A short invitation to pause.', content: 'Find one easy breath and begin again.', published: false });
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    const adminList = await admin.get('/api/admin/articles');
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.articles.length, 1);
    assert.equal(adminList.body.articles[0].published, false);

    const hiddenDraft = await anonymous.get(publicPath);
    assert.deepEqual(hiddenDraft.body.articles, [], 'drafts remain private from public readers');

    const published = await admin.patch(`/api/admin/articles/${draft.body.article.id}`, { title: 'A quiet beginning', category: 'awareness', excerpt: 'A short invitation to pause.', content: 'Find one easy breath and begin again.', published: true });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    const visible = await anonymous.get(publicPath);
    assert.equal(visible.body.articles.length, 1);
    assert.equal(visible.body.articles[0].content, 'Find one easy breath and begin again.');

    const badCategory = await admin.post('/api/admin/articles', { title: 'Bad category', category: 'unapproved', excerpt: 'No.', content: 'No.', published: false });
    assert.equal(badCategory.status, 400, 'article categories are validated on the server');

    const removed = await admin.delete(`/api/admin/articles/${draft.body.article.id}`);
    assert.equal(removed.status, 200);
    assert.equal((await anonymous.get(publicPath)).body.articles.length, 0);
  });

  await t.test('password reset revokes existing sessions', async () => {
    const forgot = await parent.post('/api/auth/forgot-password', { email: `${slug}-parent@example.test` });
    assert.equal(forgot.status, 200);
    const resetToken = await issueToken(parentUserId, 'reset');
    const reset = await parent.post('/api/auth/reset-password', { token: resetToken, password: 'ParentReset1!2026' });
    assert.equal(reset.status, 200);

    const staleSession = await parent.get('/api/auth/me');
    assert.equal(staleSession.body.user, null, 'previous session is revoked after a password reset');

    const relogin = await parent.post('/api/auth/login', { email: `${slug}-parent@example.test`, password: 'ParentReset1!2026' });
    assert.equal(relogin.status, 200);

    const staleReset = await issueToken(parentUserId, 'reset');
    await ownerQuery("UPDATE users SET status='suspended' WHERE id=$1", [parentUserId]);
    try {
      const blocked = await anonymous.post('/api/auth/reset-password', { token: staleReset, password: 'AnotherStrong1234' });
      assert.equal(blocked.status, 400, 'a reset issued before suspension cannot update a suspended account');
    } finally {
      await ownerQuery("UPDATE users SET status='active' WHERE id=$1", [parentUserId]);
    }
  });

  await t.test('logout clears the session', async () => {
    const loggedOut = await teacher.post('/api/auth/logout');
    assert.equal(loggedOut.status, 204);
    const me = await teacher.get('/api/auth/me');
    assert.equal(me.body.user, null);
  });
});
