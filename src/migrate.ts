import { readFile } from 'node:fs/promises';
import { db } from './db.js';

const migrations = ['0001_init', '0002_paid_consumption'] as const;
const client = await db.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS presu_migration (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  await client.query("SELECT pg_advisory_lock(hashtextextended('presu-migrations', 0))");
  for (const name of migrations) {
    const applied = await client.query('SELECT 1 FROM presu_migration WHERE name = $1', [name]);
    if (applied.rowCount) continue;
    const migration = await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8');
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('INSERT INTO presu_migration (name) VALUES ($1)', [name]);
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
