import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSlotMachineRoundState,
  getSlotMachineStatusText,
  settleSlotMachineRound,
  startSlotMachineSpin,
  dismissSlotMachineResult,
} from '../src/games/slotMachineRoundState';

test('starts in a ready state and can spin', () => {
  const state = createSlotMachineRoundState();

  assert.equal(state.phase, 'ready');
  assert.equal(state.canSpin, true);
  assert.equal(state.canLeave, true);
  assert.equal(getSlotMachineStatusText(state), 'Choose wager and spin.');
});

test('settled round with coins remaining offers spin again and can reset to ready', () => {
  const spinning = startSlotMachineSpin(createSlotMachineRoundState());
  const settled = settleSlotMachineRound(spinning, { currentCoins: 75, net: 50 });

  assert.equal(settled.phase, 'result');
  assert.equal(settled.canSpin, false);
  assert.equal(settled.canLeave, true);
  assert.equal(settled.primaryAction, 'spin-again');
  assert.equal(getSlotMachineStatusText(settled), 'Spin again or leave the machine.');

  const reset = dismissSlotMachineResult(settled, 75);
  assert.equal(reset.phase, 'ready');
  assert.equal(reset.canSpin, true);
  assert.equal(reset.canLeave, true);
});

test('bust state blocks spin and surfaces exit guidance', () => {
  const spinning = startSlotMachineSpin(createSlotMachineRoundState());
  const busted = settleSlotMachineRound(spinning, { currentCoins: 0, net: -25 });

  assert.equal(busted.phase, 'bust');
  assert.equal(busted.canSpin, false);
  assert.equal(busted.canLeave, true);
  assert.equal(busted.primaryAction, 'leave');
  assert.equal(getSlotMachineStatusText(busted), 'Out of coins. Leave the machine.');
});
