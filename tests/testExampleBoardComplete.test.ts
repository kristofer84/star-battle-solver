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

describe('Example Board Complete Solver Test', () => {
  it('should solve the example board completely, validating after each hint', () => {
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
      
      // Verify against expected solution after each step
      const currentStars = getBoardState(state).stars;
      const expectedSet = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));
      const actualSet = new Set(currentStars.map(([r, c]) => `${r},${c}`));
      
      // Check for incorrect placements: cells marked as cross that should be stars
      const incorrectCrosses: [number, number][] = [];
      const incorrectStars: [number, number][] = [];
      
      for (const [r, c] of EXPECTED_STARS) {
        if (state.cells[r][c] === 'cross') {
          incorrectCrosses.push([r, c]);
        }
      }
      
      for (const [r, c] of currentStars) {
        if (!expectedSet.has(`${r},${c}`)) {
          incorrectStars.push([r, c]);
        }
      }
      
      // Record this hint application
      hintsApplied.push({
        iteration,
        technique: hint.technique,
        kind: hint.kind,
        cellsChanged,
        validationErrors: [...validationErrors],
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
        console.error(`\nAll hints applied so far:`);
        hintsApplied.forEach((h, idx) => {
          console.error(`  ${idx}: ${h.technique} (${h.kind}) - ${h.cellsChanged.length} cells`);
          if (h.validationErrors.length > 0) {
            console.error(`    ERRORS: ${h.validationErrors.join(', ')}`);
          }
        });
        
        expect(validationErrors).toEqual([]);
      }
      
      // Fail immediately if we've placed a cross where a star should be
      if (incorrectCrosses.length > 0) {
        const boardState = getBoardState(state);
        console.error(`\n=== SOLUTION MISMATCH AT ITERATION ${iteration} ===`);
        console.error(`Technique: ${hint.technique} (${hint.kind})`);
        console.error(`Cells changed by this hint:`, cellsChanged);
        console.error(`❌ Crosses placed where stars should be:`, incorrectCrosses);
        console.error(`❌ Stars placed in wrong positions:`, incorrectStars);
        console.error(`Current stars:`, currentStars);
        console.error(`Expected stars:`, EXPECTED_STARS);
        
        // Print board state
        console.error(`\nCurrent board state:`);
        for (let r = 0; r < 10; r++) {
          let row = '';
          for (let c = 0; c < 10; c++) {
            const val = state.cells[r][c];
            const expected = EXPECTED_STARS.some(([er, ec]) => er === r && ec === c);
            if (val === 'star') {
              row += expected ? 'S ' : 'S* '; // S* = wrong star
            } else if (val === 'cross') {
              row += expected ? '×! ' : '× '; // ×! = cross where star should be
            } else {
              row += expected ? '.? ' : '. '; // .? = empty where star should be
            }
          }
          console.error(row.trim());
        }
        
        console.error(`\nAll hints applied so far:`);
        hintsApplied.forEach((h, idx) => {
          console.error(`  ${idx}: ${h.technique} (${h.kind}) - ${h.cellsChanged.length} cells`);
        });
        
        expect(incorrectCrosses).toEqual([]);
      }
      
      // Also fail if we've placed stars in wrong positions
      if (incorrectStars.length > 0 && currentStars.length > 0) {
        // Only fail if we have stars placed (not just empty board)
        console.error(`\n⚠️  Stars in wrong positions at iteration ${iteration}:`, incorrectStars);
        // Don't fail immediately for wrong stars - they might be corrected later
        // But log them for debugging
      }

      iteration++;
    }

    console.log(`\n=== SOLVER COMPLETED ===`);
    console.log(`Total hints applied: ${iteration}`);
    console.log(`Techniques used:`, [...new Set(hintsApplied.map(h => h.technique))]);
    
    const boardState = getBoardState(state);
    console.log(`Final stars: ${boardState.stars.length}`);
    console.log(`Final crosses: ${boardState.crosses.length}`);

    // Check final state
    const finalStars = boardState.stars;
    
    // Verify we have exactly 20 stars (10 rows × 2 stars per row)
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
      
      // Print board state for debugging
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
