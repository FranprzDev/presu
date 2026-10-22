import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { db, ensureAccount } from '../db.ts';

export const schema = {};
export const metadata = { name: 'get_access_status', description: 'Consulta el saldo de cotizaciones gratuitas de Presu.' };

export default async function getAccessStatus() {
  const { userId } = await getBetterAuthSession();
  await ensureAccount(userId);
  const [credits, grilling] = await Promise.all([
    db.query(
    `SELECT COALESCE(SUM(amount), 0)::int AS credits FROM presu_credit_ledger
     WHERE user_id = $1 AND kind IN ('free_grant', 'free_consumption')`,
    [userId],
    ),
    db.query('SELECT count(*)::int AS used FROM presu_grilling_usage WHERE user_id = $1', [userId]),
  ]);
  const usedGrillingStarts = Number(grilling.rows[0].used);
  return {
    freeQuoteCredits: Number(credits.rows[0].credits),
    freeGrillingStarts: { used: usedGrillingStarts, remaining: Math.max(0, 10 - usedGrillingStarts) },
  };
}
