import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleDef, createEmptyPuzzleState } from '../src/types/puzzle';
import { findExactFillHint } from '../src/logic/techniques/exactFill';

describe('exact-fill technique', () => {
  it('forces remaining empties in a row to stars when they exactly match remaining quota', () => {
    const def = createEmptyPuzzleDef();
    const state = createEmptyPuzzleState(def);

    // Row 0: place one star, leaving exactly one empty where a star must go.
    state.cells[0][0] = 'star';
    // Mark all but one other cell as crosses.
    for (let c = 1; c < def.size; c += 1) {
      if (c === 5) continue;
      state.cells[0][c] = 'cross';
    }

    const hint = findExactFillHint(state);
    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe('place-star');
    expect(hint?.resultCells).toEqual([{ row: 0, col: 5 }]);
  });

  it('can also act on columns', () => {
    const def = createEmptyPuzzleDef();
    const state = createEmptyPuzzleState(def);

    // Column 0: one star already, only one spot left that isn't a cross.
    state.cells[0][0] = 'star';
    for (let r = 1; r < def.size; r += 1) {
      if (r === 7) continue;
      state.cells[r][0] = 'cross';
    }

    const hint = findExactFillHint(state);
    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe('place-star');
    expect(hint?.resultCells).toEqual([{ row: 7, col: 0 }]);
  });
});


