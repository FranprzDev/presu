import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesBnbTestnetTransfer } from '../src/bnb.ts';

const expected = { from: '0xAa', to: '0xBb', value: 100n };

test('accepts only the configured native transfer on BSC Testnet', () => {
  assert.equal(matchesBnbTestnetTransfer({ chainId: 97, from: '0xaa', to: '0xbb', value: 100n }, expected), true);
  assert.equal(matchesBnbTestnetTransfer({ chainId: 56, from: '0xaa', to: '0xbb', value: 100n }, expected), false);
  assert.equal(matchesBnbTestnetTransfer({ chainId: 97, from: '0xcc', to: '0xbb', value: 100n }, expected), false);
  assert.equal(matchesBnbTestnetTransfer({ chainId: 97, from: '0xaa', to: '0xdd', value: 100n }, expected), false);
  assert.equal(matchesBnbTestnetTransfer({ chainId: 97, from: '0xaa', to: '0xbb', value: 99n }, expected), false);
});
