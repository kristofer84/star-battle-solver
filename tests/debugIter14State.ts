import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { rowCells, countStars, emptyCells } from '../src/logic/helpers';

const EXAMPLE_REGIONS = [
  [10, 10, 10, 1, 1, 1, 2, 2, 3, 3],
  [10, 10, 10, 1, 1, 1, 2, 2, 3, 3],
  [4, 4, 10, 10, 1, 2, 2, 2, 2, 3],
  [4, 10, 10, 10, 1, 2, 2, 3, 2, 3],
  [4, 10, 5, 10, 1, 7, 7, 3, 3, 3],
  [4, 10, 5, 1, 1, 7, 3, 3, 9, 3],
  [4, 5, 5, 5, 1, 7, 3, 8, 9, 3],
  [4, 4, 5, 5, 5, 5, 5, 8, 9, 9],
  [4, 4, 6, 6, 6, 5, 5, 8, 9, 9],
  [6, 6, 6, 5, 5, 5, 5, 8, 9, 9],
];

describe('Debug Iteration 14 State', () => {
  it('should show the state before iteration 14', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    // Apply all hints up to iteration 13
    const hintsToApply = [
      [[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,6],[7,6],[8,6],[9,6],[6,8],[7,8],[8,8],[9,8]],
      [[6,5]],
      [[5,4],[5,5],[5,6],[6,4],[7,4],[7,5]],
      [[8,1],[9,3]],
      [[3,5],[3,6],[1,5]],
      [[0,0],[0,1],[0,2]],
      [[0,3]],
      [[0,4],[1,2],[1,3],[1,4]],
      [[5,3]], // Iter 12 - composite-shapes
      [[2,3],[3,3],[4,3],[6,3],[7,3],[8,3]],
    ];

    for (let i = 0; i < hintsToApply.length; i++) {
      const cells = hintsToApply[i];
      const isStar = i === 1 || i === 8 || i === 6; // iterations 1, 6, 8 place stars
      for (const [r, c] of cells) {
        state.cells[r][c] = isStar ? 'star' : 'cross';
      }
    }

    console.log('\n=== ROWS STATUS ===');
    for (let r = 0; r < 10; r++) {
      const row = rowCells(state, r);
      const stars = countStars(state, row);
      const empties = emptyCells(state, row);
      const status = stars === 2 ? 'SATURATED' : stars < 2 ? `NEEDS ${2 - stars}` : 'ERROR';
      console.log(`Row ${r}: ${stars} stars, ${empties.length} empties - ${status}`);
      if (stars === 2 && empties.length > 0) {
        console.log(`  ⚠️  Row ${r} is saturated but has empties:`, empties.map(c => `[${c.row},${c.col}]`).join(', '));
      }
      if (r === 4) {
        console.log(`  Row 4 cells:`, row.map(c => {
          const val = state.cells[c.row][c.col];
          return `[${c.row},${c.col}]=${val === 'star' ? 'S' : val === 'cross' ? '×' : '.'}`;
        }).join(' '));
      }
    }
    
    // Check which row would trigger trivial-marks
    console.log('\n=== CHECKING WHICH ROW TRIGGERS TRIVIAL-MARKS ===');
    for (let r = 0; r < 10; r++) {
      const row = rowCells(state, r);
      const stars = countStars(state, row);
      const empties = emptyCells(state, row);
      if (stars === 2 && empties.length > 0) {
        console.log(`Row ${r} is saturated with empties:`, empties.map(c => `[${c.row},${c.col}]`).join(', '));
      }
    }
  });
});
