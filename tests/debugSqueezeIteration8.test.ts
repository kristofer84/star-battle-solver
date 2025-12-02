import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { findSqueezeHint } from '../src/logic/techniques/squeeze';
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

describe('Debug Squeeze at Iteration 8', () => {
  it('should analyze why squeeze places wrong stars at [4,1] and [4,3]', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    // Apply hints up to iteration 7
    for (let i = 0; i < 8; i++) {
      applyHint(state);
    }

    console.log('\n=== STATE BEFORE ITERATION 8 ===');
    console.log('Row 5 (0-indexed row 4) state:');
    for (let c = 0; c < 10; c++) {
      const val = state.cells[4][c];
      const region = EXAMPLE_REGIONS[4][c];
      console.log(`  Col ${c}: ${val === 'empty' ? 'empty' : val} (region ${region})`);
    }

    console.log('\n=== CHECKING SQUEEZE HINT ===');
    const squeezeHint = findSqueezeHint(state);
    
    if (squeezeHint) {
      console.log('Squeeze hint found:');
      console.log(`  Technique: ${squeezeHint.technique}`);
      console.log(`  Kind: ${squeezeHint.kind}`);
      console.log(`  Cells:`, squeezeHint.resultCells.map(c => `[${c.row},${c.col}]`));
      console.log(`  Explanation: ${squeezeHint.explanation}`);
      
      // Analyze what squeeze is looking at
      console.log('\n=== ANALYZING SQUEEZE LOGIC ===');
      
      // Check row 5 (0-indexed row 4)
      const row4 = rowCells(state, 4);
      const row4Stars = countStars(state, row4);
      const row4Empties = emptyCells(state, row4);
      console.log(`\nRow 5: ${row4Stars} stars, ${row4Empties.length} empties`);
      console.log(`  Empty cells:`, row4Empties.map(c => `[${c.row},${c.col}]`).join(', '));
      
      // Check which regions intersect with row 4
      for (let regionId = 1; regionId <= 10; regionId++) {
        const region = regionCells(state, regionId);
        const regionStars = countStars(state, region);
        const regionEmpties = emptyCells(state, region);
        
        const shape = intersection(row4, region);
        if (shape.length === 0) continue;
        
        const shapeEmpties = emptyCells(state, shape);
        if (shapeEmpties.length === 0) continue;
        
        console.log(`\n  Row 5 ∩ Region ${regionId}:`);
        console.log(`    Region ${regionId}: ${regionStars} stars, ${regionEmpties.length} empties`);
        console.log(`    Intersection empties:`, shapeEmpties.map(c => `[${c.row},${c.col}]`).join(', '));
        console.log(`    Stars needed: max(${2 - row4Stars}, ${2 - regionStars}) = ${Math.max(2 - row4Stars, 2 - regionStars)}`);
      }
      
      console.log('\n=== EXPECTED SOLUTION ===');
      console.log('Row 5 should have stars at: [4,4] and [4,6]');
      console.log('But squeeze is placing stars at: [4,1] and [4,3]');
      console.log('\nRegion analysis:');
      console.log('  [4,1] is in region 10');
      console.log('  [4,3] is in region 10');
      console.log('  [4,4] is in region 1');
      console.log('  [4,6] is in region 7');
      
      console.log('\nThe problem: Squeeze is analyzing Row 5 ∩ Region 10');
      console.log('and finding that there are 2 valid placements for 2 needed stars.');
      console.log('But it doesn\'t verify that these are the CORRECT placements!');
    } else {
      console.log('No squeeze hint found at iteration 8');
    }
  });
});
