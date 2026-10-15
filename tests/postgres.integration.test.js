import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { withUserTransaction, closePool } from '../server/db.js';

const enabled = Boolean(process.env.DATABASE_URL && process.env.MIGRATION_DATABASE_URL);

async function visibleIds(principal, table) {
  const result = await withUserTransaction(principal, (client) => client.query(`SELECT id FROM ${table} ORDER BY id`));
  return result.rows.map((row) => row.id);
}

test('PostgreSQL RLS isolates parent, student and teacher records', { skip: !enabled }, async (t) => {
  const { Client } = pg;
  const migrator = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL, ssl: process.env.MIGRATION_DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
  await migrator.connect();
  // Optional: assume a schema-owner role for the fixture transaction only. Set
  // MIGRATION_SET_ROLE when the migration connection cannot bypass row level security
  // itself (for example a single-session test database). The role is transaction scoped
  // so it can never leak into the application connection.
  const fixtureRole = String(process.env.MIGRATION_SET_ROLE || '').trim();
  if (fixtureRole && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(fixtureRole)) throw new Error('MIGRATION_SET_ROLE must be a plain PostgreSQL role name.');
  const assumeFixtureRole = async () => { if (fixtureRole) await migrator.query(`SET LOCAL ROLE ${fixtureRole}`); };
  const poolRole = await (await import('../server/db.js')).getPool().query(`
    SELECT r.rolsuper,r.rolbypassrls,
      (SELECT pg_get_userbyid(c.relowner) FROM pg_class c WHERE c.oid='public.students'::regclass) AS students_owner
    FROM pg_roles r WHERE r.rolname=current_user
  `);
  const role = poolRole.rows[0];
  if (!role || role.rolsuper || role.rolbypassrls || role.students_owner === (await (await import('../server/db.js')).getPool().query('SELECT current_user')).rows[0].current_user) {
    t.skip('DATABASE_URL must use a non-owner, non-superuser app role with RLS enabled.');
    await migrator.end();
    await closePool();
    return;
  }

  const orgId = randomUUID();
  const adminId = randomUUID();
  const parentA = randomUUID();
  const parentB = randomUUID();
  const studentUserA = randomUUID();
  const studentUserB = randomUUID();
  const teacherA = randomUUID();
  const teacherB = randomUUID();
  const studentA = randomUUID();
  const studentB = randomUUID();
  const homeworkA = randomUUID();
  const homeworkB = randomUUID();
  const token = randomUUID();
  const slug = `rls-test-${token.slice(0, 8)}`;
  const user = (id, email, fullName, userRole) => [id, orgId, email, fullName, userRole, 'test-hash'];
  const parentPrincipal = { id: parentA, orgId, role: 'parent' };
  const studentPrincipal = { id: studentUserA, orgId, role: 'student' };
  const teacherPrincipal = { id: teacherA, orgId, role: 'teacher' };
  const adminPrincipal = { id: adminId, orgId, role: 'admin' };

  try {
    await migrator.query('BEGIN');
    await assumeFixtureRole();
    await migrator.query('INSERT INTO organizations(id,name,slug,join_code_hash) VALUES($1,$2,$3,$4)', [orgId, 'RLS integration fixture', slug, 'test']);
    for (const account of [
      user(adminId, `${token}@admin.example.test`, 'Fixture Admin', 'admin'),
      user(parentA, `${token}+parent-a@example.test`, 'Parent A', 'parent'),
      user(parentB, `${token}+parent-b@example.test`, 'Parent B', 'parent'),
      user(studentUserA, `${token}+student-a@example.test`, 'Student A', 'student'),
      user(studentUserB, `${token}+student-b@example.test`, 'Student B', 'student'),
      user(teacherA, `${token}+teacher-a@example.test`, 'Teacher A', 'teacher'),
      user(teacherB, `${token}+teacher-b@example.test`, 'Teacher B', 'teacher'),
    ]) {
      await migrator.query('INSERT INTO users(id,org_id,email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,now())', account);
    }
    const addStudent = (id, linkedUserId, creator, firstName) => migrator.query(`INSERT INTO students(id,org_id,linked_user_id,created_by,first_name,last_name,grade_year,country,curriculum,subjects)
      VALUES($1,$2,$3,$4,$5,'Fixture','Grade 5','IN','CBSE',ARRAY['Mathematics'])`, [id, orgId, linkedUserId, creator, firstName]);
    await addStudent(studentA, studentUserA, adminId, 'Asha');
    await addStudent(studentB, studentUserB, adminId, 'Bala');
    await migrator.query('INSERT INTO student_guardians(org_id,student_id,guardian_user_id,relationship,is_primary) VALUES($1,$2,$3,$4,true),($1,$5,$6,$7,true)', [orgId, studentA, parentA, 'Parent', studentB, parentB, 'Parent']);
    await migrator.query('INSERT INTO teacher_assignments(org_id,teacher_user_id,student_id,subject) VALUES($1,$2,$3,$4),($1,$5,$6,$4)', [orgId, teacherA, studentA, 'Mathematics', teacherB, studentB]);
    await migrator.query(`INSERT INTO homework(id,org_id,student_id,assigned_by,subject,title) VALUES($1,$2,$3,$4,'Mathematics','A homework'),($5,$2,$6,$7,'Mathematics','B homework')`, [homeworkA, orgId, studentA, teacherA, homeworkB, studentB, teacherB]);
    await migrator.query('INSERT INTO homework_submissions(org_id,homework_id,student_id,submission_text) VALUES($1,$2,$3,$4),($1,$5,$6,$7)', [orgId, homeworkA, studentA, 'A work', homeworkB, studentB, 'B work']);
    await migrator.query('INSERT INTO invoices(org_id,student_id,invoice_number,amount_minor,currency) VALUES($1,$2,$3,10000,\'INR\'),($1,$4,$5,20000,\'INR\')', [orgId, studentA, `${slug}-A`, studentB, `${slug}-B`]);
    await migrator.query('COMMIT');

    assert.deepEqual(await visibleIds(parentPrincipal, 'students'), [studentA]);
    assert.deepEqual(await visibleIds(studentPrincipal, 'students'), [studentA]);
    assert.deepEqual(await visibleIds(teacherPrincipal, 'students'), [studentA]);
    assert.deepEqual(await visibleIds({ ...parentPrincipal, orgId: randomUUID() }, 'students'), []);
    assert.deepEqual(await visibleIds(adminPrincipal, 'students'), [studentA, studentB].sort());

    const parentHomework = await withUserTransaction(parentPrincipal, (client) => client.query('SELECT student_id FROM homework ORDER BY student_id'));
    assert.deepEqual(parentHomework.rows.map((row) => row.student_id), [studentA]);
    const parentInvoices = await withUserTransaction(parentPrincipal, (client) => client.query('SELECT student_id FROM invoices ORDER BY student_id'));
    assert.deepEqual(parentInvoices.rows.map((row) => row.student_id), [studentA]);
    const studentSubmissions = await withUserTransaction(studentPrincipal, (client) => client.query('SELECT student_id FROM homework_submissions'));
    assert.deepEqual(studentSubmissions.rows.map((row) => row.student_id), [studentA]);

    await assert.rejects(
      withUserTransaction(teacherPrincipal, (client) => client.query(`INSERT INTO homework(id,org_id,student_id,assigned_by,subject,title)
        VALUES($1,$2,$3,$4,'Mathematics','Unauthorized cross-student write')`, [randomUUID(), orgId, studentB, teacherA])),
      (error) => error.code === '42501',
    );
    await assert.rejects(
      withUserTransaction(teacherPrincipal, (client) => client.query(`INSERT INTO learning_updates(org_id,student_id,teacher_user_id,subject,title,summary)
        VALUES($1,$2,$3,'Mathematics','Unauthorized update','Fixture')`, [orgId, studentB, teacherA])),
      (error) => error.code === '42501',
    );
  } catch (error) {
    await migrator.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await migrator.query('BEGIN').catch(() => {});
    await assumeFixtureRole().catch(() => {});
    await migrator.query('DELETE FROM student_guardians WHERE org_id=$1', [orgId]).catch(() => {});
    await migrator.query('DELETE FROM students WHERE org_id=$1', [orgId]).catch(() => {});
    await migrator.query('DELETE FROM learning_materials WHERE org_id=$1', [orgId]).catch(() => {});
    await migrator.query('DELETE FROM users WHERE org_id=$1', [orgId]).catch(() => {});
    await migrator.query('DELETE FROM organizations WHERE id=$1', [orgId]).catch(() => {});
    await migrator.query('COMMIT').catch(() => {});
    await migrator.end();
    await closePool();
  }
});
