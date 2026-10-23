export function matchesBnbTestnetTransfer(input: {
  chainId: number | null;
  from: string;
  to: string | null;
  value: bigint;
}, expected: { from: string; to: string; value: bigint }) {
  return input.chainId === 97
    && input.from.toLowerCase() === expected.from.toLowerCase()
    && input.to?.toLowerCase() === expected.to.toLowerCase()
    && input.value === expected.value;
}
