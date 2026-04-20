export type SlotMachineRoundPhase = 'ready' | 'spinning' | 'result' | 'bust';

export type SlotMachinePrimaryAction = 'spin' | 'spin-again' | 'leave';

export interface SlotMachineRoundState {
  phase: SlotMachineRoundPhase;
  canSpin: boolean;
  canLeave: boolean;
  primaryAction: SlotMachinePrimaryAction;
}

export function createSlotMachineRoundState(): SlotMachineRoundState {
  return {
    phase: 'ready',
    canSpin: true,
    canLeave: true,
    primaryAction: 'spin',
  };
}

export function startSlotMachineSpin(_: SlotMachineRoundState): SlotMachineRoundState {
  return {
    phase: 'spinning',
    canSpin: false,
    canLeave: false,
    primaryAction: 'spin',
  };
}

export function settleSlotMachineRound(
  _: SlotMachineRoundState,
  outcome: { currentCoins: number; net: number },
): SlotMachineRoundState {
  if (outcome.currentCoins <= 0) {
    return {
      phase: 'bust',
      canSpin: false,
      canLeave: true,
      primaryAction: 'leave',
    };
  }

  return {
    phase: 'result',
    canSpin: false,
    canLeave: true,
    primaryAction: 'spin-again',
  };
}

export function dismissSlotMachineResult(
  _: SlotMachineRoundState,
  currentCoins: number,
): SlotMachineRoundState {
  if (currentCoins <= 0) {
    return {
      phase: 'bust',
      canSpin: false,
      canLeave: true,
      primaryAction: 'leave',
    };
  }

  return createSlotMachineRoundState();
}

export function getSlotMachineStatusText(state: SlotMachineRoundState): string {
  switch (state.phase) {
    case 'spinning':
      return 'Reels spinning...';
    case 'result':
      return 'Spin again or leave the machine.';
    case 'bust':
      return 'Out of coins. Leave the machine.';
    case 'ready':
    default:
      return 'Choose wager and spin.';
  }
}
