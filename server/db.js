import pg from 'pg';

const { Pool } = pg;

// PostgreSQL int8/bigint columns (invoice amounts in minor units, counts) are returned as
// strings by the driver by default, which then serialises into the API as JSON strings and
// forces clients to coerce every value. Every bigint in this schema is a count or a money
// amount in minor units, which stays far below Number.MAX_SAFE_INTEGER, so parse it once here
// and keep the JSON contract numeric.
pg.types.setTypeParser(20, (value) => (value === null ? null : Number(value)));

let pool;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_SIZE || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    });
    pool.on('error', (error) => console.error('Unexpected database pool error:', error.message));
  }
  return pool;
}

export async function withSystemTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const value = await callback(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function withUserTransaction(principal, callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.user_id',$1,true), set_config('app.org_id',$2,true), set_config('app.role',$3,true)",
      [principal.id, principal.orgId, principal.role],
    );
    const value = await callback(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function withPublicOrganizationTransaction(orgId, callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.org_id',$1,true), set_config('app.role','public',true)", [orgId]);
    const value = await callback(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) { await pool.end(); pool = undefined; }
}
