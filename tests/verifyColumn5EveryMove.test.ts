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
  
  return { stars, crosses, empties, cellStates, starRows };
}

describe('Verify Column 5 After Every Move', () => {
  it('should never have all crosses in column 5', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    let iteration = 0;
    const maxIterations = 300;
    let column5IssueFound = false;
    let issueDetails: any = null;

    while (iteration < maxIterations) {
      const { applied, cellsChanged, hint } = applyHint(state);
      
      if (!applied || !hint) {
        break;
      }

      // Check column 5 after EVERY hint application
      const col5 = getColumn5State(state);
      const errors = validateState(state);
      
      // CRITICAL CHECK: Column 5 should NEVER have all crosses
      if (col5.crosses === 10) {
        column5IssueFound = true;
        issueDetails = {
          iteration,
          technique: hint.technique,
          kind: hint.kind,
          cellsChanged,
          col5State: col5,
          errors,
        };
        break;
      }
      
      // Also check if column 5 has too many crosses (more than 8 is suspicious)
      if (col5.crosses > 8) {
        console.warn(`Iteration ${iteration}: Column 5 has ${col5.crosses} crosses (suspicious)`);
      }
      
      // Validate state
      if (errors.length > 0) {
        console.error(`Iteration ${iteration}: Validation errors:`, errors);
      }

      iteration++;
    }

    // Final check
    const finalCol5 = getColumn5State(state);
    
    // Fail if we found the issue
    if (column5IssueFound && issueDetails) {
      console.error(`\n❌ COLUMN 5 BECAME ALL CROSSES AT ITERATION ${issueDetails.iteration}`);
      console.error(`Technique: ${issueDetails.technique} (${issueDetails.kind})`);
      console.error(`Cells changed:`, issueDetails.cellsChanged);
      console.error(`Column 5 state: ${issueDetails.col5State.cellStates}`);
      console.error(`Validation errors:`, issueDetails.errors);
      expect(column5IssueFound).toBe(false);
    }
    
    // Verify final state
    expect(finalCol5.stars).toBe(2);
    expect(finalCol5.starRows.sort()).toEqual([2, 6]);
  });
});
