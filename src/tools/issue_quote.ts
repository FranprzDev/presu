import { randomUUID } from 'node:crypto';
import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { z } from 'zod';
import type { InferSchema } from 'xmcp';
import { briefSchema } from '../brief.ts';
import { db, ensureAccount, ownedProject } from '../db.ts';
import { quoteTotals, hasBlockingQuestions } from '../pricing.ts';
import { renderQuotePdf } from '../pdf.ts';

export const schema = { projectId: z.string().uuid(), requestKey: z.string().uuid() };
export const metadata = { name: 'issue_quote', description: 'Emite una cotización PDF desde el alcance guardado. Consume un crédito gratuito al persistirla.' };

export default async function issueQuote({ projectId, requestKey }: InferSchema<typeof schema>) {
  const { userId } = await getBetterAuthSession();
  await ensureAccount(userId);
  const project = await ownedProject(userId, projectId);
  const existing = await db.query('SELECT id, version, total_min_cents, total_max_cents, pdf FROM presu_quote WHERE user_id = $1 AND request_key = $2', [userId, requestKey]);
  if (existing.rowCount) return { ...existing.rows[0], pdfBase64: existing.rows[0].pdf.toString('base64'), reused: true };

  const briefRow = await db.query('SELECT version, data FROM presu_brief WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
  if (!briefRow.rowCount) throw new Error('BRIEF_NOT_FOUND');
  const brief = briefSchema.parse(briefRow.rows[0].data);
  if (hasBlockingQuestions(brief)) throw new Error('BLOCKING_QUESTIONS_REMAIN');
  const hourlyRateCents = Number(process.env.HOURLY_RATE_CENTS);
  const currency = process.env.QUOTE_CURRENCY ?? 'USD';
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('INVALID_QUOTE_CURRENCY');
  const totals = quoteTotals(brief, hourlyRateCents);
  const pdf = await renderQuotePdf({ projectName: project.name, brief, currency, hourlyRateCents, ...totals });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`quote-user:${userId}`]);
    const raced = await client.query('SELECT id, version, total_min_cents, total_max_cents, pdf FROM presu_quote WHERE user_id = $1 AND request_key = $2', [userId, requestKey]);
    if (raced.rowCount) {
      await client.query('COMMIT');
      return { ...raced.rows[0], pdfBase64: raced.rows[0].pdf.toString('base64'), reused: true };
    }
    const balance = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS credits FROM presu_credit_ledger
       WHERE user_id = $1 AND kind IN ('free_grant', 'free_consumption')`,
      [userId],
    );
    if (balance.rows[0].credits < 1) throw new Error('NO_FREE_QUOTE_CREDITS');
    const count = await client.query('SELECT COALESCE(MAX(version), 0)::int + 1 AS version FROM presu_quote WHERE project_id = $1', [projectId]);
    const quoteId = randomUUID();
    const version = count.rows[0].version as number;
    await client.query(
      `INSERT INTO presu_quote (id, user_id, project_id, version, request_key, brief_version, currency,
        hourly_rate_cents, total_min_cents, total_max_cents, snapshot, pdf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,
      [quoteId, userId, projectId, version, requestKey, briefRow.rows[0].version, currency, hourlyRateCents,
        totals.totalMinCents, totals.totalMaxCents, JSON.stringify(brief), pdf],
    );
    await client.query(
      `INSERT INTO presu_credit_ledger (id, user_id, kind, amount, idempotency_key, project_id, quote_id)
       VALUES ($1, $2, 'free_consumption', -1, $3, $4, $5)`,
      [randomUUID(), userId, `quote:${requestKey}`, projectId, quoteId],
    );
    await client.query('COMMIT');
    return { id: quoteId, projectId, version, currency, ...totals, pdfBase64: pdf.toString('base64'), reused: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
