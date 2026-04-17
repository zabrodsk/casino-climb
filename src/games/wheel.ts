import { ActiveEffect } from '../state/coinState';

export interface WheelSegment {
  key: string;
  weight: number;
  coinDelta: number;
  effectType: 'buff' | 'curse' | 'revive' | null;
  effectMagnitude: number;
  label: string;
  color: number;
  flavor: string;
  // Computed after buildSegments()
  startDeg: number;
  arcDeg: number;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { key: 'JACKPOT',     weight:  5, coinDelta:  500, effectType: null,    effectMagnitude: 0,    label: 'JACKPOT', color: 0xffd700, flavor: 'The wheel sings your name.',         startDeg: 0, arcDeg: 0 },
  { key: 'WINDFALL',    weight: 10, coinDelta:  200, effectType: null,    effectMagnitude: 0,    label: '+200',    color: 0xf0a030, flavor: 'Fortune favors the bold.',           startDeg: 0, arcDeg: 0 },
  { key: 'REVIVE',      weight:  5, coinDelta:    0, effectType: 'revive', effectMagnitude: 0,   label: 'REVIVE',  color: 0x40e0d0, flavor: 'A second chance, sealed in fate.',   startDeg: 0, arcDeg: 0 },
  { key: 'LUCKY',       weight:  5, coinDelta:  100, effectType: null,    effectMagnitude: 0,    label: '+100',    color: 0x66cc66, flavor: 'Luck was always on your side.',      startDeg: 0, arcDeg: 0 },
  { key: 'GOLDEN_HAND', weight:  5, coinDelta:    0, effectType: 'buff',  effectMagnitude: 0.25, label: 'BUFF',    color: 0xffe066, flavor: 'Your hands are gilded.',              startDeg: 0, arcDeg: 0 },
  { key: 'TAILWIND',    weight: 15, coinDelta:   50, effectType: null,    effectMagnitude: 0,    label: '+50',     color: 0x7ab87a, flavor: 'A gentle push forward.',             startDeg: 0, arcDeg: 0 },
  { key: 'NEUTRAL',     weight:  5, coinDelta:   10, effectType: null,    effectMagnitude: 0,    label: '+10',     color: 0x999999, flavor: 'The wheel watches. Waiting.',        startDeg: 0, arcDeg: 0 },
  { key: 'MIXED_OMEN',  weight: 15, coinDelta:   30, effectType: 'curse', effectMagnitude: 0.25, label: 'MIXED',   color: 0x9955cc, flavor: 'Coins now. Pain later.',             startDeg: 0, arcDeg: 0 },
  { key: 'PENALTY',     weight: 10, coinDelta:  -80, effectType: null,    effectMagnitude: 0,    label: '-80',     color: 0xee5533, flavor: 'The house remembers.',               startDeg: 0, arcDeg: 0 },
  { key: 'HEAVY_LOSS',  weight: 10, coinDelta: -150, effectType: null,    effectMagnitude: 0,    label: '-150',    color: 0xcc2222, flavor: 'Fate is not your friend today.',     startDeg: 0, arcDeg: 0 },
  { key: 'HEXED',       weight: 10, coinDelta:    0, effectType: 'curse', effectMagnitude: 0.25, label: 'CURSE',   color: 0x771111, flavor: 'Something follows you now.',         startDeg: 0, arcDeg: 0 },
  { key: 'RUINOUS',     weight:  5, coinDelta: -250, effectType: null,    effectMagnitude: 0,    label: '-250',    color: 0x440000, flavor: 'You should have walked away.',       startDeg: 0, arcDeg: 0 },
];

// Compute startDeg / arcDeg for each segment (clockwise from top = 0°)
(function buildSegments() {
  const total = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  let cum = 0;
  for (const seg of WHEEL_SEGMENTS) {
    seg.startDeg = (cum / total) * 360;
    seg.arcDeg   = (seg.weight / total) * 360;
    cum += seg.weight;
  }
})();

export function spinWheel(): WheelSegment {
  const total = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  let r = Math.random() * total;
  for (const seg of WHEEL_SEGMENTS) {
    r -= seg.weight;
    if (r <= 0) return seg;
  }
  return WHEEL_SEGMENTS[WHEEL_SEGMENTS.length - 1];
}

export function segmentToEffect(seg: WheelSegment): ActiveEffect {
  if (seg.effectType === 'buff') return { type: 'buff', magnitude: seg.effectMagnitude };
  if (seg.effectType === 'curse') return { type: 'curse', magnitude: seg.effectMagnitude };
  return null;
}
