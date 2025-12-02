import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { rowCells, regionCells, emptyCells, countStars, intersection } from '../src/logic/helpers';

describe('Debug Step 8', () => {
  it('should analyze why undercounting places star at (0,8)', () => {
    const regions = [
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
      [4, 4, 0, 0, 1, 2, 2, 2, 2, 3],
      [4, 0, 0, 0, 1, 2, 2, 3, 2, 3],
      [4, 0, 5, 0, 1, 7, 7, 3, 3, 3],
      [4, 0, 5, 1, 1, 7, 3, 3, 9, 3],
      [4, 5, 5, 5, 1, 7, 3, 8, 9, 3],
      [4, 4, 5, 5, 5, 5, 5, 8, 9, 9],
      [4, 4, 6, 6, 6, 5, 5, 8, 9, 9],
      [6, 6, 6, 5, 5, 5, 5, 8, 9, 9],
    ];

    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Apply steps 1-7
    const crosses = [
      // Step 1
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7],
      [6, 6], [7, 6], [8, 6], [9, 6],
      [6, 8], [7, 8], [8, 8], [9, 8],
      // Step 2
      [5, 4],
      // Step 3
      [5, 5],
      // Step 4
      [3, 5],
      // Step 5
      [3, 6],
      // Step 6
      [5, 6],
      // Step 7
      [1, 5],
    ];
    
    for (const [r, c] of crosses) {
      state.cells[r][c] = 'cross';
    }

    console.log('\n=== State after steps 1-7 ===\n');

    // Check row 0 (row 1 in 1-indexed)
    const row0 = rowCells(state, 0);
    const row0Stars = countStars(state, row0);
    const row0Empties = emptyCells(state, row0);
    
    console.log('Row 0 (1-indexed: Row 1):');
    console.log(`  Stars: ${row0Stars}, Remaining: ${2 - row0Stars}`);
    console.log(`  Empty cells:`, row0Empties);

    // Check region 3
    const region3 = regionCells(state, 3);
    const region3Stars = countStars(state, region3);
    const region3Empties = emptyCells(state, region3);
    
    console.log('\nRegion 3:');
    console.log(`  Stars: ${region3Stars}, Remaining: ${2 - region3Stars}`);
    console.log(`  Empty cells:`, region3Empties);

    // Check intersection
    const intersect = intersection(row0, region3);
    const intersectEmpties = emptyCells(state, intersect);
    
    console.log('\nIntersection of Row 0 and Region 3:');
    console.log(`  All cells:`, intersect);
    console.log(`  Empty cells:`, intersectEmpties);
    console.log(`  Count: ${intersectEmpties.length}`);

    console.log('\n=== Analysis ===');
    console.log('Row 0 needs 2 stars, Region 3 needs 2 stars');
    console.log(`Their intersection has ${intersectEmpties.length} empty cells`);
    console.log('Undercounting says: if intersection has exactly N empty cells for N needed stars, all must be stars');
    console.log(`So it will place stars at: ${intersectEmpties.map(c => `(${c.row},${c.col})`).join(', ')}`);
    
    console.log('\n=== But the correct solution ===');
    console.log('Row 0 should have stars at (0,3) and (0,6)');
    console.log('Region 3 should have stars at (1,8) and (2,9)');
    console.log('So the intersection of Row 0 and Region 3 should have NO stars!');
    console.log('\n❌ The undercounting logic is WRONG here!');
    console.log('Just because Row 0 needs 2 stars and Region 3 needs 2 stars,');
    console.log('doesn\'t mean their intersection must have 2 stars.');
    console.log('Row 0 could get its stars from other regions!');
  });
});
