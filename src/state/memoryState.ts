const shownMemoryBeats = new Set<number>();

export function hasShownMemoryBeat(floor: number): boolean {
  return shownMemoryBeats.has(floor);
}

export function markMemoryBeatShown(floor: number): void {
  shownMemoryBeats.add(floor);
}

export function resetMemoryRunState(): void {
  shownMemoryBeats.clear();
}

