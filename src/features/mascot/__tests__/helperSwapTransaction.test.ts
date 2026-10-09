import type { GameState } from '@/core/engine';

import { swapUndoOutcome } from '../components/HelperSwap';

const snapshot = { score: 1 } as GameState;
const postSwap = { score: 2 } as GameState;

describe('HelperSwap undo transaction', () => {
  it('keeps a real undo free while the post-swap game is untouched', () => {
    expect(swapUndoOutcome(true, snapshot, postSwap, postSwap)).toBe('undo');
  });

  it('commits helper usage when a later move made the undo stale', () => {
    const afterMove = { score: 3 } as GameState;
    expect(swapUndoOutcome(true, snapshot, postSwap, afterMove)).toBe('commit');
  });

  it('makes rapid duplicate undo taps no-ops after the first settlement', () => {
    expect(swapUndoOutcome(false, snapshot, postSwap, postSwap)).toBe('noop');
    expect(swapUndoOutcome(true, null, postSwap, postSwap)).toBe('noop');
  });
});
