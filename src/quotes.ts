import { randomUUID } from 'node:crypto';
import { briefSchema } from './brief.ts';
import { db, ensureAccount, ownedProject } from './db.ts';
import { renderQuotePdf } from './pdf.ts';
import { creditKindForQuote, hasBlockingQuestions, quoteTotals } from './pricing.ts';

export async function issueQuoteForUser(userId: string, projectId: string, requestKey: string, channel: 'mcp' | 'web') {
  await ensureAccount(userId);
  const project = await ownedProject(userId, projectId);
  const existing = await db.query(
    'SELECT id, project_id, version, total_min_cents, total_max_cents, pdf, mcp_available FROM presu_quote WHERE user_id = $1 AND request_key = $2',
    [userId, requestKey],
  );
  if (existing.rowCount) {
    if (existing.rows[0].project_id !== projectId) throw new Error('REQUEST_KEY_REUSED');
    if (channel === 'mcp' && !existing.rows[0].mcp_available) throw new Error('PAID_QUOTE_NOT_AVAILABLE_IN_MCP');
    return { ...existing.rows[0], pdfBase64: existing.rows[0].pdf.toString('base64'), reused: true };
  }

  const briefRow = await db.query('SELECT version, data FROM presu_brief WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
  if (!briefRow.rowCount) throw new Error('BRIEF_NOT_FOUND');
  const brief = briefSchema.parse(briefRow.rows[0].data);
  if (hasBlockingQuestions(brief)) throw new Error('BLOCKING_QUESTIONS_REMAIN');
  const available = channel === 'mcp'
    ? await db.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS free FROM presu_credit_ledger
       WHERE user_id = $1 AND kind IN ('free_grant', 'free_consumption')`,
      [userId],
    )
    : await db.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE kind IN ('free_grant', 'free_consumption')), 0)::int AS free,
         COALESCE(SUM(amount) FILTER (WHERE kind IN ('paid_purchase', 'paid_consumption')), 0)::int AS paid
       FROM presu_credit_ledger WHERE user_id = $1`,
      [userId],
    );
  if (!creditKindForQuote(channel, available.rows[0].free, channel === 'web' ? available.rows[0].paid : 0)) {
    throw new Error(channel === 'mcp' ? 'NO_FREE_QUOTE_CREDITS' : 'NO_QUOTE_CREDITS');
  }
  const hourlyRateCents = Number(process.env.HOURLY_RATE_CENTS);
  const currency = process.env.QUOTE_CURRENCY ?? 'USD';
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('INVALID_QUOTE_CURRENCY');
  const totals = quoteTotals(brief, hourlyRateCents);
  const pdf = await renderQuotePdf({ projectName: project.name, brief, currency, hourlyRateCents, ...totals });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`quote-user:${userId}`]);
    const raced = await client.query(
      'SELECT id, project_id, version, total_min_cents, total_max_cents, pdf, mcp_available FROM presu_quote WHERE user_id = $1 AND request_key = $2',
      [userId, requestKey],
    );
    if (raced.rowCount) {
      if (raced.rows[0].project_id !== projectId) throw new Error('REQUEST_KEY_REUSED');
      if (channel === 'mcp' && !raced.rows[0].mcp_available) throw new Error('PAID_QUOTE_NOT_AVAILABLE_IN_MCP');
      await client.query('COMMIT');
      return { ...raced.rows[0], pdfBase64: raced.rows[0].pdf.toString('base64'), reused: true };
    }
    const balances = channel === 'mcp'
      ? await client.query(
        `SELECT COALESCE(SUM(amount), 0)::int AS free FROM presu_credit_ledger
         WHERE user_id = $1 AND kind IN ('free_grant', 'free_consumption')`,
        [userId],
      )
      : await client.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE kind IN ('free_grant', 'free_consumption')), 0)::int AS free,
           COALESCE(SUM(amount) FILTER (WHERE kind IN ('paid_purchase', 'paid_consumption')), 0)::int AS paid
         FROM presu_credit_ledger WHERE user_id = $1`,
        [userId],
      );
    const consumeKind = creditKindForQuote(channel, balances.rows[0].free, channel === 'web' ? balances.rows[0].paid : 0);
    if (!consumeKind) throw new Error(channel === 'mcp' ? 'NO_FREE_QUOTE_CREDITS' : 'NO_QUOTE_CREDITS');

    const count = await client.query('SELECT COALESCE(MAX(version), 0)::int + 1 AS version FROM presu_quote WHERE project_id = $1', [projectId]);
    const quoteId = randomUUID();
    const version = count.rows[0].version as number;
    await client.query(
      `INSERT INTO presu_quote (id, user_id, project_id, version, request_key, brief_version, currency,
        hourly_rate_cents, total_min_cents, total_max_cents, snapshot, pdf, mcp_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
      [quoteId, userId, projectId, version, requestKey, briefRow.rows[0].version, currency, hourlyRateCents,
        totals.totalMinCents, totals.totalMaxCents, JSON.stringify(brief), pdf, consumeKind !== 'paid_consumption'],
    );
    await client.query(
      `INSERT INTO presu_credit_ledger (id, user_id, kind, amount, idempotency_key, project_id, quote_id)
       VALUES ($1, $2, $3, -1, $4, $5, $6)`,
      [randomUUID(), userId, consumeKind, `quote:${userId}:${requestKey}`, projectId, quoteId],
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
