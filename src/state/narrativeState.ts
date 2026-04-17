export type SupportReward =
  | { type: 'revive'; label: 'Revive Token' }
  | { type: 'discount'; label: '20% Floor Discount' };

let supportNpcSeenThisRun = false;

export function resetNarrativeRunState(): void {
  supportNpcSeenThisRun = false;
}

export function canSpawnSupportNpc(nextFloor: number): boolean {
  if (supportNpcSeenThisRun) return false;
  return nextFloor === 3 && Math.random() < 0.3;
}

export function markSupportNpcSeen(): void {
  supportNpcSeenThisRun = true;
}

export function rollSupportReward(): SupportReward {
  return Math.random() < 0.5
    ? { type: 'revive', label: 'Revive Token' }
    : { type: 'discount', label: '20% Floor Discount' };
}
