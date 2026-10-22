import { randomUUID } from 'node:crypto';
import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { z } from 'zod';
import type { InferSchema } from 'xmcp';
import { db, ensureAccount, ownedProject } from '../db.ts';

export const schema = {
  projectId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  extractedText: z.string().min(1).max(200000),
};
export const metadata = { name: 'add_project_document', description: 'Guarda texto extraído de un documento en un proyecto propio.' };

export default async function addProjectDocument({ projectId, filename, extractedText }: InferSchema<typeof schema>) {
  const { userId } = await getBetterAuthSession();
  await ensureAccount(userId);
  await ownedProject(userId, projectId);
  const id = randomUUID();
  await db.query(
    'INSERT INTO presu_document (id, project_id, user_id, filename, extracted_text) VALUES ($1, $2, $3, $4, $5)',
    [id, projectId, userId, filename, extractedText],
  );
  return { id, projectId, filename, saved: true };
}
