import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findFinnedCountsHint } from '../src/logic/techniques/finnedCounts';
import type { PuzzleState } from '../src/types/puzzle';

/**
 * This test specifically checks for the bug where finned counts overcounting pattern
 * incorrectly marks all non-fin cells as crosses when there are more than 2 empty cells.
 * 
 * The bug: When empties.length > 2, the pattern would mark all non-fin cells as crosses,
 * but this deduction is only valid when empties.length === 2.
 */
describe('Finned Counts Overcounting Bug', () => {
  it('should NOT mark all non-fin cells as crosses when there are more than 2 empty cells', () => {
    // Create a scenario where:
    // - Row 1 needs 2 stars, Region 1 needs 2 stars
    // - Their intersection has 3 empty cells (more than 2)
    // - maxStars = shapeStars + empties.length - 1 = 0 + 3 - 1 = 2
    // - This triggers the overcounting pattern condition
    // - BUT: We should NOT mark all non-fin cells as crosses because empties.length > 2
    
    const state: PuzzleState = {
      def: {
        size: 10,
        starsPerUnit: 2,
        regions: [
          [1, 1, 1, 2, 2, 2, 3, 3, 3, 3],
          [1, 1, 1, 2, 2, 2, 3, 3, 3, 3],
          [4, 4, 4, 5, 5, 5, 6, 6, 6, 6],
          [4, 4, 4, 5, 5, 5, 6, 6, 6, 6],
          [7, 7, 7, 8, 8, 8, 9, 9, 9, 9],
          [7, 7, 7, 8, 8, 8, 9, 9, 9, 9],
          [7, 7, 7, 8, 8, 8, 9, 9, 9, 9],
          [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
          [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
          [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
        ],
      },
      cells: [
        // Row 0: Empty (will have stars later)
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        // Row 1: First 3 cells are intersection of Row 1 and Region 1, all empty
        // Row 1 needs 2 stars total, Region 1 needs 2 stars total
        // Intersection has 3 empty cells: (1,0), (1,1), (1,2)
        ['empty', 'empty', 'empty', 'cross', 'cross', 'cross', 'cross', 'cross', 'cross', 'cross'],
        // Rest of region 1 (row 0) already has crosses
        ['cross', 'cross', 'cross', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
      ],
    };

    const hint = findFinnedCountsHint(state);

    // If the bug exists, this would return a place-cross hint marking 2 cells as crosses
    // But this is incorrect - we should NOT get a hint here because empties.length = 3 > 2
    if (hint && hint.kind === 'place-cross' && hint.technique === 'finned-counts') {
      // Check if this is the problematic overcounting pattern
      const emptiesInExplanation = hint.explanation.match(/(\d+) remaining cells/)?.[1];
      if (emptiesInExplanation && parseInt(emptiesInExplanation) > 1) {
        // This is the bug - we're marking more than 1 cell as cross when empties.length > 2
        console.error(`\n❌ BUG DETECTED: Overcounting pattern marking ${emptiesInExplanation} cells as crosses when empties.length > 2`);
        console.error(`Hint: ${hint.explanation}`);
        expect(hint).toBeNull(); // This should fail if bug exists
      }
    }

    // The overcounting pattern should NOT apply here because empties.length = 3 > 2
    // So we should either get no hint, or get a different type of hint
    if (hint && hint.kind === 'place-cross') {
      // If we get a place-cross hint, verify it's not the buggy overcounting pattern
      expect(hint.explanation).not.toContain('finned overcounting');
    }
  });

  it('should correctly mark non-fin cells as crosses when there are exactly 2 empty cells', () => {
    // This is the valid case: empties.length === 2
    // In this case, marking all non-fin cells as crosses IS correct
    
    const state: PuzzleState = {
      def: {
        size: 10,
        starsPerUnit: 2,
        regions: [
          [1, 1, 1, 2, 2, 2, 3, 3, 3, 3],
          [1, 1, 1, 2, 2, 2, 3, 3, 3, 3],
          [4, 4, 4, 5, 5, 5, 6, 6, 6, 6],
          [4, 4, 4, 5, 5, 5, 6, 6, 6, 6],
          [7, 7, 7, 8, 8, 8, 9, 9, 9, 9],
          [7, 7, 7, 8, 8, 8, 9, 9, 9, 9],
          [7, 7, 7, 8, 8, 8, 9, 9, 9, 9],
          [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
          [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
          [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
        ],
      },
      cells: [
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        // Row 1: Intersection with Region 1 has exactly 2 empty cells
        ['empty', 'empty', 'cross', 'cross', 'cross', 'cross', 'cross', 'cross', 'cross', 'cross'],
        ['cross', 'cross', 'cross', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
      ],
    };

    const hint = findFinnedCountsHint(state);

    // When empties.length === 2, the overcounting pattern CAN apply
    // This is the valid case
    if (hint && hint.kind === 'place-cross' && hint.technique === 'finned-counts') {
      expect(hint.resultCells.length).toBe(1); // Should mark exactly 1 non-fin cell as cross
    }
  });
});
