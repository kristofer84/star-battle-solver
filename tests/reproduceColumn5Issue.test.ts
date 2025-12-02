import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
import { colCells, countStars, emptyCells } from '../src/logic/helpers';
import type { PuzzleState } from '../src/types/puzzle';

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

function applyHint(state: PuzzleState): boolean {
  const hint = findNextHint(state);
  if (!hint) return false;
  
  for (const cell of hint.resultCells) {
    const newValue = hint.kind === 'place-star' ? 'star' : 'cross';
    state.cells[cell.row][cell.col] = newValue;
  }
  
  return true;
}

function checkColumn5(state: PuzzleState): {
  stars: number;
  crosses: number;
  empties: number;
  allCrosses: boolean;
  starRows: number[];
} {
  const col = colCells(state, 4);
  const stars = countStars(state, col);
  const empties = emptyCells(state, col);
  const crosses = col.length - stars - empties.length;
  const starRows = col
    .map((c, idx) => ({ row: c.row, val: state.cells[c.row][c.col] }))
    .filter(c => c.val === 'star')
    .map(c => c.row);
  
  return {
    stars,
    crosses,
    empties: empties.length,
    allCrosses: crosses === 10,
    starRows,
  };
}

describe('Reproduce Column 5 All Crosses Issue', () => {
  it('should track when column 5 gets all crosses', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    let iteration = 0;
    const maxIterations = 200;

    while (iteration < maxIterations) {
      const hint = findNextHint(state);
      if (!hint) break;

      const col5Before = checkColumn5(state);
      const technique = hint.technique;
      const kind = hint.kind;
      
      // Apply hint
      applyHint(state);
      
      const col5After = checkColumn5(state);
      const errors = validateState(state);
      
      // Check if column 5 became all crosses
      if (col5After.allCrosses && !col5Before.allCrosses) {
        console.error(`\n❌ COLUMN 5 BECAME ALL CROSSES AT ITERATION ${iteration}`);
        console.error(`Technique: ${technique} (${kind})`);
        console.error(`Column 5 before: ${col5Before.stars} stars, ${col5Before.crosses} crosses, ${col5Before.empties} empty`);
        console.error(`Column 5 after:  ${col5After.stars} stars, ${col5After.crosses} crosses, ${col5After.empties} empty`);
        console.error(`Star rows before: ${col5Before.starRows}`);
        console.error(`Star rows after: ${col5After.starRows}`);
        console.error(`Validation errors:`, errors);
        
        // Check which cells were changed
        const col5Cells = colCells(state, 4);
        console.error(`\nColumn 5 cell states:`);
        for (let r = 0; r < 10; r++) {
          const val = state.cells[r][4];
          const marker = val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
          console.error(`  Row ${r}: ${marker}`);
        }
        
        // Expected: stars at rows 2 and 6
        console.error(`\nExpected: stars at rows 2 and 6`);
        console.error(`Actual: stars at rows ${col5After.starRows}`);
        
        expect(col5After.allCrosses).toBe(false);
      }
      
      // Also check if column 5 has wrong number of stars
      if (col5After.stars > 2) {
        console.error(`\n⚠️  Column 5 has ${col5After.stars} stars (should be 2)`);
        console.error(`Iteration: ${iteration}, Technique: ${technique}`);
        expect(col5After.stars).toBeLessThanOrEqual(2);
      }

      if (errors.length > 0) {
        console.error(`\nValidation error at iteration ${iteration}:`, errors);
        expect(errors).toEqual([]);
      }

      iteration++;
    }

    const finalCol5 = checkColumn5(state);
    console.log(`\nFinal column 5: ${finalCol5.stars} stars, ${finalCol5.crosses} crosses, ${finalCol5.empties} empty`);
    console.log(`Star rows: ${finalCol5.starRows}`);
    expect(finalCol5.stars).toBe(2);
    expect(finalCol5.starRows.sort()).toEqual([2, 6]);
  });
});
