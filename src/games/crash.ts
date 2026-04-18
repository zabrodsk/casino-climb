export interface CrashInput {
  coins: number;
  bet: number;
  cashOutAt?: number;   // multiplier at which player cashed out; undefined = never cashed out
  crashPoint: number;   // where this round crashed
}

export interface CrashResult {
  won: boolean;
  payout: number;       // total paid (bet * cashOutAt) or 0 if crashed before cashout
  newCoins: number;
  displayMultiplier: string; // e.g. "1.87x" or "CRASHED"
}

export function resolve(input: CrashInput): CrashResult {
  const { coins, bet, cashOutAt, crashPoint } = input;

  if (cashOutAt !== undefined && cashOutAt <= crashPoint) {
    // Player cashed out before crash
    const payout = Math.floor(bet * cashOutAt);
    return {
      won: true,
      payout,
      newCoins: coins - bet + payout,
      displayMultiplier: cashOutAt.toFixed(2) + 'x',
    };
  }

  // Crashed before cashout
  return {
    won: false,
    payout: 0,
    newCoins: coins - bet,
    displayMultiplier: 'CRASHED',
  };
}

/**
 * RNG helper: returns a crash point between 1.05 and 6.0, strongly weighted
 * toward early crashes so high multipliers are uncommon.
 * Distribution: x = 1 / (1 - u^1.35) where u is random [0,1), clamped to [1.05, 6].
 * Sub-1.2 results are rerolled ~85% of the time to keep instant-bust crashes rare.
 */
export function nextCrashPoint(): number {
  while (true) {
    const u = Math.random();
    const raw = 1 / (1 - Math.pow(u, 1.35));
    const point = Math.min(6, Math.max(1.05, raw));
    if (point >= 1.2 || Math.random() < 0.15) return point;
  }
}

export function isValidBet(coins: number, bet: number): boolean {
  return bet >= 5 && bet <= 50 && bet <= coins;
}
