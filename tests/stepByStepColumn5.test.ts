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

function applyHint(state: PuzzleState): { applied: boolean; cellsChanged: [number, number, string][] } {
  const hint = findNextHint(state);
  if (!hint) {
    return { applied: false, cellsChanged: [] };
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
  
  return { applied: true, cellsChanged };
}

function getColumn5State(state: PuzzleState): {
  stars: number;
  crosses: number;
  empties: number;
  cellStates: string;
  starPositions: number[];
} {
  const col = colCells(state, 4); // Column 5 is 0-indexed column 4
  const stars = countStars(state, col);
  const empties = emptyCells(state, col);
  const crosses = col.length - stars - empties.length;
  
  const cellStates = col.map(c => {
    const val = state.cells[c.row][c.col];
    return val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
  }).join('');
  
  const starPositions = col
    .map((c, idx) => ({ row: c.row, idx, val: state.cells[c.row][c.col] }))
    .filter(c => c.val === 'star')
    .map(c => c.row);
  
  return { stars, crosses, empties: empties.length, cellStates, starPositions };
}

describe('Step-by-step Column 5 Verification', () => {
  it('should verify column 5 after each hint', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const maxIterations = 300;
    let iteration = 0;
    const column5History: Array<{
      iteration: number;
      technique: string;
      kind: string;
      col5Before: ReturnType<typeof getColumn5State>;
      col5After: ReturnType<typeof getColumn5State>;
      cellsChangedInCol5: [number, number, string][];
    }> = [];

    while (iteration < maxIterations) {
      const hint = findNextHint(state);
      if (!hint) {
        console.log(`No more hints at iteration ${iteration}`);
        break;
      }

      const col5Before = getColumn5State(state);
      const { applied, cellsChanged } = applyHint(state);
      
      if (!applied || cellsChanged.length === 0) {
        break;
      }

      const col5After = getColumn5State(state);
      const cellsChangedInCol5 = cellsChanged.filter(([r, c]) => c === 4);
      
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
        
        console.log(`\nIteration ${iteration}: ${hint.technique} (${hint.kind})`);
        console.log(`  Column 5 before: ${col5Before.stars} stars, ${col5Before.crosses} crosses, ${col5Before.empties} empty | ${col5Before.cellStates}`);
        console.log(`  Column 5 after:  ${col5After.stars} stars, ${col5After.crosses} crosses, ${col5After.empties} empty | ${col5After.cellStates}`);
        if (cellsChangedInCol5.length > 0) {
          console.log(`  Changed in col 5:`, cellsChangedInCol5.map(([r, c, v]) => `(${r},${c})=${v}`));
        }
        
        // Check for problems
        if (col5After.crosses === 10) {
          console.error(`\n❌ COLUMN 5 HAS ALL CROSSES!`);
          console.error(`Iteration: ${iteration}`);
          console.error(`Technique: ${hint.technique} (${hint.kind})`);
          console.error(`Column 5 state: ${col5After.cellStates}`);
          console.error(`Stars in col 5: ${col5After.starPositions}`);
          console.error(`Expected stars at rows: [2, 6]`);
          
          // Check validation
          const errors = validateState(state);
          if (errors.length > 0) {
            console.error(`Validation errors:`, errors);
          }
          
          expect(col5After.crosses).not.toBe(10);
        }
        
        // Verify against expected solution
        const expectedStarsInCol5 = [2, 6]; // Rows 2 and 6 should have stars
        const actualStarsInCol5 = col5After.starPositions;
        
        // If we have stars, check they're correct
        if (col5After.stars > 0) {
          const wrongStars = actualStarsInCol5.filter(r => !expectedStarsInCol5.includes(r));
          if (wrongStars.length > 0) {
            console.error(`\n⚠️  Column 5 has stars at wrong rows: ${wrongStars} (expected [2, 6])`);
          }
        }
        
        // Validate
        const errors = validateState(state);
        if (errors.length > 0) {
          console.error(`Validation errors:`, errors);
          expect(errors).toEqual([]);
        }
      }

      iteration++;
    }

    // Final verification
    const finalCol5 = getColumn5State(state);
    console.log(`\n=== Final Column 5 State ===`);
    console.log(`Stars: ${finalCol5.stars} at rows ${finalCol5.starPositions}`);
    console.log(`Crosses: ${finalCol5.crosses}`);
    console.log(`Empty: ${finalCol5.empties}`);
    console.log(`State: ${finalCol5.cellStates}`);
    console.log(`Expected stars at rows: [2, 6]`);
    
    expect(finalCol5.stars).toBe(2);
    expect(finalCol5.starPositions.sort()).toEqual([2, 6]);
  });
});
