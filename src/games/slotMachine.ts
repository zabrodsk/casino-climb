export type SlotSymbol = 'cherry' | 'bell' | 'bar' | 'seven' | 'wheel' | 'crown';

export const SLOT_SYMBOLS: SlotSymbol[] = ['cherry', 'bell', 'bar', 'seven', 'wheel', 'crown'];

const SYMBOL_WEIGHTS: Record<SlotSymbol, number> = {
  cherry: 28,
  bell: 22,
  bar: 16,
  seven: 10,
  wheel: 14,
  crown: 10,
};

/** Payout multipliers on the wager (profit, excluding stake). */
export const SYMBOL_PAYOUT: Record<SlotSymbol, { three: number; two: number }> = {
  cherry: { three: 5,  two: 1 },
  bell:   { three: 8,  two: 2 },
  bar:    { three: 12, two: 3 },
  wheel:  { three: 18, two: 4 },
  seven:  { three: 30, two: 6 },
  crown:  { three: 50, two: 8 },
};

function weightedPick(rng: () => number): SlotSymbol {
  const total = SLOT_SYMBOLS.reduce((s, sym) => s + SYMBOL_WEIGHTS[sym], 0);
  let r = rng() * total;
  for (const sym of SLOT_SYMBOLS) {
    r -= SYMBOL_WEIGHTS[sym];
    if (r <= 0) return sym;
  }
  return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1];
}

export function spinReels(rng: () => number = Math.random): [SlotSymbol, SlotSymbol, SlotSymbol] {
  return [weightedPick(rng), weightedPick(rng), weightedPick(rng)];
}

export interface SpinOutcome {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  /** Net delta: payout - wager when losing, payout profit when winning. */
  delta: number;
  kind: 'three' | 'two-left' | 'two-right' | 'lose';
  matchedSymbol: SlotSymbol | null;
}

export function evaluatePayline(
  reels: [SlotSymbol, SlotSymbol, SlotSymbol],
  wager: number,
): SpinOutcome {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    return {
      reels, matchedSymbol: a, kind: 'three',
      delta: wager * SYMBOL_PAYOUT[a].three,
    };
  }
  if (a === b) {
    return {
      reels, matchedSymbol: a, kind: 'two-left',
      delta: wager * SYMBOL_PAYOUT[a].two - wager,
    };
  }
  if (b === c) {
    return {
      reels, matchedSymbol: b, kind: 'two-right',
      delta: wager * SYMBOL_PAYOUT[b].two - wager,
    };
  }
  return { reels, matchedSymbol: null, kind: 'lose', delta: -wager };
}
