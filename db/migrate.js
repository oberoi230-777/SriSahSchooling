import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../server/env.js';

loadEnv();
const { Client } = pg;
const root = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required.');

const client = new Client({ connectionString: url, ssl: process.env.MIGRATION_DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
await client.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await fs.readdir(path.join(root, 'migrations'))).filter((file) => file.endsWith('.sql')).sort();
  for (const name of files) {
    const already = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (already.rowCount) { console.log(`skip ${name}`); continue; }
    const sql = await fs.readFile(path.join(root, 'migrations', name), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      await client.query('COMMIT');
      console.log(`applied ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.end();
}
