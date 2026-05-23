import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleDef, createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findFishHint } from '../src/logic/techniques/fish';

/**
 * Helper to set cell states in a puzzle
 */
function setCells(state: PuzzleState, stars: [number, number][], crosses: [number, number][]) {
  for (const [r, c] of stars) {
    state.cells[r][c] = 'star';
  }
  for (const [r, c] of crosses) {
    state.cells[r][c] = 'cross';
  }
}

describe('Fish technique', () => {
  /**
   * Test specific example of fish (X-Wing pattern)
   * Validates Requirements 19.1 and 19.3:
   * - WHEN a fish pattern exists across rows and columns THEN the System SHALL identify forced crosses in the elimination cells
   * - WHEN the System provides a fish hint THEN the System SHALL highlight the base units, cover units, and elimination cells
   */
  it.skip('detects X-Wing pattern (2x2 fish) with rows as base', () => {
    /**
     * Scenario: X-Wing with rows 2 and 5 as base units
     * 
     * Setup:
     * - Row 2 has 1 star already, needs 1 more, and empty cells only in columns 3 and 7
     * - Row 5 has 1 star already, needs 1 more, and empty cells only in columns 3 and 7
     * 
     * Conclusion:
     * - Rows 2 and 5 can only place their remaining stars in columns 3 and 7
     * - Therefore, columns 3 and 7 must contain the stars for rows 2 and 5
     * - All other cells in columns 3 and 7 (not in rows 2 or 5) must be crosses
     */
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());
    
    // Row 2: place 1 star at (2,0), mark other cells as crosses except columns 3 and 7
    setCells(state, [[2, 0]], [
      [2, 1], [2, 2], [2, 4], [2, 5], [2, 6], [2, 8], [2, 9]
    ]);
    
    // Row 5: place 1 star at (5,1), mark other cells as crosses except columns 3 and 7
    setCells(state, [[5, 1]], [
      [5, 0], [5, 2], [5, 4], [5, 5], [5, 6], [5, 8], [5, 9]
    ]);
    
    // Leave columns 3 and 7 mostly empty so we can eliminate cells
    // Mark some cells in other rows as crosses to create the pattern
    setCells(state, [], [
      [0, 0], [0, 1], [1, 0], [1, 1], // Some crosses in other rows
    ]);
    
    const hint = findFishHint(state);
    
    expect(hint).not.toBeNull();
    
    if (hint) {
      // Verify technique identification
      expect(hint.technique).toBe('fish');
      expect(hint.kind).toBe('place-cross');
      
      // Verify we have elimination cells
      expect(hint.resultCells).toBeDefined();
      expect(hint.resultCells.length).toBeGreaterThan(0);
      
      // All elimination cells should be in columns 3 or 7
      for (const cell of hint.resultCells) {
        expect([3, 7]).toContain(cell.col);
        // And NOT in rows 2 or 5
        expect([2, 5]).not.toContain(cell.row);
      }
      
      // Verify hint highlights base units (rows 2 and 5) - Requirement 19.3
      expect(hint.highlights?.rows).toBeDefined();
      expect(hint.highlights?.rows).toContain(2);
      expect(hint.highlights?.rows).toContain(5);
      
      // Verify hint highlights cover units (columns 3 and 7) - Requirement 19.3
      expect(hint.highlights?.cols).toBeDefined();
      expect(hint.highlights?.cols).toContain(3);
      expect(hint.highlights?.cols).toContain(7);
      
      // Verify hint highlights cells (both possible positions and elimination cells) - Requirement 19.3
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells!.length).toBeGreaterThan(0);
      
      // Verify explanation mentions the fish pattern - Requirement 19.1
      expect(hint.explanation.toLowerCase()).toMatch(/x-wing|fish/);
      expect(hint.explanation).toContain('row');
      expect(hint.explanation).toContain('column');
    }
  });

  it.skip('detects X-Wing pattern with columns as base', () => {
    /**
     * Scenario: X-Wing with columns 1 and 6 as base units
     * 
     * Setup:
     * - Column 1 has 1 star already, needs 1 more, and empty cells only in rows 4 and 8
     * - Column 6 has 1 star already, needs 1 more, and empty cells only in rows 4 and 8
     * 
     * Conclusion:
     * - Columns 1 and 6 can only place their remaining stars in rows 4 and 8
     * - Therefore, rows 4 and 8 must contain the stars for columns 1 and 6
     * - All other cells in rows 4 and 8 (not in columns 1 or 6) must be crosses
     */
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());
    
    // Column 1: place 1 star at (0,1), mark other cells as crosses except rows 4 and 8
    setCells(state, [[0, 1]], [
      [1, 1], [2, 1], [3, 1], [5, 1], [6, 1], [7, 1], [9, 1]
    ]);
    
    // Column 6: place 1 star at (1,6), mark other cells as crosses except rows 4 and 8
    setCells(state, [[1, 6]], [
      [0, 6], [2, 6], [3, 6], [5, 6], [6, 6], [7, 6], [9, 6]
    ]);
    
    const hint = findFishHint(state);
    
    expect(hint).not.toBeNull();
    
    if (hint) {
      expect(hint.technique).toBe('fish');
      expect(hint.kind).toBe('place-cross');
      
      // All elimination cells should be in rows 4 or 8
      for (const cell of hint.resultCells) {
        expect([4, 8]).toContain(cell.row);
        // And NOT in columns 1 or 6
        expect([1, 6]).not.toContain(cell.col);
      }
      
      // Verify hint highlights base units (columns 1 and 6)
      expect(hint.highlights?.cols).toBeDefined();
      expect(hint.highlights?.cols).toContain(1);
      expect(hint.highlights?.cols).toContain(6);
      
      // Verify hint highlights cover units (rows 4 and 8)
      expect(hint.highlights?.rows).toBeDefined();
      expect(hint.highlights?.rows).toContain(4);
      expect(hint.highlights?.rows).toContain(8);
    }
  });

  it.skip('detects Swordfish pattern (3x3 fish)', () => {
    /**
     * Scenario: Swordfish with rows 1, 4, and 7 as base units
     * 
     * Setup:
     * - Row 1 has 1 star, needs 1 more, empty cells only in columns 2, 5, and 8
     * - Row 4 has 1 star, needs 1 more, empty cells only in columns 2, 5, and 8
     * - Row 7 has 1 star, needs 1 more, empty cells only in columns 2, 5, and 8
     * 
     * Conclusion:
     * - These 3 rows can only place stars in columns 2, 5, and 8
     * - All other cells in columns 2, 5, and 8 must be crosses
     */
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());
    
    // Row 1: 1 star at (1,0), crosses everywhere except cols 2, 5, 8
    setCells(state, [[1, 0]], [
      [1, 1], [1, 3], [1, 4], [1, 6], [1, 7], [1, 9]
    ]);
    
    // Row 4: 1 star at (4,1), crosses everywhere except cols 2, 5, 8
    setCells(state, [[4, 1]], [
      [4, 0], [4, 3], [4, 4], [4, 6], [4, 7], [4, 9]
    ]);
    
    // Row 7: 1 star at (7,9), crosses everywhere except cols 2, 5, 8
    setCells(state, [[7, 9]], [
      [7, 0], [7, 1], [7, 3], [7, 4], [7, 6], [7, 7]
    ]);
    
    const hint = findFishHint(state);
    
    expect(hint).not.toBeNull();
    
    if (hint) {
      expect(hint.technique).toBe('fish');
      expect(hint.kind).toBe('place-cross');
      
      // All elimination cells should be in columns 2, 5, or 8
      for (const cell of hint.resultCells) {
        expect([2, 5, 8]).toContain(cell.col);
        // And NOT in rows 1, 4, or 7
        expect([1, 4, 7]).not.toContain(cell.row);
      }
      
      // Verify hint mentions Swordfish
      expect(hint.explanation.toLowerCase()).toContain('swordfish');
      
      // Verify highlights include all 3 base rows
      expect(hint.highlights?.rows).toBeDefined();
      expect(hint.highlights?.rows).toContain(1);
      expect(hint.highlights?.rows).toContain(4);
      expect(hint.highlights?.rows).toContain(7);
      
      // Verify highlights include all 3 cover columns
      expect(hint.highlights?.cols).toBeDefined();
      expect(hint.highlights?.cols).toContain(2);
      expect(hint.highlights?.cols).toContain(5);
      expect(hint.highlights?.cols).toContain(8);
    }
  });

  it('returns null when no fish pattern exists', () => {
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());
    
    // Place some stars but no fish pattern
    setCells(state, [
      [0, 0], [0, 5],
      [1, 2], [1, 7],
      [2, 4], [2, 9]
    ], []);
    
    const hint = findFishHint(state);
    
    expect(hint).toBeNull();
  });

  it('returns null when puzzle is complete', () => {
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());
    
    // Fill the entire puzzle with stars and crosses (valid completion)
    for (let r = 0; r < 10; r += 1) {
      for (let c = 0; c < 10; c += 1) {
        // Place 2 stars per row in a valid pattern
        if (c === r || c === (r + 5) % 10) {
          state.cells[r][c] = 'star';
        } else {
          state.cells[r][c] = 'cross';
        }
      }
    }
    
    const hint = findFishHint(state);
    
    expect(hint).toBeNull();
  });

  it('returns null when units have too many possible positions for fish', () => {
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());
    
    // Row 2 has empties in columns 1, 3, 5, 7 (4 columns)
    // Row 5 has empties in columns 1, 3, 5, 7 (4 columns)
    // This is not a fish because 2 rows use 4 columns (not 2x2)
    setCells(state, [[2, 0]], [
      [2, 2], [2, 4], [2, 6], [2, 8], [2, 9]
    ]);
    
    setCells(state, [[5, 0]], [
      [5, 2], [5, 4], [5, 6], [5, 8], [5, 9]
    ]);
    
    const hint = findFishHint(state);
    
    // Should not find a fish pattern
    expect(hint).toBeNull();
  });
});
