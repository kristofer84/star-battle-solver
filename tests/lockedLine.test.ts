import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleDef, createEmptyPuzzleState } from '../src/types/puzzle';
import { TEST_REGIONS } from './testBoard';
import { findLockedLineHint } from '../src/logic/techniques/lockedLine';
import { findNextHint } from '../src/logic/techniques';

function cellKey(row: number, col: number) {
  return `${row},${col}`;
}

describe('Locked Row/Column technique', () => {
  it('marks all other cells in a row when a region is confined to that row', () => {
    const def = createEmptyPuzzleDef();
    def.regions = TEST_REGIONS;
    const state = createEmptyPuzzleState(def);

    // Constrain region 6 to row 8 by crossing out its row 9 cells
    state.cells[9][0] = 'cross';
    state.cells[9][1] = 'cross';
    state.cells[9][2] = 'cross';

    const hint = findLockedLineHint(state);
    expect(hint).not.toBeNull();
    expect(hint?.technique).toBe('locked-line');

    const expectedCrosses = new Set([
      cellKey(8, 0),
      cellKey(8, 1),
      cellKey(8, 5),
      cellKey(8, 6),
      cellKey(8, 7),
      cellKey(8, 8),
      cellKey(8, 9),
    ]);

    const actualCrosses = new Set(hint?.resultCells.map(c => cellKey(c.row, c.col)) ?? []);
    expect(actualCrosses).toEqual(expectedCrosses);
  });

  it('appears early in the technique chain', () => {
    const def = createEmptyPuzzleDef();
    def.regions = TEST_REGIONS;
    const state = createEmptyPuzzleState(def);

    state.cells[9][0] = 'cross';
    state.cells[9][1] = 'cross';
    state.cells[9][2] = 'cross';

    const hint = findNextHint(state);
    expect(hint?.technique).toBe('locked-line');
  });
});
