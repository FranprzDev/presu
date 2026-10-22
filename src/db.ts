import { Pool, type PoolClient } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

export const db = new Pool({ connectionString: databaseUrl, max: 10 });

export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureAccount(userId: string) {
  await transaction(async (client) => {
    await client.query('INSERT INTO presu_account (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    await client.query(
      `INSERT INTO presu_credit_ledger (id, user_id, kind, amount, idempotency_key)
       VALUES (gen_random_uuid(), $1, 'free_grant', 5, $2) ON CONFLICT (idempotency_key) DO NOTHING`,
      [userId, `free-grant:${userId}`],
    );
  });
}

export async function ownedProject(userId: string, projectId: string) {
  const result = await db.query(
    'SELECT * FROM presu_project WHERE id = $1 AND user_id = $2',
    [projectId, userId],
  );
  if (!result.rowCount) throw new Error('PROJECT_NOT_FOUND');
  return result.rows[0] as {
    id: string;
    user_id: string;
    name: string;
    status: string;
    created_at: Date;
    updated_at: Date;
  };
}
