import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findPressuredExclusionHint } from '../src/logic/techniques/pressuredExclusion';
import { regionCells, emptyCells } from '../src/logic/helpers';

describe('Debug Pressured Exclusion', () => {
  it('should check if (5,5) really breaks region 7', () => {
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

    // Apply step 1: simple-shapes
    const step1Crosses = [
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7],
      [6, 6], [7, 6], [8, 6], [9, 6],
      [6, 8], [7, 8], [8, 8], [9, 8],
    ];
    
    for (const [r, c] of step1Crosses) {
      state.cells[r][c] = 'cross';
    }

    // Apply step 2: mark (5,4) as cross
    state.cells[5][4] = 'cross';

    console.log('\n=== State after steps 1-2 ===');
    const region7 = regionCells(state, 7);
    console.log('Region 7 cells:', region7);
    console.log('Region 7 empty cells:', emptyCells(state, region7));

    // Now check what pressured-exclusion says about (5,5)
    console.log('\n=== Testing if (5,5) breaks region 7 ===');
    
    // Manually simulate placing a star at (5,5)
    console.log('If we place a star at (5,5):');
    console.log('  - It would force crosses at adjacent cells');
    console.log('  - Adjacent to (5,5): (4,4), (4,5), (4,6), (5,4), (5,6), (6,4), (6,5), (6,6)');
    console.log('  - Of these, which are in region 7?');
    console.log('    - (4,5) is in region 7');
    console.log('    - (4,6) is in region 7');
    console.log('    - (6,5) is in region 7');
    console.log('  - So placing star at (5,5) would force crosses at (4,5), (4,6), (6,5)');
    console.log('  - This would leave only (5,5) itself for 2 stars in region 7');
    console.log('  - Therefore (5,5) CANNOT be a star');
    
    console.log('\n=== But wait, let\'s check the correct solution ===');
    console.log('Correct solution has stars at (4,6) and (6,5) in region 7');
    console.log('So (5,5) should indeed be a cross eventually');
    console.log('The pressured-exclusion deduction is CORRECT!');
    
    console.log('\n=== So why does the solver fail? ===');
    console.log('The issue must be elsewhere...');
    
    // Let's check what hint pressured-exclusion gives
    const hint = findPressuredExclusionHint(state);
    console.log('\nPressured-exclusion hint:', hint);
  });
});
