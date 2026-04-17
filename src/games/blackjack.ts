export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface HandValue {
  total: number;
  soft: boolean;
  blackjack: boolean;
  busted: boolean;
}

export interface RoundState {
  deck: Card[];
  player: Card[];
  dealer: Card[];
}

export interface RoundResult {
  outcome: 'win' | 'lose' | 'push';
  newCoins: number;
  payout: number;
  playerValue: HandValue;
  dealerValue: HandValue;
  displayText: string;
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }

  return deck;
}

export function shuffleDeck(cards: Card[]): Card[] {
  const deck = [...cards];

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export function startRound(): RoundState {
  const deck = shuffleDeck(createDeck());
  const player = [deck[0], deck[2]];
  const dealer = [deck[1], deck[3]];

  return {
    deck: deck.slice(4),
    player,
    dealer,
  };
}

export function drawCard(deck: Card[]): { card: Card; deck: Card[] } {
  const [card, ...rest] = deck;

  if (!card) {
    throw new Error('Cannot draw from an empty deck');
  }

  return { card, deck: rest };
}

export function evaluateHand(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      total += 11;
      aces += 1;
    } else if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return {
    total,
    soft: aces > 0,
    blackjack: cards.length === 2 && total === 21,
    busted: total > 21,
  };
}

export function dealerShouldHit(cards: Card[]): boolean {
  return evaluateHand(cards).total < 17;
}

export function settleRound(coins: number, bet: number, player: Card[], dealer: Card[]): RoundResult {
  const playerValue = evaluateHand(player);
  const dealerValue = evaluateHand(dealer);

  if (playerValue.blackjack && !dealerValue.blackjack) {
    return {
      outcome: 'win',
      newCoins: coins + bet,
      payout: bet * 2,
      playerValue,
      dealerValue,
      displayText: 'Blackjack! You win.',
    };
  }

  if (dealerValue.blackjack && !playerValue.blackjack) {
    return {
      outcome: 'lose',
      newCoins: coins - bet,
      payout: 0,
      playerValue,
      dealerValue,
      displayText: 'The House has blackjack.',
    };
  }

  if (playerValue.busted) {
    return {
      outcome: 'lose',
      newCoins: coins - bet,
      payout: 0,
      playerValue,
      dealerValue,
      displayText: 'Bust. The House takes the hand.',
    };
  }

  if (dealerValue.busted) {
    return {
      outcome: 'win',
      newCoins: coins + bet,
      payout: bet * 2,
      playerValue,
      dealerValue,
      displayText: 'Dealer busts. You win.',
    };
  }

  if (playerValue.total > dealerValue.total) {
    return {
      outcome: 'win',
      newCoins: coins + bet,
      payout: bet * 2,
      playerValue,
      dealerValue,
      displayText: 'You beat the dealer.',
    };
  }

  if (playerValue.total < dealerValue.total) {
    return {
      outcome: 'lose',
      newCoins: coins - bet,
      payout: 0,
      playerValue,
      dealerValue,
      displayText: 'The House wins the hand.',
    };
  }

  return {
    outcome: 'push',
    newCoins: coins,
    payout: bet,
    playerValue,
    dealerValue,
    displayText: 'Push. Nobody wins this hand.',
  };
}

export function isValidBet(coins: number, bet: number): boolean {
  return bet >= 5 && bet <= 50 && bet <= coins;
}
