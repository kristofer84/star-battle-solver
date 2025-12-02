import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { rowCells, colCells, regionCells, countStars, emptyCells, intersection } from '../src/logic/helpers';
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

function applyHint(state: PuzzleState) {
  const hint = findNextHint(state);
  if (!hint) return false;
  
  for (const cell of hint.resultCells) {
    const value = hint.kind === 'place-star' ? 'star' : 'cross';
    state.cells[cell.row][cell.col] = value;
  }
  
  return true;
}

describe('Analyze Finned Counts Bug', () => {
  it('should analyze the exact state when finned-counts makes the wrong decision', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    // Apply hints up to iteration 7
    for (let i = 0; i < 8; i++) {
      applyHint(state);
    }

    console.log('\n=== ANALYZING STATE AT ITERATION 8 ===\n');

    // Analyze Row 0 and Row 1 with region 1
    for (let r = 0; r <= 1; r++) {
      console.log(`\n--- ROW ${r} ANALYSIS ---`);
      const row = rowCells(state, r);
      const rowStars = countStars(state, row);
      const rowRemaining = 2 - rowStars;
      console.log(`Row ${r}: ${rowStars} stars, ${rowRemaining} remaining`);
      
      const region = regionCells(state, 1);
      const regionStars = countStars(state, region);
      const regionRemaining = 2 - regionStars;
      console.log(`Region 1: ${regionStars} stars, ${regionRemaining} remaining`);
      
      const shape = intersection(row, region);
      const empties = emptyCells(state, shape);
      
      console.log(`Intersection of Row ${r} and Region 1:`);
      console.log(`  All cells:`, shape.map(c => `[${c.row},${c.col}]`).join(', '));
      console.log(`  Empty cells:`, empties.map(c => `[${c.row},${c.col}]`).join(', '));
      console.log(`  Empty count: ${empties.length}`);
      
      const minStarsNeeded = Math.max(rowRemaining, regionRemaining);
      console.log(`  Min stars needed: max(${rowRemaining}, ${regionRemaining}) = ${minStarsNeeded}`);
      console.log(`  Is finned pattern? ${minStarsNeeded === empties.length - 1 && empties.length >= 2}`);
      
      if (minStarsNeeded === empties.length - 1 && empties.length >= 2) {
        console.log(`\n  ✓ This is a finned pattern!`);
        console.log(`  If we pick each cell as a fin:`);
        
        for (let finIdx = 0; finIdx < empties.length; finIdx++) {
          const finCell = empties[finIdx];
          const nonFinCells = empties.filter((_, idx) => idx !== finIdx);
          const case2Needed = minStarsNeeded;
          
          console.log(`\n    Fin: [${finCell.row},${finCell.col}]`);
          console.log(`    Non-fin cells:`, nonFinCells.map(c => `[${c.row},${c.col}]`).join(', '));
          console.log(`    Case 2 (fin is cross): need ${case2Needed} stars in ${nonFinCells.length} cells`);
          console.log(`    Would force all non-fin cells? ${case2Needed === nonFinCells.length}`);
        }
      }
    }

    // Check what region 1 looks like
    console.log('\n\n--- REGION 1 FULL ANALYSIS ---');
    const region1 = regionCells(state, 1);
    console.log('All cells in region 1:');
    region1.forEach(c => {
      const val = state.cells[c.row][c.col];
      console.log(`  [${c.row},${c.col}]: ${val}`);
    });
    
    const region1Empties = emptyCells(state, region1);
    console.log(`\nEmpty cells in region 1: ${region1Empties.length}`);
    region1Empties.forEach(c => {
      console.log(`  [${c.row},${c.col}]`);
    });

    console.log('\n\n--- EXPECTED SOLUTION ---');
    console.log('Row 0 should have stars at: [0,3] and [0,6]');
    console.log('Row 1 should have stars at: [1,1] and [1,8]');
    console.log('\nRegion 1 cells:');
    console.log('  Row 0: cols 3,4,5');
    console.log('  Row 1: cols 3,4,5');
    console.log('  Row 2: col 4');
    console.log('  Row 3: col 4');
    console.log('  Row 4: col 4');
    console.log('  Row 5: cols 3,4');
    console.log('  Row 6: col 4');
    console.log('\nExpected stars in region 1: [0,3] and [5,3]');
  });
});
