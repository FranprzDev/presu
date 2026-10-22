import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { z } from 'zod';
import type { InferSchema } from 'xmcp';
import { briefSchema } from '../brief.ts';
import { db, ensureAccount, ownedProject } from '../db.ts';

export const schema = { projectId: z.string().uuid(), brief: briefSchema };
export const metadata = { name: 'save_brief', description: 'Valida y guarda una nueva versión del alcance de un proyecto propio.' };

export default async function saveBrief({ projectId, brief }: InferSchema<typeof schema>) {
  const { userId } = await getBetterAuthSession();
  await ensureAccount(userId);
  await ownedProject(userId, projectId);
  const result = await db.query(
    `INSERT INTO presu_brief (project_id, user_id, version, data)
     VALUES ($1, $2, 1, $3::jsonb)
     ON CONFLICT (project_id) DO UPDATE SET
       version = presu_brief.version + 1, data = EXCLUDED.data, updated_at = now()
     RETURNING version, updated_at`,
    [projectId, userId, JSON.stringify(brief)],
  );
  return { projectId, ...result.rows[0] };
}
