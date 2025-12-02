import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findFinnedCountsHint } from '../src/logic/techniques/finnedCounts';
import type { PuzzleState } from '../src/types/puzzle';

/**
 * This test reproduces the exact scenario from the UI screenshot:
 * - Row 1 needs 2 stars, Region 1 needs 2 stars
 * - Their intersection has 3 empty cells
 * - Cell (1,5) is mentioned as the fin
 * - The hint says "if the fin is a cross, then all 2 remaining cells must be stars"
 * - This is the finned counting pattern (not overcounting)
 * 
 * But if the overcounting pattern incorrectly triggers, it would mark cells as crosses
 */
describe('Reproduce Exact UI Bug Scenario', () => {
  it('should not incorrectly mark cells as crosses in Row 1 / Region 1 intersection', () => {
    // Based on the UI screenshot, Row 1 and Region 1 intersection
    // Row 1: needs 2 stars
    // Region 1: needs 2 stars  
    // Intersection: has 3 empty cells
    // Cell (1,5) is the fin (0-indexed: row 0, col 4)
    
    const state: PuzzleState = {
      def: {
        size: 10,
        starsPerUnit: 2,
        regions: [
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
        ],
      },
      cells: [
        // Row 0: Some cells already marked
        ['cross', 'cross', 'cross', 'empty', 'empty', 'empty', 'empty', 'cross', 'cross', 'cross'],
        // Row 1: Intersection with Region 1 has 3 empty cells
        // Region 1 cells in row 1: columns 3, 4, 5 (0-indexed: 3, 4, 5)
        // Cell (1,5) is mentioned as fin, which is (0,4) in 0-indexed
        ['cross', 'empty', 'cross', 'empty', 'empty', 'empty', 'cross', 'cross', 'empty', 'cross'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
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

    // Check if we get an overcounting hint that would incorrectly mark cells as crosses
    if (hint && hint.kind === 'place-cross' && hint.technique === 'finned-counts') {
      // Check if this is marking more than 1 cell as cross when empties.length > 2
      const explanation = hint.explanation;
      const emptiesMatch = explanation.match(/intersection has (\d+) empty cells/)?.[1];
      const remainingMatch = explanation.match(/(\d+) remaining cells/)?.[1];
      
      if (emptiesMatch && parseInt(emptiesMatch) > 2 && remainingMatch && parseInt(remainingMatch) > 1) {
        console.error(`\n❌ BUG: Overcounting pattern with ${emptiesMatch} empty cells marking ${remainingMatch} cells as crosses!`);
        console.error(`Hint: ${explanation}`);
        console.error(`Result cells:`, hint.resultCells);
        expect(hint).toBeNull(); // Should not get this hint
      }
    }
    
    // Column 5 (0-indexed col 4) should not have crosses where stars should be
    // Expected stars in column 5: rows 2 and 6
    const expectedStarsInCol5 = [2, 6];
    for (const row of expectedStarsInCol5) {
      if (state.cells[row][4] === 'cross') {
        console.error(`\n❌ Column 5 row ${row} is cross but should be star!`);
        expect(state.cells[row][4]).not.toBe('cross');
      }
    }
  });
});
