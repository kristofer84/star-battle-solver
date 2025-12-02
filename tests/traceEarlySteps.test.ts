import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { regionCells, emptyCells } from '../src/logic/helpers';

describe('Trace Early Steps', () => {
  it('should trace the first few steps in detail', () => {
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

    console.log('\n=== Region 7 cells ===');
    const region7 = regionCells(state, 7);
    console.log(region7);
    console.log('Region 7 should have stars at (4,6) and (6,5) according to solution');

    console.log('\n=== Step-by-step trace ===\n');

    for (let step = 1; step <= 10; step++) {
      const hint = findNextHint(state);
      if (!hint) {
        console.log(`No more hints after step ${step - 1}`);
        break;
      }

      console.log(`Step ${step}: ${hint.technique} - ${hint.kind}`);
      console.log(`  Explanation: ${hint.explanation}`);
      console.log(`  Cells:`, hint.resultCells);

      // Check if this affects region 7
      const affectsRegion7 = hint.resultCells.some(cell => 
        regions[cell.row][cell.col] === 7
      );
      
      if (affectsRegion7) {
        console.log(`  ⚠️  This affects region 7!`);
        const region7Empty = emptyCells(state, region7);
        console.log(`  Region 7 empty cells before:`, region7Empty);
      }

      // Apply the hint
      for (const cell of hint.resultCells) {
        if (hint.kind === 'place-star') {
          state.cells[cell.row][cell.col] = 'star';
        } else if (hint.kind === 'place-cross') {
          state.cells[cell.row][cell.col] = 'cross';
        }
      }

      if (affectsRegion7) {
        const region7Empty = emptyCells(state, region7);
        console.log(`  Region 7 empty cells after:`, region7Empty);
      }

      console.log();
    }

    // Check region 7 status
    console.log('=== Region 7 final status ===');
    const region7Empty = emptyCells(state, region7);
    console.log('Empty cells:', region7Empty);
    
    const region7Stars = region7.filter(cell => state.cells[cell.row][cell.col] === 'star');
    console.log('Stars:', region7Stars);
  });
});
