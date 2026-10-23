import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import {
  createPublicClient, getAddress, http, isAddress, isHash, type Hex, TransactionNotFoundError,
  TransactionReceiptNotFoundError, verifyMessage,
  zeroAddress,
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { z } from 'zod';
import { matchesBnbTestnetTransfer } from './bnb.ts';
import { db, ensureAccount } from './db.ts';
import { issueQuoteForUser } from './quotes.ts';

const databaseUrl = process.env.DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_BASE_URL;
const port = Number(process.env.PAYMENTS_PORT ?? 3001);
if (!databaseUrl || !authSecret || !baseURL || !Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error('DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_BASE_URL, and a valid PAYMENTS_PORT are required');
}
const authOrigin = new URL(baseURL).origin;

const auth = betterAuth({
  database: new Pool({ connectionString: databaseUrl, max: 5 }),
  baseURL,
  secret: authSecret,
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== authOrigin) {
        res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.status(204).end();
    return;
  }
  next();
});

app.get('/api/payments/credits', authenticated, async (_req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE kind IN ('free_grant', 'free_consumption')), 0)::int AS free,
         COALESCE(SUM(amount) FILTER (WHERE kind IN ('paid_purchase', 'paid_consumption')), 0)::int AS paid
       FROM presu_credit_ledger WHERE user_id = $1`,
      [res.locals.userId],
    );
    res.json({ freeQuoteCredits: result.rows[0].free, paidQuoteCredits: result.rows[0].paid });
  } catch (error) {
    next(error);
  }
});

app.post('/api/quotes/issue', authenticated, async (req, res, next) => {
  try {
    const { projectId, requestKey } = z.object({ projectId: z.string().uuid(), requestKey: z.string().uuid() }).parse(req.body);
    res.json(await issueQuoteForUser(res.locals.userId as string, projectId, requestKey, 'web'));
  } catch (error) {
    next(error);
  }
});

const userId = async (req: Request) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user.id;
};

async function authenticated(req: Request, res: Response, next: NextFunction) {
  try {
    const id = await userId(req);
    if (!id) {
      res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
      return;
    }
    res.locals.userId = id;
    await ensureAccount(id);
    next();
  } catch (error) {
    next(error);
  }
}

const challengeSchema = z.object({ address: z.string().refine(isAddress) });
const verificationSchema = z.object({
  challengeId: z.string().uuid(),
  address: z.string().refine(isAddress),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});
const transactionSchema = z.object({ hash: z.string().refine(isHash) });

async function paymentConfig() {
  const rpcUrl = process.env.BNB_TESTNET_RPC_URL;
  const receiver = process.env.BNB_RECEIVER_ADDRESS;
  const amountWei = process.env.BNB_CREDIT_PRICE_WEI;
  const confirmations = Number(process.env.BNB_MIN_CONFIRMATIONS ?? 3);
  if (!rpcUrl || !receiver || !isAddress(receiver) || getAddress(receiver) === zeroAddress || !amountWei
    || !/^\d{1,78}$/.test(amountWei) || BigInt(amountWei) < 1n || !Number.isSafeInteger(confirmations) || confirmations < 1) {
    throw new Error('BNB_TESTNET_PAYMENT_NOT_CONFIGURED');
  }
  let rpc: URL;
  try {
    rpc = new URL(rpcUrl);
  } catch {
    throw new Error('BNB_TESTNET_PAYMENT_NOT_CONFIGURED');
  }
  if (!['http:', 'https:'].includes(rpc.protocol) || rpc.username || rpc.password) {
    throw new Error('BNB_TESTNET_PAYMENT_NOT_CONFIGURED');
  }
  const client = createPublicClient({ chain: bscTestnet, transport: http(rpc.href, { timeout: 10000 }) });
  if (await client.getChainId() !== 97) throw new Error('BNB_TESTNET_RPC_CHAIN_MISMATCH');
  return {
    client,
    receiver: getAddress(receiver),
    amountWei: BigInt(amountWei),
    confirmations,
  };
}

app.post('/api/payments/wallet/challenge', authenticated, async (req, res, next) => {
  try {
    const { address } = challengeSchema.parse(req.body);
    const wallet = getAddress(address);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const message = [
      'Presu wallet ownership verification',
      `Account: ${res.locals.userId as string}`,
      'Network: BSC Testnet (chain ID 97)',
      `Challenge: ${id}`,
      `Expires: ${expiresAt.toISOString()}`,
    ].join('\n');
    await db.query(
      'INSERT INTO presu_wallet_challenge (id, user_id, address, message, expires_at) VALUES ($1,$2,$3,$4,$5)',
      [id, res.locals.userId, wallet, message, expiresAt],
    );
    res.json({ challengeId: id, message, expiresAt });
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/wallet/verify', authenticated, async (req, res, next) => {
  const client = await db.connect();
  try {
    const { challengeId, address, signature } = verificationSchema.parse(req.body);
    const wallet = getAddress(address);
    const challenge = await client.query(
      `SELECT message FROM presu_wallet_challenge
       WHERE id = $1 AND user_id = $2 AND address = $3 AND used_at IS NULL AND expires_at > now()`,
      [challengeId, res.locals.userId, wallet],
    );
    if (!challenge.rowCount) {
      res.status(400).json({ error: 'WALLET_CHALLENGE_INVALID_OR_EXPIRED' });
      return;
    }
    const valid = await verifyMessage({ address: wallet, message: challenge.rows[0].message, signature: signature as Hex });
    if (!valid) {
      res.status(400).json({ error: 'WALLET_SIGNATURE_INVALID' });
      return;
    }
    await client.query('BEGIN');
    const consumed = await client.query(
      `UPDATE presu_wallet_challenge SET used_at = now()
       WHERE id = $1 AND user_id = $2 AND address = $3 AND used_at IS NULL AND expires_at > now() RETURNING id`,
      [challengeId, res.locals.userId, wallet],
    );
    if (!consumed.rowCount) throw new Error('WALLET_CHALLENGE_ALREADY_USED');
    await client.query('UPDATE presu_account SET wallet_address = $1 WHERE user_id = $2', [wallet, res.locals.userId]);
    await client.query('COMMIT');
    res.json({ address: wallet, network: 'bsc-testnet', chainId: 97 });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/payments/intents', authenticated, async (_req, res, next) => {
  try {
    const config = await paymentConfig();
    const account = await db.query('SELECT wallet_address FROM presu_account WHERE user_id = $1', [res.locals.userId]);
    if (!account.rows[0]?.wallet_address) {
      res.status(409).json({ error: 'WALLET_NOT_LINKED' });
      return;
    }
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 20 * 60_000);
    await db.query(
      `INSERT INTO presu_payment_intent (id, user_id, wallet_address, amount_wei, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, res.locals.userId, account.rows[0].wallet_address, config.amountWei.toString(), expiresAt],
    );
    res.status(201).json({
      id,
      chainId: 97,
      asset: 'BNB',
      amountWei: config.amountWei.toString(),
      receiver: config.receiver,
      sender: account.rows[0].wallet_address,
      expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/intents/:id/verify', authenticated, async (req, res, next) => {
  const client = await db.connect();
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { hash } = transactionSchema.parse(req.body);
    const txHash = hash.toLowerCase() as `0x${string}`;
    const intentResult = await db.query(
      'SELECT id, wallet_address, amount_wei, status, expires_at, transaction_hash FROM presu_payment_intent WHERE id = $1 AND user_id = $2',
      [id, res.locals.userId],
    );
    if (!intentResult.rowCount) {
      res.status(404).json({ error: 'PAYMENT_INTENT_NOT_FOUND' });
      return;
    }
    const intent = intentResult.rows[0];
    if (intent.status === 'paid') {
      res.json({ id, status: 'paid' });
      return;
    }
    if (intent.transaction_hash && intent.transaction_hash.trim().toLowerCase() !== txHash) {
      res.status(409).json({ error: 'PAYMENT_INTENT_ALREADY_HAS_TRANSACTION' });
      return;
    }
    const duplicate = await db.query('SELECT payment_intent_id FROM presu_payment_attempt WHERE transaction_hash = $1', [txHash]);
    if (duplicate.rowCount && duplicate.rows[0].payment_intent_id !== id) {
      res.status(409).json({ error: 'TRANSACTION_ALREADY_CLAIMED' });
      return;
    }

    const config = await paymentConfig();
    let transfer;
    try {
      transfer = await config.client.getTransaction({ hash: txHash });
    } catch (error) {
      if (error instanceof TransactionNotFoundError) {
        res.status(202).json({ id, status: 'pending', reason: 'transaction_not_indexed_yet' });
        return;
      }
      throw error;
    }
    let receipt;
    try {
      receipt = await config.client.getTransactionReceipt({ hash: txHash });
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError) {
        res.status(202).json({ id, status: 'pending', reason: 'awaiting_inclusion' });
        return;
      }
      throw error;
    }
    const latestBlock = await config.client.getBlockNumber();
    const confirmations = Number(latestBlock - receipt.blockNumber + 1n);
    const exactTransfer = matchesBnbTestnetTransfer({ ...transfer, chainId: transfer.chainId ?? null }, {
      from: intent.wallet_address,
      to: config.receiver,
      value: BigInt(intent.amount_wei),
    });
    const record = async (status: 'pending' | 'paid' | 'failed' | 'review', details: Record<string, unknown>) => {
      await client.query('BEGIN');
      const locked = await client.query(
        'SELECT status FROM presu_payment_intent WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, res.locals.userId],
      );
      if (!locked.rowCount) throw new Error('PAYMENT_INTENT_NOT_FOUND');
      if (locked.rows[0].status === 'paid') {
        await client.query('COMMIT');
        return 'paid';
      }
      await client.query(
        `INSERT INTO presu_payment_attempt (transaction_hash, user_id, payment_intent_id, status, details)
         VALUES ($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (transaction_hash) DO UPDATE SET status = EXCLUDED.status, details = EXCLUDED.details, updated_at = now()`,
        [txHash, res.locals.userId, id, status, JSON.stringify(details)],
      );
      await client.query(
        'UPDATE presu_payment_intent SET status = $1, transaction_hash = $2, review_reason = $3 WHERE id = $4',
        [status, txHash, status === 'review' ? 'Transfer does not match the configured testnet payment' : null, id],
      );
      if (status === 'paid') {
        await client.query(
          `INSERT INTO presu_credit_ledger (id, user_id, kind, amount, idempotency_key, payment_intent_id)
           VALUES ($1,$2,'paid_purchase',1,$3,$4) ON CONFLICT (idempotency_key) DO NOTHING`,
          [randomUUID(), res.locals.userId, `payment:${id}`, id],
        );
        await client.query('UPDATE presu_payment_intent SET paid_at = now() WHERE id = $1', [id]);
      }
      await client.query('COMMIT');
      return status;
    };

    if (new Date(intent.expires_at).getTime() < Date.now()) {
      const status = await record('review', { reason: 'expired', txHash });
      res.status(409).json({ id, status });
      return;
    }
    if (!exactTransfer) {
      const status = await record('review', {
        reason: 'transfer_mismatch',
        chainId: transfer.chainId,
        from: transfer.from,
        to: transfer.to,
        valueWei: transfer.value.toString(),
      });
      res.status(409).json({ id, status });
      return;
    }
    if (receipt.status !== 'success') {
      const status = await record('failed', { reason: 'reverted', blockNumber: receipt.blockNumber.toString() });
      res.status(409).json({ id, status });
      return;
    }
    if (confirmations < config.confirmations) {
      const status = await record('pending', { confirmations, required: config.confirmations });
      res.json({ id, status, confirmations, requiredConfirmations: config.confirmations });
      return;
    }
    const status = await record('paid', { confirmations, required: config.confirmations });
    res.json({ id, status, confirmations, creditsAdded: 1 });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'INVALID_REQUEST', issues: error.issues });
    return;
  }
  if (error instanceof Error && error.message === 'BNB_TESTNET_PAYMENT_NOT_CONFIGURED') {
    res.status(503).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.message === 'BNB_TESTNET_RPC_CHAIN_MISMATCH') {
    res.status(503).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.message === 'NO_QUOTE_CREDITS') {
    res.status(402).json({ error: error.message });
    return;
  }
  if (error instanceof Error && ['BLOCKING_QUESTIONS_REMAIN', 'BRIEF_NOT_FOUND', 'PROJECT_NOT_FOUND', 'PAID_QUOTE_NOT_AVAILABLE_IN_MCP', 'REQUEST_KEY_REUSED'].includes(error.message)) {
    res.status(409).json({ error: error.message });
    return;
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    if ('constraint' in error && error.constraint === 'presu_account_wallet_address_key') {
      res.status(409).json({ error: 'WALLET_ALREADY_LINKED' });
      return;
    }
    if ('constraint' in error && error.constraint === 'presu_payment_intent_transaction_hash_key') {
      res.status(409).json({ error: 'TRANSACTION_ALREADY_CLAIMED' });
      return;
    }
  }
  res.status(500).json({ error: 'PAYMENT_REQUEST_FAILED' });
});

app.listen(port, process.env.PAYMENTS_HOST ?? '127.0.0.1', () => console.log(`Presu web API listening on ${port} (BSC Testnet only)`));
