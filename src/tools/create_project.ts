import { randomUUID } from 'node:crypto';
import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { z } from 'zod';
import type { InferSchema } from 'xmcp';
import { db, ensureAccount } from '../db.ts';

export const schema = { name: z.string().trim().min(1).max(200) };
export const metadata = { name: 'create_project', description: 'Crea un proyecto privado en Presu.' };

export default async function createProject({ name }: InferSchema<typeof schema>) {
  const { userId } = await getBetterAuthSession();
  await ensureAccount(userId);
  const id = randomUUID();
  await db.query('INSERT INTO presu_project (id, user_id, name) VALUES ($1, $2, $3)', [id, userId, name]);
  return { id, name, status: 'active' };
}
