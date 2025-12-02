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

describe('Debug Iteration 8 New Issue', () => {
  it('should analyze why finned-counts places star at [2,6] instead of [2,5]', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    // Apply hints up to iteration 7
    for (let i = 0; i < 8; i++) {
      applyHint(state);
    }

    console.log('\n=== ANALYZING COLUMN 7 AND REGION 2 ===\n');

    const col6 = colCells(state, 6); // Column 7 (0-indexed as 6)
    const col6Stars = countStars(state, col6);
    const col6Remaining = 2 - col6Stars;
    console.log(`Column 7: ${col6Stars} stars, ${col6Remaining} remaining`);

    const region2 = regionCells(state, 2);
    const region2Stars = countStars(state, region2);
    const region2Remaining = 2 - region2Stars;
    console.log(`Region 2: ${region2Stars} stars, ${region2Remaining} remaining`);

    const shape = intersection(col6, region2);
    const empties = emptyCells(state, shape);
    
    console.log(`\nIntersection of Column 7 and Region 2:`);
    console.log(`  All cells:`, shape.map(c => `[${c.row},${c.col}]`).join(', '));
    console.log(`  Empty cells:`, empties.map(c => `[${c.row},${c.col}]`).join(', '));
    
    const col6Empties = emptyCells(state, col6);
    const region2Empties = emptyCells(state, region2);
    const col6EmptiesOutside = col6Empties.length - empties.length;
    const region2EmptiesOutside = region2Empties.length - empties.length;
    
    console.log(`\nColumn 7 total empties: ${col6Empties.length}`);
    console.log(`Column 7 empties outside intersection: ${col6EmptiesOutside}`);
    console.log(`Column 7 must use intersection? ${col6EmptiesOutside < col6Remaining}`);
    
    console.log(`\nRegion 2 total empties: ${region2Empties.length}`);
    console.log(`Region 2 empties outside intersection: ${region2EmptiesOutside}`);
    console.log(`Region 2 must use intersection? ${region2EmptiesOutside < region2Remaining}`);

    console.log('\n\n--- EXPECTED SOLUTION ---');
    console.log('Column 7 (0-indexed col 6) should have stars at: [0,6] and [4,6]');
    console.log('Row 2 should have stars at: [2,3] and [2,5]');
    console.log('\nRegion 2 cells:');
    console.log('  Row 0: cols 6,7');
    console.log('  Row 1: cols 6,7');
    console.log('  Row 2: cols 5,6,7,8');
    console.log('  Row 3: cols 5,6,8');
    console.log('\nExpected stars in region 2: [0,6] and [2,5]');
    console.log('\nSo [2,6] is WRONG - it should be [2,5]!');
    
    console.log('\n\n--- ANALYZING THE FINNED PATTERN ---');
    const minStarsNeeded = Math.max(col6Remaining, region2Remaining);
    console.log(`Min stars needed: ${minStarsNeeded}`);
    console.log(`Is finned pattern (${minStarsNeeded} == ${empties.length} - 1)? ${minStarsNeeded === empties.length - 1}`);
    
    if (minStarsNeeded === empties.length - 1) {
      console.log('\nThis IS a finned pattern. The technique will pick a fin and force the rest.');
      console.log('But the problem is: which cells should actually have stars?');
      console.log('\nThe finned-counts technique cannot distinguish between [0,6]+[2,6] vs [0,6]+[4,6]');
      console.log('because both satisfy the counting constraints!');
      console.log('\nThis means finned-counts is making an ARBITRARY choice, which is WRONG.');
      console.log('The technique should only place stars when they are FORCED, not when there are multiple valid options.');
    }
  });
});
