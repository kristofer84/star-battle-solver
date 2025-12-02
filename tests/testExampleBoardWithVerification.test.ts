import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
import type { PuzzleState } from '../src/types/puzzle';

// Example board from example.md
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

// Expected solution from example.md
// Row 0: stars at positions 3, 6
// Row 1: stars at positions 1, 8
// Row 2: stars at positions 3, 5
// Row 3: stars at positions 0, 9
// Row 4: stars at positions 4, 6
// Row 5: stars at positions 2, 8
// Row 6: stars at positions 0, 5
// Row 7: stars at positions 2, 7
// Row 8: stars at positions 4, 9
// Row 9: stars at positions 1, 7
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

function getBoardState(state: PuzzleState): { stars: [number, number][]; crosses: [number, number][] } {
  const stars: [number, number][] = [];
  const crosses: [number, number][] = [];
  
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (state.cells[r][c] === 'star') {
        stars.push([r, c]);
      } else if (state.cells[r][c] === 'cross') {
        crosses.push([r, c]);
      }
    }
  }
  
  return { stars, crosses };
}

function verifyColumn5(state: PuzzleState, iteration: number): { isValid: boolean; message: string } {
  // Column 5 is 0-indexed column 4
  const col5Cells: Array<{ row: number; state: string }> = [];
  for (let r = 0; r < 10; r++) {
    col5Cells.push({ row: r, state: state.cells[r][4] });
  }
  
  const starsInCol5 = col5Cells.filter(c => c.state === 'star').length;
  const crossesInCol5 = col5Cells.filter(c => c.state === 'cross').length;
  
  // Expected: Column 5 should have stars at rows 2 and 6 (0-indexed)
  const expectedStarsInCol5 = [[2, 4], [6, 4]];
  const actualStarsInCol5 = col5Cells
    .map((c, idx) => ({ row: idx, state: c.state }))
    .filter(c => c.state === 'star')
    .map(c => [c.row, 4] as [number, number]);
  
  // Check if column 5 has all crosses (which would be wrong)
  if (crossesInCol5 === 10) {
    return {
      isValid: false,
      message: `Column 5 (col 4) has ALL crosses at iteration ${iteration}! This is incorrect. Expected stars at rows 2 and 6.`,
    };
  }
  
  // Check if we have too many crosses in column 5
  if (crossesInCol5 > 8) {
    return {
      isValid: false,
      message: `Column 5 (col 4) has ${crossesInCol5} crosses at iteration ${iteration}, which seems excessive. Expected stars at rows 2 and 6.`,
    };
  }
  
  return { isValid: true, message: `Column 5: ${starsInCol5} stars, ${crossesInCol5} crosses` };
}

describe('Example Board Solver with Verification', () => {
  it('should solve the example board, verifying after each move', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const maxIterations = 500;
    let iteration = 0;
    const hintsApplied: Array<{
      iteration: number;
      technique: string;
      kind: string;
      cellsChanged: [number, number, string][];
      validationErrors: string[];
      col5Status: string;
    }> = [];

    // Apply hints until no more are found
    while (iteration < maxIterations) {
      const hint = findNextHint(state);
      if (!hint) {
        console.log(`No more hints found at iteration ${iteration}`);
        break;
      }

      // Apply the hint
      const { applied, cellsChanged } = applyHint(state);
      
      if (!applied || cellsChanged.length === 0) {
        console.log(`Hint at iteration ${iteration} did not change any cells`);
        break;
      }

      // Validate immediately after applying the hint
      const validationErrors = validateState(state);
      
      // Check column 5 specifically
      const col5Check = verifyColumn5(state, iteration);
      
      // Record this hint application
      hintsApplied.push({
        iteration,
        technique: hint.technique,
        kind: hint.kind,
        cellsChanged,
        validationErrors: [...validationErrors],
        col5Status: col5Check.message,
      });

      // Fail immediately if validation errors are found
      if (validationErrors.length > 0) {
        const boardState = getBoardState(state);
        console.error(`\n=== VALIDATION ERROR AT ITERATION ${iteration} ===`);
        console.error(`Technique: ${hint.technique}`);
        console.error(`Kind: ${hint.kind}`);
        console.error(`Cells changed:`, cellsChanged);
        console.error(`Validation errors:`, validationErrors);
        console.error(`Current stars (${boardState.stars.length}):`, boardState.stars);
        console.error(`Current crosses (${boardState.crosses.length}):`, boardState.crosses);
        console.error(`Column 5 status: ${col5Check.message}`);
        expect(validationErrors).toEqual([]);
      }

      // Check column 5 issue
      if (!col5Check.isValid) {
        const boardState = getBoardState(state);
        console.error(`\n=== COLUMN 5 ISSUE AT ITERATION ${iteration} ===`);
        console.error(`Technique: ${hint.technique}`);
        console.error(`Kind: ${hint.kind}`);
        console.error(`Cells changed:`, cellsChanged);
        console.error(`Column 5 status: ${col5Check.message}`);
        console.error(`Current stars (${boardState.stars.length}):`, boardState.stars);
        console.error(`Current crosses (${boardState.crosses.length}):`, boardState.crosses);
        
        // Print column 5 state
        console.error('\nColumn 5 (0-indexed col 4) state:');
        for (let r = 0; r < 10; r++) {
          const cellState = state.cells[r][4];
          const marker = cellState === 'star' ? 'S' : cellState === 'cross' ? '×' : '.';
          console.error(`  Row ${r}: ${marker}`);
        }
        
        expect(col5Check.isValid).toBe(true);
      }

      // Log progress every 10 iterations or when column 5 changes
      const col5Changed = cellsChanged.some(([r, c]) => c === 4);
      if (iteration % 10 === 0 || col5Changed) {
        const boardState = getBoardState(state);
        console.log(`Iteration ${iteration}: ${hint.technique} (${hint.kind}) - ${cellsChanged.length} cells - ${col5Check.message}`);
      }

      iteration++;
    }

    console.log(`\n=== SOLVER COMPLETED ===`);
    console.log(`Total hints applied: ${iteration}`);
    console.log(`Techniques used:`, [...new Set(hintsApplied.map(h => h.technique))]);
    
    const boardState = getBoardState(state);
    console.log(`Final stars: ${boardState.stars.length}`);
    console.log(`Final crosses: ${boardState.crosses.length}`);

    // Final verification
    const finalStars = boardState.stars;
    
    // Verify we have exactly 20 stars
    expect(finalStars.length).toBe(20);

    // Verify no validation errors in final state
    const finalValidationErrors = validateState(state);
    if (finalValidationErrors.length > 0) {
      console.error('Final validation errors:', finalValidationErrors);
      expect(finalValidationErrors).toEqual([]);
    }

    // Verify stars match expected positions
    const expectedSet = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));
    const actualSet = new Set(finalStars.map(([r, c]) => `${r},${c}`));

    const missing = EXPECTED_STARS.filter(([r, c]) => !actualSet.has(`${r},${c}`));
    const extra = finalStars.filter(([r, c]) => !expectedSet.has(`${r},${c}`));

    if (missing.length > 0 || extra.length > 0) {
      console.error('\n=== SOLUTION MISMATCH ===');
      console.error('Missing stars:', missing);
      console.error('Extra stars:', extra);
      console.error('Expected stars:', EXPECTED_STARS);
      console.error('Actual stars:', finalStars);
      
      // Print final board state
      console.error('\nFinal board state:');
      for (let r = 0; r < 10; r++) {
        let row = '';
        for (let c = 0; c < 10; c++) {
          if (state.cells[r][c] === 'star') {
            row += 'S ';
          } else if (state.cells[r][c] === 'cross') {
            row += '× ';
          } else {
            row += '. ';
          }
        }
        console.error(row.trim());
      }
    }

    expect(missing.length).toBe(0);
    expect(extra.length).toBe(0);
  });
});
