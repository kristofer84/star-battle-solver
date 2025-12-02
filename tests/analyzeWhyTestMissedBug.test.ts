import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
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

describe('Analyze Why Test Missed Bug', () => {
  it('should track finned-counts hints and their validation', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const finnedCountsHints: Array<{
      iteration: number;
      kind: string;
      cellsChanged: number;
      validationErrors: string[];
      explanation: string;
    }> = [];

    let iteration = 0;
    const maxIterations = 300;

    while (iteration < maxIterations) {
      const hint = findNextHint(state);
      if (!hint) break;

      const beforeValidation = validateState(state);
      const cellsBefore = hint.resultCells.map(c => state.cells[c.row][c.col]);
      
      applyHint(state);
      
      const afterValidation = validateState(state);
      const cellsAfter = hint.resultCells.map(c => state.cells[c.row][c.col]);
      
      // Track finned-counts hints specifically
      if (hint.technique === 'finned-counts') {
        finnedCountsHints.push({
          iteration,
          kind: hint.kind,
          cellsChanged: hint.resultCells.length,
          validationErrors: [...afterValidation],
          explanation: hint.explanation.substring(0, 150),
        });
        
        console.log(`\nIteration ${iteration}: finned-counts (${hint.kind})`);
        console.log(`  Cells changed: ${hint.resultCells.length}`);
        console.log(`  Cells before: ${cellsBefore.join(', ')}`);
        console.log(`  Cells after: ${cellsAfter.join(', ')}`);
        console.log(`  Validation errors: ${afterValidation.length > 0 ? afterValidation.join('; ') : 'none'}`);
        console.log(`  Explanation: ${hint.explanation.substring(0, 200)}`);
        
        // Check if this is the problematic overcounting pattern
        if (hint.kind === 'place-cross' && hint.explanation.includes('finned overcounting')) {
          const emptiesInExplanation = hint.explanation.match(/(\d+) remaining cells/)?.[1];
          if (emptiesInExplanation && parseInt(emptiesInExplanation) > 1) {
            console.error(`\n⚠️  POTENTIAL BUG: Overcounting pattern marking ${emptiesInExplanation} cells as crosses!`);
          }
        }
      }

      iteration++;
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total finned-counts hints: ${finnedCountsHints.length}`);
    console.log(`Place-star hints: ${finnedCountsHints.filter(h => h.kind === 'place-star').length}`);
    console.log(`Place-cross hints: ${finnedCountsHints.filter(h => h.kind === 'place-cross').length}`);
    
    finnedCountsHints.forEach((h, idx) => {
      console.log(`\nFinned-counts hint ${idx + 1} (iteration ${h.iteration}):`);
      console.log(`  Kind: ${h.kind}`);
      console.log(`  Cells changed: ${h.cellsChanged}`);
      console.log(`  Validation errors: ${h.validationErrors.length > 0 ? h.validationErrors.join('; ') : 'none'}`);
    });
    
    // The test should have caught this if finned-counts placed incorrect crosses
    // But validateState() only checks for rule violations, not logical correctness
    expect(finnedCountsHints.length).toBeGreaterThanOrEqual(0);
  });
});
