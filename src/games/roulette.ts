export type PocketColor = 'red' | 'black' | 'green';

export interface Pocket {
  number: number;
  color: PocketColor;
}

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

// European wheel order, starting at 0 and going clockwise.
const WHEEL_ORDER: number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const ROULETTE_POCKETS: Pocket[] = WHEEL_ORDER.map((n) => ({
  number: n,
  color: n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black',
}));

export type BetKind =
  | 'straight'
  | 'red'
  | 'black'
  | 'even'
  | 'odd'
  | 'low'
  | 'high'
  | 'dozen1'
  | 'dozen2'
  | 'dozen3'
  | 'col1'
  | 'col2'
  | 'col3';

export interface Bet {
  kind: BetKind;
  number?: number; // only for 'straight'
  amount: number;
}

export function pocketForNumber(n: number): Pocket {
  return ROULETTE_POCKETS.find((p) => p.number === n) ?? ROULETTE_POCKETS[0];
}

export function indexForNumber(n: number): number {
  const i = WHEEL_ORDER.indexOf(n);
  return i < 0 ? 0 : i;
}

export function spinRoulette(rng: () => number = Math.random): number {
  const idx = Math.floor(rng() * ROULETTE_POCKETS.length);
  return ROULETTE_POCKETS[Math.min(idx, ROULETTE_POCKETS.length - 1)].number;
}

function betWins(bet: Bet, result: number): boolean {
  if (result === 0) {
    return bet.kind === 'straight' && bet.number === 0;
  }
  const pocket = pocketForNumber(result);
  switch (bet.kind) {
    case 'straight': return bet.number === result;
    case 'red': return pocket.color === 'red';
    case 'black': return pocket.color === 'black';
    case 'even': return result % 2 === 0;
    case 'odd': return result % 2 === 1;
    case 'low': return result >= 1 && result <= 18;
    case 'high': return result >= 19 && result <= 36;
    case 'dozen1': return result >= 1 && result <= 12;
    case 'dozen2': return result >= 13 && result <= 24;
    case 'dozen3': return result >= 25 && result <= 36;
    case 'col1': return result % 3 === 1;
    case 'col2': return result % 3 === 2;
    case 'col3': return result % 3 === 0;
    default: return false;
  }
}

// Classic casino payouts (multiplier of wager, excluding the original stake).
const PAYOUT: Record<BetKind, number> = {
  straight: 35,
  red: 1, black: 1, even: 1, odd: 1, low: 1, high: 1,
  dozen1: 2, dozen2: 2, dozen3: 2,
  col1: 2, col2: 2, col3: 2,
};

export interface BetOutcome {
  bet: Bet;
  won: boolean;
  /** Net change: positive (profit) if won, negative (-amount) if lost. */
  delta: number;
}

export interface SettlementResult {
  result: number;
  perBet: BetOutcome[];
  totalStake: number;
  totalReturn: number; // profit - losses
}

export function settleBets(bets: Bet[], result: number): SettlementResult {
  const perBet: BetOutcome[] = [];
  let totalStake = 0;
  let totalReturn = 0;
  for (const bet of bets) {
    totalStake += bet.amount;
    const won = betWins(bet, result);
    const delta = won ? bet.amount * PAYOUT[bet.kind] : -bet.amount;
    totalReturn += delta;
    perBet.push({ bet, won, delta });
  }
  return { result, perBet, totalStake, totalReturn };
}
