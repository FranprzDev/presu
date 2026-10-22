import { readFile } from 'node:fs/promises';
import { db } from './db.js';

const migration = await readFile(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const client = await db.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS presu_migration (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  await client.query("SELECT pg_advisory_lock(hashtextextended('presu-migrations', 0))");
  const applied = await client.query('SELECT 1 FROM presu_migration WHERE name = $1', ['0001_init']);
  if (!applied.rowCount) {
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('INSERT INTO presu_migration (name) VALUES ($1)', ['0001_init']);
    await client.query('COMMIT');
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtextextended('presu-migrations', 0))");
  client.release();
  await db.end();
}
