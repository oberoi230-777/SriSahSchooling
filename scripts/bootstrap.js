import pg from 'pg';
import { loadEnv } from '../server/env.js';

loadEnv();
const required = ['MIGRATION_DATABASE_URL','BOOTSTRAP_ORG_NAME','BOOTSTRAP_ORG_SLUG','BOOTSTRAP_JOIN_CODE','BOOTSTRAP_ADMIN_EMAIL','BOOTSTRAP_ADMIN_NAME','BOOTSTRAP_ADMIN_PASSWORD'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing required bootstrap settings: ${missing.join(', ')}`);
const { Client } = pg;
const { hashPassword, validatePassword, normalizeEmail, sha256 } = await import('../server/security.js');
const passwordError = validatePassword(process.env.BOOTSTRAP_ADMIN_PASSWORD);
if (passwordError) throw new Error(`Bootstrap admin password: ${passwordError}`);
const client = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL, ssl: process.env.MIGRATION_DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
await client.connect();
try {
  await client.query('BEGIN');
  const orgResult = await client.query(
    `INSERT INTO organizations(name,slug,join_code_hash) VALUES($1,$2,$3)
     ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name, join_code_hash=EXCLUDED.join_code_hash, active=true
     RETURNING id`,
    [process.env.BOOTSTRAP_ORG_NAME.trim(), process.env.BOOTSTRAP_ORG_SLUG.trim().toLowerCase(), sha256(process.env.BOOTSTRAP_JOIN_CODE)],
  );
  const orgId = orgResult.rows[0].id;
  const email = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const existing = await client.query('SELECT id,org_id,role FROM users WHERE email=$1', [email]);
  if (existing.rowCount) {
    if (existing.rows[0].org_id !== orgId || existing.rows[0].role !== 'admin') throw new Error('That bootstrap email already belongs to a different account.');
    await client.query('COMMIT');
    console.log(`Bootstrap is already complete for ${email}.`);
  } else {
    const passwordHash = await hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD);
    await client.query(
      `INSERT INTO users(org_id,email,full_name,role,password_hash,email_verified_at)
       VALUES($1,$2,$3,'admin',$4,now())`,
      [orgId, email, process.env.BOOTSTRAP_ADMIN_NAME.trim(), passwordHash],
    );
    await client.query('COMMIT');
    console.log(`Created organization ${process.env.BOOTSTRAP_ORG_SLUG} and verified admin ${email}.`);
  }
  console.log('Store the organization join code securely and remove bootstrap secrets from the runtime environment.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
