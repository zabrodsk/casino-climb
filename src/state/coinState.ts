// Coin state singleton — pure TS, no Phaser dependencies

export interface CoinState {
  coins: number;
  floor: number;
}

// Initialize localStorage runCount on first load
const RUN_COUNT_KEY = 'runCount';
if (typeof localStorage !== 'undefined' && localStorage.getItem(RUN_COUNT_KEY) === null) {
  localStorage.setItem(RUN_COUNT_KEY, '0');
}

let _state: CoinState = {
  coins: 200,
  floor: 1,
};

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
}

export function addCoins(delta: number): void {
  _state.coins += delta;
}

export function resetRun(): void {
  _state.coins = 200;
  _state.floor = 1;
  if (typeof localStorage !== 'undefined') {
    const current = parseInt(localStorage.getItem(RUN_COUNT_KEY) ?? '0', 10);
    localStorage.setItem(RUN_COUNT_KEY, String(current + 1));
  }
}

export function getState(): CoinState {
  return { ..._state };
}
