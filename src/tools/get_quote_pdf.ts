import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { z } from 'zod';
import { db, ensureAccount } from '../db.ts';

export const schema = { quoteId: z.string().uuid() };
export const metadata = { name: 'get_quote_pdf', description: 'Recupera el PDF de una cotización propia en base64.' };

export default async function getQuotePdf({ quoteId }: { quoteId: string }) {
  const { userId } = await getBetterAuthSession();
  await ensureAccount(userId);
  const result = await db.query(
    'SELECT id, project_id, version, currency, total_min_cents, total_max_cents, pdf FROM presu_quote WHERE id = $1 AND user_id = $2 AND mcp_available',
    [quoteId, userId],
  );
  if (!result.rowCount) throw new Error('QUOTE_NOT_FOUND');
  const quote = result.rows[0];
  return {
    id: quote.id,
    projectId: quote.project_id,
    version: quote.version,
    currency: quote.currency,
    totalMinCents: quote.total_min_cents,
    totalMaxCents: quote.total_max_cents,
    pdfBase64: quote.pdf.toString('base64'),
  };
}
