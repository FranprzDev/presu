import { getBetterAuthSession } from '@xmcp-dev/better-auth';
import { z } from 'zod';
import type { InferSchema } from 'xmcp';
import { issueQuoteForUser } from '../quotes.ts';

export const schema = { projectId: z.string().uuid(), requestKey: z.string().uuid() };
export const metadata = { name: 'issue_quote', description: 'Emite una cotización PDF desde el alcance guardado. Consume un crédito gratuito al persistirla.' };

export default async function issueQuote({ projectId, requestKey }: InferSchema<typeof schema>) {
  const { userId } = await getBetterAuthSession();
  return issueQuoteForUser(userId, projectId, requestKey, 'mcp');
}
