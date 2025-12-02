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

const EXPECTED_STARS: [number, number][] = [
  [0, 3], [0, 6],
  [1, 1], [1, 8],
  [2, 3], [2, 5],
  [3, 0], [3, 9],
  [4, 4], [4, 6],
  [5, 2], [5, 8],
  [6, 0], [6, 5],
  [7, 2], [7, 7],
  [8, 4], [8, 9],
  [9, 1], [9, 7],
];

function applyHint(state: PuzzleState): { applied: boolean; cellsChanged: [number, number, string][]; hint: any } {
  const hint = findNextHint(state);
  if (!hint) {
    return { applied: false, cellsChanged: [], hint: null };
  }
  
  const cellsChanged: [number, number, string][] = [];
  for (const cell of hint.resultCells) {
    const oldValue = state.cells[cell.row][cell.col];
    const newValue = hint.kind === 'place-star' ? 'star' : 'cross';
    if (oldValue !== newValue) {
      state.cells[cell.row][cell.col] = newValue;
      cellsChanged.push([cell.row, cell.col, newValue]);
    }
  }
  
  return { applied: true, cellsChanged, hint };
}

function getColumn5State(state: PuzzleState): {
  stars: number;
  crosses: number;
  empties: number;
  cellStates: string;
  starRows: number[];
  crossRows: number[];
} {
  const col = colCells(state, 4);
  const stars = countStars(state, col);
  const empties = emptyCells(state, col);
  const crosses = col.length - stars - empties.length;
  
  const cellStates = col.map(c => {
    const val = state.cells[c.row][c.col];
    return val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
  }).join('');
  
  const starRows = col
    .map((c, idx) => ({ row: c.row, val: state.cells[c.row][c.col] }))
    .filter(c => c.val === 'star')
    .map(c => c.row);
    
  const crossRows = col
    .map((c, idx) => ({ row: c.row, val: state.cells[c.row][c.col] }))
    .filter(c => c.val === 'cross')
    .map(c => c.row);
  
  return { stars, crosses, empties, cellStates, starRows, crossRows };
}

describe('Reproduce Column 5 Bug - Exact Scenario', () => {
  it('should never place crosses where stars should be in column 5', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    let iteration = 0;
    const maxIterations = 300;
    const column5History: Array<{
      iteration: number;
      technique: string;
      kind: string;
      col5Before: ReturnType<typeof getColumn5State>;
      col5After: ReturnType<typeof getColumn5State>;
      cellsChangedInCol5: [number, number, string][];
    }> = [];

    while (iteration < maxIterations) {
      const { applied, cellsChanged, hint } = applyHint(state);
      
      if (!applied || !hint) {
        break;
      }

      const col5Before = getColumn5State(state);
      const cellsChangedInCol5 = cellsChanged.filter(([r, c]) => c === 4);
      
      // Apply hint (already applied above)
      const col5After = getColumn5State(state);
      const errors = validateState(state);
      
      // Check if column 5 changed
      if (col5Before.cellStates !== col5After.cellStates || cellsChangedInCol5.length > 0) {
        column5History.push({
          iteration,
          technique: hint.technique,
          kind: hint.kind,
          col5Before,
          col5After,
          cellsChangedInCol5,
        });
        
        // CRITICAL CHECK: Column 5 should NEVER have crosses where stars should be
        // Expected stars in column 5: rows 2 and 6 (0-indexed)
        const expectedStarRows = [2, 6];
        
        for (const expectedRow of expectedStarRows) {
          if (state.cells[expectedRow][4] === 'cross') {
            console.error(`\n❌❌❌ BUG DETECTED AT ITERATION ${iteration} ❌❌❌`);
            console.error(`Column 5 row ${expectedRow} (should be star) is marked as CROSS!`);
            console.error(`Technique: ${hint.technique} (${hint.kind})`);
            console.error(`Cells changed:`, cellsChanged);
            console.error(`Cells changed in col 5:`, cellsChangedInCol5);
            console.error(`Column 5 before: ${col5Before.cellStates}`);
            console.error(`Column 5 after:  ${col5After.cellStates}`);
            console.error(`Column 5 crosses at rows: ${col5After.crossRows.join(', ')}`);
            console.error(`Expected stars at rows: ${expectedStarRows.join(', ')}`);
            console.error(`Validation errors:`, errors);
            
            // Print full column 5 state
            console.error(`\nColumn 5 detailed state:`);
            for (let r = 0; r < 10; r++) {
              const val = state.cells[r][4];
              const marker = val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
              const expected = expectedStarRows.includes(r) ? ' (SHOULD BE STAR!)' : '';
              console.error(`  Row ${r}: ${marker}${expected}`);
            }
            
            // Print hint explanation
            console.error(`\nHint explanation: ${hint.explanation}`);
            
            expect(state.cells[expectedRow][4]).not.toBe('cross');
          }
        }
        
        // Also check if column 5 has all crosses
        if (col5After.crosses === 10) {
          console.error(`\n❌❌❌ COLUMN 5 HAS ALL CROSSES AT ITERATION ${iteration}! ❌❌❌`);
          console.error(`Technique: ${hint.technique} (${hint.kind})`);
          console.error(`Column 5 state: ${col5After.cellStates}`);
          expect(col5After.crosses).not.toBe(10);
        }
        
        if (errors.length > 0) {
          console.error(`Validation errors at iteration ${iteration}:`, errors);
          expect(errors).toEqual([]);
        }
      }

      iteration++;
    }

    // Final verification
    const finalCol5 = getColumn5State(state);
    const expectedStarRows = [2, 6];
    
    console.log(`\n=== Final Column 5 State ===`);
    console.log(`Stars: ${finalCol5.stars} at rows ${finalCol5.starRows.join(', ')}`);
    console.log(`Crosses: ${finalCol5.crosses} at rows ${finalCol5.crossRows.join(', ')}`);
    console.log(`Expected stars at rows: ${expectedStarRows.join(', ')}`);
    
    // Verify no crosses where stars should be
    for (const expectedRow of expectedStarRows) {
      if (state.cells[expectedRow][4] === 'cross') {
        console.error(`\n❌ Final state: Column 5 row ${expectedRow} is cross but should be star!`);
        expect(state.cells[expectedRow][4]).not.toBe('cross');
      }
    }
    
    expect(finalCol5.stars).toBe(2);
    expect(finalCol5.starRows.sort()).toEqual([2, 6]);
  });
});
