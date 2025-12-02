import { describe, it, expect } from 'vitest';
import { findFinnedCountsHint } from '../src/logic/techniques/finnedCounts';
import type { PuzzleState } from '../src/types/puzzle';

/**
 * This test would FAIL if the bug exists (marking all non-fin cells as crosses when empties.length > 2)
 */
describe('Finned Counts Bug Detection', () => {
  it('should NOT return place-cross hint when empties.length === 3', () => {
    // Scenario: Row 1 needs 2 stars, Region 1 needs 2 stars
    // Intersection has 3 empty cells
    // maxStars = shapeStars + empties.length - 1 = 0 + 3 - 1 = 2
    // This would trigger the condition maxStars === shapeStars + empties.length - 1
    // BUT: We should NOT mark all non-fin cells as crosses because empties.length > 2
    
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
        ['cross', 'cross', 'cross', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        // Row 1: Intersection with Region 1 has 3 empty cells at (1,0), (1,1), (1,2)
        ['empty', 'empty', 'empty', 'cross', 'cross', 'cross', 'cross', 'cross', 'cross', 'cross'],
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

    // If bug exists: would return place-cross hint marking 2 cells as crosses
    // This is WRONG - should not return this hint when empties.length === 3
    if (hint && hint.kind === 'place-cross' && hint.technique === 'finned-counts') {
      const explanation = hint.explanation;
      // Check if this is the overcounting pattern with more than 2 empty cells
      if (explanation.includes('finned overcounting')) {
        const emptiesMatch = explanation.match(/intersection has (\d+) empty cells/)?.[1];
        const remainingMatch = explanation.match(/(\d+) remaining cells/)?.[1];
        
        if (emptiesMatch && parseInt(emptiesMatch) > 2) {
          console.error(`\n❌ BUG: Overcounting with ${emptiesMatch} empty cells!`);
          console.error(`Hint: ${explanation}`);
          expect(hint).toBeNull(); // Should not get this hint
        }
      }
    }
    
    // The overcounting pattern should NOT apply here
    // So if we get a place-cross hint, it should NOT be the overcounting pattern
    if (hint && hint.kind === 'place-cross') {
      expect(hint.explanation).not.toContain('finned overcounting');
    }
  });
});
