import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { z } from 'zod';
import { db, ensureAccount } from '../db.ts';

export const schema = { limit: z.number().int().min(1).max(100).default(25) };
export const metadata = { name: 'list_projects', description: 'Lista los proyectos propios guardados en Presu.' };

export default async function listProjects({ limit }: { limit: number }) {
  const { userId } = await getBetterAuthSession();
  await ensureAccount(userId);
  const result = await db.query(
    'SELECT id, name, status, created_at, updated_at FROM presu_project WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2',
    [userId, limit],
  );
  return result.rows;
}
