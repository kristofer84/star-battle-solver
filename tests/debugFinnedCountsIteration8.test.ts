import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { findFinnedCountsHint } from '../src/logic/techniques/finnedCounts';
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

function applyHint(state: PuzzleState) {
  const hint = findNextHint(state);
  if (!hint) return false;
  
  console.log(`Applying hint: ${hint.technique} (${hint.kind})`);
  console.log(`Cells:`, hint.resultCells.map(c => [c.row, c.col]));
  console.log(`Explanation: ${hint.explanation}`);
  
  for (const cell of hint.resultCells) {
    const value = hint.kind === 'place-star' ? 'star' : 'cross';
    state.cells[cell.row][cell.col] = value;
  }
  
  return true;
}

describe('Debug Finned Counts at Iteration 8', () => {
  it('should identify the bug in finned-counts that places star at [0,5] instead of [0,6]', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    // Apply hints up to iteration 7 (just before the bug)
    for (let i = 0; i < 8; i++) {
      const applied = applyHint(state);
      if (!applied) {
        console.log(`Stopped at iteration ${i}`);
        break;
      }
    }

    console.log('\n=== STATE BEFORE ITERATION 8 ===');
    console.log('Row 0 state:');
    for (let c = 0; c < 10; c++) {
      const val = state.cells[0][c];
      const region = EXAMPLE_REGIONS[0][c];
      console.log(`  Col ${c}: ${val === 'empty' ? 'empty' : val} (region ${region})`);
    }

    // Now check what finned-counts will do
    console.log('\n=== CHECKING FINNED-COUNTS HINT ===');
    const finnedHint = findFinnedCountsHint(state);
    
    if (finnedHint) {
      console.log('Finned-counts hint found:');
      console.log(`  Technique: ${finnedHint.technique}`);
      console.log(`  Kind: ${finnedHint.kind}`);
      console.log(`  Cells:`, finnedHint.resultCells.map(c => [c.row, c.col]));
      console.log(`  Explanation: ${finnedHint.explanation}`);
      
      // Check if any of the cells are in row 0
      const row0Cells = finnedHint.resultCells.filter(c => c.row === 0);
      if (row0Cells.length > 0) {
        console.log('\n⚠️  Finned-counts is placing stars in row 0:');
        row0Cells.forEach(c => {
          console.log(`    [0, ${c.col}] - Expected: [0, 3] or [0, 6]`);
          if (c.col === 5) {
            console.log(`    ❌ BUG: Placing star at [0, 5] instead of [0, 6]!`);
          }
        });
      }
      
      // The expected stars in row 0 are at columns 3 and 6
      const expectedRow0Stars = [3, 6];
      const actualRow0Stars = row0Cells.map(c => c.col);
      
      console.log('\n=== VERIFICATION ===');
      console.log(`Expected stars in row 0: columns ${expectedRow0Stars}`);
      console.log(`Actual stars being placed: columns ${actualRow0Stars}`);
      
      // Check if [0, 5] is being placed
      const hasBug = actualRow0Stars.includes(5);
      if (hasBug) {
        console.log('❌ BUG CONFIRMED: Star at [0, 5] is incorrect!');
        
        // Let's analyze why this is happening
        console.log('\n=== ANALYZING THE BUG ===');
        console.log('Row 0 analysis:');
        console.log('  Columns 0-2: region 10 (crosses already placed)');
        console.log('  Columns 3-5: region 1');
        console.log('  Columns 6-7: region 2');
        console.log('  Columns 8-9: region 3');
        
        console.log('\nThe finned-counts technique is likely analyzing:');
        console.log('  - Row 0 needs 2 stars');
        console.log('  - Some region needs stars');
        console.log('  - Their intersection has a finned pattern');
        console.log('\nBut it\'s incorrectly identifying which cells should have stars!');
      }
      
      expect(hasBug).toBe(false); // This will fail, confirming the bug
    } else {
      console.log('No finned-counts hint found at iteration 8');
    }
  });
});
