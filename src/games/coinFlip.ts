export type RiskType = 'flip' | 'dice';

export interface CoinFlipResult {
  won: boolean;
  payout: number;        // total paid out (bet + winnings), or 0 if lost
  newCoins: number;      // resulting coin total after bet resolves
  displayResult: string; // human-readable result
}

export interface CoinFlipInput {
  coins: number;
  bet: number;
  riskType: RiskType;
  diceGuess?: 'low' | 'high'; // for dice mode: low = 1-3, high = 4-6
}

/**
 * Coin Flip: 50% chance. If win, payout = 2 × bet.
 * Dice Duel: 1-6 die. Player guesses low (1-3) or high (4-6). 50% chance. Payout = 2 × bet.
 */
export function play(input: CoinFlipInput): CoinFlipResult {
  const { coins, bet, riskType, diceGuess = 'low' } = input;

  if (riskType === 'flip') {
    const flip = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = flip === 'heads';
    const displayResult = won ? 'Heads!' : 'Tails';
    return {
      won,
      payout: won ? bet * 2 : 0,
      newCoins: won ? coins + bet : coins - bet,
      displayResult,
    };
  } else {
    const roll = Math.floor(Math.random() * 6) + 1;
    const isLow = roll <= 3;
    const won = (diceGuess === 'low' && isLow) || (diceGuess === 'high' && !isLow);
    const rangeLabel = isLow ? 'low' : 'high';
    const displayResult = `Rolled ${roll} (${rangeLabel})`;
    return {
      won,
      payout: won ? bet * 2 : 0,
      newCoins: won ? coins + bet : coins - bet,
      displayResult,
    };
  }
}

/**
 * Validates whether a bet is legal: >= 5, <= 50, and bet <= coins.
 */
export function isValidBet(coins: number, bet: number): boolean {
  return bet >= 5 && bet <= 50 && bet <= coins;
}
