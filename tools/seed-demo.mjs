/**
 * Seed a throwaway demonstration dataset into a running SriSah instance.
 *
 * This is a DEVELOPMENT TOOL. It never ships in production and it refuses to run unless you
 * confirm. The application itself starts with an empty database by design; use this only to
 * populate a local or staging school so screens have something to show.
 *
 * Usage:
 *   node tools/seed-demo.mjs --url http://127.0.0.1:3001 \
 *        --email admin@srisah.demo --password 'DemoAdminPassword1' --yes
 *
 * It creates: 1 teacher account, 2 student profiles + 2 student logins, one class, one
 * homework, one test result, one attendance record, one learning update, one practice step,
 * one learning material, one message and one invoice — all inside the administrator's
 * organization. Invitation links are printed instead of emailed (DEV_EMAIL_LOG), so open the
 * printed password-reset links only if you want to sign in as those demo users.
 */
import process from 'node:process';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (token.startsWith('--')) args.set(token.slice(2), process.argv[index + 1]?.startsWith('--') ? 'true' : process.argv[++index]);
}

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data with NODE_ENV=production.');
  process.exit(1);
}
if (!args.has('yes')) {
  console.error('This writes demonstration records. Re-run with --yes to confirm.');
  process.exit(1);
}

const base = String(args.get('url') || process.env.SRISAH_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const email = args.get('email') || process.env.SRISAH_ADMIN_EMAIL;
const password = args.get('password') || process.env.SRISAH_ADMIN_PASSWORD;
if (!email || !password) {
  console.error('Provide --email and --password for an administrator account.');
  process.exit(1);
}

const cookies = new Map();
function cookieHeader() { return [...cookies].map(([name, value]) => `${name}=${value}`).join('; '); }
function store(response) {
  for (const raw of response.headers.getSetCookie?.() || []) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value) cookies.set(name, value); else cookies.delete(name);
  }
}

async function call(method, path, body) {
  const headers = { Accept: 'application/json', Origin: base };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const csrf = cookies.get('srisah_csrf');
  if (csrf && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = csrf;
  const cookie = cookieHeader();
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${base}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  store(response);
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${json?.message || text}`);
  return json;
}

const today = new Date();
const day = (offset) => new Date(today.getTime() + offset * 86_400_000).toISOString();

console.log(`Signing in to ${base} as ${email}…`);
const session = await call('POST', '/auth/login', { email, password });
console.log(`Signed in as ${session.user.name} (${session.user.role}).`);
if (session.user.role !== 'admin') {
  console.error('Use an administrator account: demo data spans students, teachers and invoices.');
  process.exit(1);
}

const existing = await call('GET', '/students');
const students = [];
for (const child of [
  { firstName: 'Aarav', lastName: 'Sharma', gradeYear: 'Grade 7', curriculum: 'CBSE', subjects: ['Mathematics', 'Science'], currentLevel: 'Confident with fractions', learningGoals: 'Master linear equations and write clear working', improvementAreas: ['Mental maths speed', 'Showing every step'] },
  { firstName: 'Diya', lastName: 'Sharma', gradeYear: 'Grade 4', curriculum: 'CBSE', subjects: ['English', 'Mathematics'], currentLevel: 'Reading fluently, multiplication tables up to 12', learningGoals: 'Build comprehension and problem-solving confidence', improvementAreas: ['Long division'] },
]) {
  const found = existing.students.find((item) => item.first_name === child.firstName && item.last_name === child.lastName);
  if (found) { students.push(found); continue; }
  const created = await call('POST', '/students', { ...child, country: 'India', school: 'SriSah Demo Academy' });
  students.push(created.student);
  console.log(`Created student ${child.firstName} ${child.lastName} (${created.student.grade_year}).`);
}
const [aarav, diya] = students;

const teacherEmail = 'teacher.demo@srisah.demo';
let teacherId;
try {
  await call('POST', '/admin/users', { email: teacherEmail, name: 'Meera Iyer', role: 'teacher' });
  console.log(`Invited teacher ${teacherEmail} (watch the API console for the activation link).`);
} catch (error) {
  if (!/already exists/i.test(error.message)) throw error;
  console.log(`Teacher ${teacherEmail} already exists.`);
}
const teachers = await call('GET', '/admin/teachers');
teacherId = teachers.teachers.find((item) => item.email === teacherEmail)?.id;

for (const student of [aarav, diya]) {
  for (const subject of ['Mathematics', 'Science']) {
    await call('POST', '/admin/teacher-assignments', { teacherId, studentId: student.id, subject }).catch(() => {});
  }
}
console.log('Assigned the teacher to both learners for Mathematics and Science.');

await call('POST', '/admin/student-guardians', { studentId: aarav.id, parentEmail: email, relationship: 'Parent', isPrimary: false }).catch(() => {});
if (!existing.students.length) {
  await call('POST', '/classes', {
    subject: 'Mathematics', title: 'Linear equations — session 3', topic: 'Solving two-step equations',
    curriculum: 'CBSE', startsAt: day(1), durationMinutes: 45, studentIds: [aarav.id],
    meetingUrl: 'https://meet.example.com/srisah-algebra',
  });
  console.log('Scheduled a class for tomorrow.');

  await call('POST', '/homework', { studentId: aarav.id, subject: 'Mathematics', title: 'Linear equations worksheet', description: 'Complete questions 1–10. Show every step and check your answer.', dueAt: day(3) });
  await call('POST', '/homework', { studentId: diya.id, subject: 'English', title: 'Reading comprehension — Chapter 4', description: 'Read the chapter and answer the five questions in full sentences.', dueAt: day(4) });
  await call('POST', '/tests', { studentId: aarav.id, subject: 'Mathematics', title: 'Unit test 1 — Fractions', score: 42, maxScore: 50, teacherNote: 'Strong work on word problems; watch the sign errors.', testedAt: day(-4) });
  await call('POST', '/tests', { studentId: diya.id, subject: 'Mathematics', title: 'Tables checkpoint', score: 18, maxScore: 20, teacherNote: 'Excellent recall, keep practising 7s and 8s.', testedAt: day(-2) });
  await call('POST', '/updates', {
    studentId: aarav.id, subject: 'Mathematics', title: 'Week 3 progress',
    summary: 'Aarav is solving two-step equations independently and explaining his method clearly.',
    teacherObservation: 'Multiplication recall is much faster than last month.',
    strengths: ['Careful working', 'Clear notation'], nextSteps: ['Revise negative numbers', 'Check every answer'],
    conceptScore: 8, conceptMaxScore: 10,
  });
  await call('POST', '/improvement-plan', { studentId: aarav.id, subject: 'Mathematics', title: 'Daily mental maths', description: 'Ten minutes of tables and quick arithmetic every morning.', practiceRhythm: '10 minutes daily', dueAt: day(7) });
  await call('POST', '/materials', { subject: 'Mathematics', title: 'Fractions revision set', curriculum: 'CBSE', gradeYear: 'Grade 7', description: 'Printable practice set with answers.', resourceUrl: 'https://example.com/fractions-revision.pdf', resourceType: 'document' });
  await call('POST', '/messages', { studentId: aarav.id, body: 'Aarav handled the harder equations confidently today. Please encourage the daily ten minutes of tables.' });
  await call('POST', '/invoices', { studentId: aarav.id, invoiceNumber: `INV-DEMO-${Date.now().toString().slice(-6)}`, amountMinor: 450000, currency: 'INR', dueAt: day(14).slice(0, 10) });
  console.log('Seeded class, homework, tests, update, practice plan, material, message and invoice.');
} else {
  console.log('Students already existed; skipped the content seed to avoid duplicates.');
}

console.log('\nDemo data ready. Open the portal and sign in as', email);
