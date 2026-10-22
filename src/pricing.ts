import type { Brief } from './brief.js';

export function quoteTotals(brief: Brief, hourlyRateCents: number) {
  if (!Number.isSafeInteger(hourlyRateCents) || hourlyRateCents <= 0) throw new Error('INVALID_HOURLY_RATE');
  const minHours = brief.estimates.reduce((total, estimate) => total + estimate.minHours, 0);
  const maxHours = brief.estimates.reduce((total, estimate) => total + estimate.maxHours, 0);
  const totalMinCents = minHours * hourlyRateCents;
  const totalMaxCents = maxHours * hourlyRateCents;
  if (!Number.isSafeInteger(totalMaxCents)) throw new Error('QUOTE_TOTAL_TOO_LARGE');
  return { totalMinCents, totalMaxCents };
}

export function hasBlockingQuestions(brief: Brief) {
  return brief.questions.some((question) => question.blocksQuote && !question.resolved);
}
