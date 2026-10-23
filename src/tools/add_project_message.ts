import { randomUUID } from 'node:crypto';
import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { z } from 'zod';
import type { InferSchema } from 'xmcp';
import { db, ensureAccount, transaction } from '../db.ts';

export const schema = {
  projectId: z.string().uuid(),
  content: z.string().trim().min(1).max(20000),
};
export const metadata = { name: 'add_project_message', description: 'Guarda una respuesta del usuario en un proyecto propio.' };

export default async function addProjectMessage({ projectId, content }: InferSchema<typeof schema>) {
  const { userId } = await getBetterAuthSession();
  await ensureAccount(userId);
  const id = randomUUID();
  const usage = await transaction(async (client) => {
    await client.query('SELECT user_id FROM presu_account WHERE user_id = $1 FOR UPDATE', [userId]);
    const project = await client.query(
      'SELECT id FROM presu_project WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [projectId, userId],
    );
    if (!project.rowCount) throw new Error('PROJECT_NOT_FOUND');

    const started = await client.query(
      'SELECT 1 FROM presu_grilling_usage WHERE project_id = $1',
      [projectId],
    );
    if (!started.rowCount) {
      // El grilling es ilimitado: se registra el uso para analítica, pero no se bloquea.
      await client.query(
        'INSERT INTO presu_grilling_usage (project_id, user_id) VALUES ($1, $2)',
        [projectId, userId],
      );
    }
    await client.query(
      `INSERT INTO presu_message (id, project_id, user_id, role, content)
       VALUES ($1, $2, $3, 'user', $4)`,
      [id, projectId, userId, content],
    );
    await client.query('UPDATE presu_project SET updated_at = now() WHERE id = $1', [projectId]);
    return !started.rowCount;
  });
  return { id, projectId, saved: true, startedGrilling: usage };
}
