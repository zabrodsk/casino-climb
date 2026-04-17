// Coin state singleton — pure TS, no Phaser dependencies

export interface CoinState {
  coins: number;
  floor: number;
}

export interface RunStats {
  runCount: number;
  highestFloor: number;
  totalCoins: number;
}

// Initialize localStorage runCount on first load
const RUN_COUNT_KEY = 'runCount';
const HIGHEST_FLOOR_KEY = 'highestFloor';
const TOTAL_COINS_KEY = 'totalCoins';
if (typeof localStorage !== 'undefined' && localStorage.getItem(RUN_COUNT_KEY) === null) {
  localStorage.setItem(RUN_COUNT_KEY, '0');
}
if (typeof localStorage !== 'undefined' && localStorage.getItem(HIGHEST_FLOOR_KEY) === null) {
  localStorage.setItem(HIGHEST_FLOOR_KEY, '1');
}
if (typeof localStorage !== 'undefined' && localStorage.getItem(TOTAL_COINS_KEY) === null) {
  localStorage.setItem(TOTAL_COINS_KEY, '0');
}

let _state: CoinState = {
  coins: 200,
  floor: 1,
};

export type ActiveEffect = { type: 'buff' | 'curse'; magnitude: number } | null;

let _reviveToken = false;
let _activeEffect: ActiveEffect = null;
let _discountFloor: number | null = null;
let _discountRate = 0;

export function hasReviveToken(): boolean { return _reviveToken; }
export function grantReviveToken(): void { _reviveToken = true; }
export function consumeReviveToken(): void { _reviveToken = false; }
export function getActiveEffect(): ActiveEffect { return _activeEffect; }
export function setActiveEffect(e: ActiveEffect): void { _activeEffect = e; }
export function clearActiveEffect(): void { _activeEffect = null; }
export function clearRunModifiers(): void {
  _reviveToken = false;
  _activeEffect = null;
  _discountFloor = null;
  _discountRate = 0;
}

export function grantNextFloorDiscount(floor: number, rate = 0.2): void {
  _discountFloor = floor;
  _discountRate = rate;
}

export function hasDiscountForFloor(floor: number): boolean {
  return _discountFloor === floor && _discountRate > 0;
}

export function getDiscountedBetAmount(bet: number, floor: number): number {
  if (!hasDiscountForFloor(floor)) return bet;
  return Math.max(1, Math.round(bet * (1 - _discountRate)));
}

export function getCoins(): number {
  return _state.coins;
}

export function getFloor(): number {
  return _state.floor;
}

export function setCoins(n: number): void {
  _state.coins = n;
}

export function setFloor(n: number): void {
  _state.floor = n;
  recordHighestFloor(n);
  if (_discountFloor !== null && n > _discountFloor) {
    _discountFloor = null;
    _discountRate = 0;
  }
}

export function addCoins(delta: number): void {
  _state.coins += delta;
}

export function getRunStats(): RunStats {
  if (typeof localStorage === 'undefined') {
    return { runCount: 0, highestFloor: 1, totalCoins: 0 };
  }

  return {
    runCount: parseInt(localStorage.getItem(RUN_COUNT_KEY) ?? '0', 10),
    highestFloor: parseInt(localStorage.getItem(HIGHEST_FLOOR_KEY) ?? '1', 10),
    totalCoins: parseInt(localStorage.getItem(TOTAL_COINS_KEY) ?? '0', 10),
  };
}

export function recordHighestFloor(floor: number): void {
  if (typeof localStorage === 'undefined') return;
  const current = parseInt(localStorage.getItem(HIGHEST_FLOOR_KEY) ?? '1', 10);
  if (floor > current) {
    localStorage.setItem(HIGHEST_FLOOR_KEY, String(floor));
  }
}

export function addToTotalCoins(amount: number): void {
  if (typeof localStorage === 'undefined' || amount <= 0) return;
  const current = parseInt(localStorage.getItem(TOTAL_COINS_KEY) ?? '0', 10);
  localStorage.setItem(TOTAL_COINS_KEY, String(current + amount));
}

export function incrementRunCount(): void {
  if (typeof localStorage === 'undefined') return;
  const current = parseInt(localStorage.getItem(RUN_COUNT_KEY) ?? '0', 10);
  localStorage.setItem(RUN_COUNT_KEY, String(current + 1));
}

export function resetRun(options?: { keepCoins?: boolean }): void {
  if (!options?.keepCoins) {
    _state.coins = 200;
  }
  _state.floor = 1;
  clearRunModifiers();
  incrementRunCount();
}

export function getState(): CoinState {
  return { ..._state };
}
