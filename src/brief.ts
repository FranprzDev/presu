import { z } from 'zod';

export const briefSchema = z.object({
  summary: z.string().max(5000),
  requirements: z.array(z.object({
    description: z.string().min(1).max(2000),
    source: z.string().min(1).max(4000),
    sourceMessageId: z.string().uuid(),
  })).max(100),
  questions: z.array(z.object({
    id: z.string().min(1).max(80),
    question: z.string().min(1).max(2000),
    reason: z.string().min(1).max(2000),
    blocksQuote: z.boolean(),
    resolved: z.boolean().default(false),
    sourceMessageId: z.string().uuid().optional(),
  })).max(100),
  risks: z.array(z.object({
    description: z.string().min(1).max(2000),
    impact: z.string().min(1).max(1000),
    mitigation: z.string().max(1000),
  })).max(100),
  included: z.array(z.string().min(1).max(1000)).max(100),
  excluded: z.array(z.string().min(1).max(1000)).max(100),
  assumptions: z.array(z.string().min(1).max(1000)).max(100),
  acceptanceCriteria: z.array(z.string().min(1).max(1000)).max(100),
  nextSteps: z.array(z.string().min(1).max(1000)).max(100),
  estimates: z.array(z.object({
    module: z.string().min(1).max(200),
    minHours: z.number().int().nonnegative().max(100000),
    maxHours: z.number().int().nonnegative().max(100000),
  }).refine((estimate) => estimate.maxHours >= estimate.minHours)).max(100),
});

export type Brief = z.infer<typeof briefSchema>;
