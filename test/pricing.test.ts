import assert from 'node:assert/strict';
import test from 'node:test';
import { briefSchema } from '../src/brief.ts';
import { hasBlockingQuestions, quoteTotals } from '../src/pricing.ts';

const brief = briefSchema.parse({
  summary: 'Una aplicación', requirements: [], questions: [], risks: [], included: [], excluded: [],
  assumptions: [], acceptanceCriteria: [], nextSteps: [],
  estimates: [{ module: 'MVP', minHours: 12, maxHours: 18 }],
});

test('calculates quote totals from validated hour estimates', () => {
  assert.deepEqual(quoteTotals(brief, 12500), { totalMinCents: 150000, totalMaxCents: 225000 });
});

test('rejects unsafe prices and overflow', () => {
  assert.throws(() => quoteTotals(brief, 0), /INVALID_HOURLY_RATE/);
  assert.throws(() => quoteTotals({ ...brief, estimates: [{ module: 'MVP', minHours: 100000, maxHours: 100000 }] }, Number.MAX_SAFE_INTEGER), /QUOTE_TOTAL_TOO_LARGE/);
});

test('blocks only unresolved questions marked as blocking', () => {
  const pending = { ...brief, questions: [{ id: 'q1', question: '¿Cuál?', reason: 'Cambia el alcance', blocksQuote: true, resolved: false }] };
  assert.equal(hasBlockingQuestions(pending), true);
  assert.equal(hasBlockingQuestions({ ...pending, questions: [{ ...pending.questions[0], resolved: true }] }), false);
});
