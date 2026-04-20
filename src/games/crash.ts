export interface CrashInput {
  coins: number;
  bet: number;
  cashOutAt?: number;
  crashPoint: number;
}

export interface CrashResult {
  won: boolean;
  payout: number;
  newCoins: number;
  displayMultiplier: string;
}

export function resolve(input: CrashInput): CrashResult {
  const { coins, bet, cashOutAt, crashPoint } = input;
  if (cashOutAt !== undefined && cashOutAt <= crashPoint) {
    const payout = Math.floor(bet * cashOutAt);
    return {
      won: true,
      payout,
      newCoins: coins - bet + payout,
      displayMultiplier: cashOutAt.toFixed(2) + 'x',
    };
  }
  return {
    won: false,
    payout: 0,
    newCoins: coins - bet,
    displayMultiplier: 'CRASHED',
  };
}

/**
 * Standard crash distribution with 1% house edge:
 *   crashPoint = floor((0.99 / (1 - u)) * 100) / 100
 * Minimum 1.00. Produces the correct long-tail distribution.
 */
export function nextCrashPoint(): number {
  const u = Math.random();
  const raw = 0.99 / (1 - u);
  return Math.max(1.00, Math.floor(raw * 100) / 100);
}

export function isValidBet(coins: number, bet: number): boolean {
  return bet >= 5 && bet <= 50 && bet <= coins;
}

/** Growth rate constant — multiplier = e^(CRASH_K * seconds) */
export const CRASH_K = 0.07;

/** Time (seconds) at which crashPoint is reached under exponential growth. */
export function crashTimeFromPoint(cp: number): number {
  return Math.log(Math.max(cp, 1.001)) / CRASH_K;
}
