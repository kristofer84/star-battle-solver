import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findAdjacentExclusionHint } from '../src/logic/techniques/adjacentExclusion';

describe('User Scenario Debug', () => {
  it('should find {8,1} as cross when region 7 needs stars', () => {
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

    // Mark all cells as cross first
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        state.cells[r][c] = 'cross';
      }
    }

    // Mark region 7 cells as empty: {7,0}, {8,0}, {8,2}, {9,0}, {9,1}, {9,2}
    state.cells[7][0] = 'empty'; // {7,0} - region 7
    state.cells[8][0] = 'empty'; // {8,0} - region 7
    state.cells[8][2] = 'empty'; // {8,2} - region 7
    state.cells[9][0] = 'empty'; // {9,0} - region 7
    state.cells[9][1] = 'empty'; // {9,1} - region 7
    state.cells[9][2] = 'empty'; // {9,2} - region 7
    
    // Mark {8,1} as empty - this should be detected as needing a cross
    // {8,1} is in region 6, not region 7
    state.cells[8][1] = 'empty';

    console.log('\n=== Region 7 cells ===');
    const region7Cells = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (regions[r][c] === 7) {
          region7Cells.push({ row: r, col: c });
          console.log(`  {${r},${c}} - state: ${state.cells[r][c]}`);
        }
      }
    }

    console.log('\n=== {8,1} neighbors ===');
    const testCell = { row: 8, col: 1 };
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = testCell.row + dr;
        const nc = testCell.col + dc;
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
          neighbors.push({ row: nr, col: nc });
          console.log(`  {${nr},${nc}} - region: ${regions[nr][nc]}, state: ${state.cells[nr][nc]}`);
        }
      }
    }

    const hint = findAdjacentExclusionHint(state);
    
    console.log('\n=== Hint result ===');
    console.log('Hint:', hint);
    if (hint) {
      console.log('Result cells:', hint.resultCells);
      console.log('Explanation:', hint.explanation);
    }

    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.technique).toBe('adjacent-exclusion');
    
    const has81 = hint?.resultCells.some(c => c.row === 8 && c.col === 1);
    expect(has81).toBe(true);
  });
});
