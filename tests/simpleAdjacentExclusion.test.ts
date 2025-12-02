import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findAdjacentExclusionHint } from '../src/logic/techniques/adjacentExclusion';

describe('Simple Adjacent Exclusion Test', () => {
  it('should find {8,1} as cross', () => {
    const regions = [
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      [0, 2, 2, 2, 2, 2, 1, 1, 1, 1],
      [2, 2, 3, 4, 4, 4, 1, 1, 5, 5],
      [2, 2, 3, 4, 4, 4, 5, 5, 5, 5],
      [2, 6, 3, 3, 3, 4, 4, 4, 5, 5],
      [7, 6, 3, 3, 3, 3, 3, 4, 5, 9],
      [7, 6, 6, 6, 3, 4, 4, 4, 5, 9],
      [7, 6, 6, 6, 3, 3, 3, 4, 8, 9],
      [7, 6, 7, 6, 8, 8, 8, 8, 8, 9],
      [7, 7, 7, 8, 8, 9, 9, 9, 9, 9],
    ];

    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Mark all as cross
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        state.cells[r][c] = 'cross';
      }
    }

    // Only mark region 7 cells that are NOT {8,0} or {8,2} as empty
    // This ensures {8,1} is checked
    state.cells[9][0] = 'empty'; // {9,0} - region 7
    state.cells[9][1] = 'empty'; // {9,1} - region 7  
    state.cells[9][2] = 'empty'; // {9,2} - region 7
    state.cells[8][1] = 'empty'; // {8,1} - region 6, should be excluded

    // Region 7 now has only 3 empty cells: {9,0}, {9,1}, {9,2}
    // All are adjacent to {8,1}
    // Region 7 needs 2 stars, so at least 1 must be in these 3 cells
    // Therefore {8,1} cannot be a star

    const hint = findAdjacentExclusionHint(state);
    
    console.log('Hint:', JSON.stringify(hint, null, 2));
    
    expect(hint).not.toBeNull();
    expect(hint?.resultCells).toContainEqual({ row: 8, col: 1 });
  });
});
