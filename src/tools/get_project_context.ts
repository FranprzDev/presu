import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { z } from 'zod';
import { db, ensureAccount, ownedProject } from '../db.ts';

export const schema = { projectId: z.string().uuid() };
export const metadata = { name: 'get_project_context', description: 'Recupera mensajes, documentos y alcance de un proyecto propio.' };

export default async function getProjectContext({ projectId }: { projectId: string }) {
  const { userId } = await getBetterAuthSession();
  await ensureAccount(userId);
  const project = await ownedProject(userId, projectId);
  const [messages, documents, brief] = await Promise.all([
    db.query('SELECT id, role, content, created_at FROM presu_message WHERE project_id = $1 ORDER BY created_at', [projectId]),
    db.query('SELECT id, filename, extracted_text, created_at FROM presu_document WHERE project_id = $1 ORDER BY created_at', [projectId]),
    db.query('SELECT version, data, updated_at FROM presu_brief WHERE project_id = $1 AND user_id = $2', [projectId, userId]),
  ]);
  return { project, messages: messages.rows, documents: documents.rows, brief: brief.rows[0] ?? null };
}
