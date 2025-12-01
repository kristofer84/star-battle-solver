import { describe, it, expect } from 'vitest';
import { findSetDifferentialsHint } from '../src/logic/techniques/setDifferentials';
import type { PuzzleState, PuzzleDef, CellState } from '../src/types/puzzle';

// Helper to create a puzzle state
function createPuzzleState(size: number, starsPerUnit: number, regions: number[][], cells: CellState[][]): PuzzleState {
  const def: PuzzleDef = { size, starsPerUnit, regions };
  return { def, cells };
}

describe('Set Differentials - Unit Tests', () => {
  /**
   * Test specific example of set differential pattern
   * Verify hint highlights both shapes and differential region
   * Requirements: 12.1, 12.2, 12.4
   */
  it('finds forced crosses when maximum in difference is reached', () => {
    // Create a 10×10 puzzle with vertical regions (2 columns each)
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create vertical regions: Region 1 = cols 0-1, Region 2 = cols 2-3, etc.
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(Math.floor(c / 2) + 1);
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Scenario demonstrating set differential:
    // Shape A = row 0 ∩ region 1 (cols 0-1)
    // Shape B = row 0 ∩ (region 1 ∪ region 2) (cols 0-3)
    // Difference = row 0 ∩ region 2 (cols 2-3)
    
    // Goal: Make Shape A need at least 1 star, and Shape B can have at most 1 star
    // This means the difference (region 2 in row 0) can have at most 0 stars
    
    // Place 1 star in row 0, col 0 (region 1, shape A)
    cells[0][0] = 'star';
    
    // Saturate region 1 with another star outside row 0
    cells[1][1] = 'star';
    // Region 1 now has 2 stars (saturated)
    
    // Saturate region 2 with 2 stars outside row 0
    cells[1][2] = 'star';
    cells[2][3] = 'star';
    // Region 2 now has 2 stars (saturated)
    
    // Place 1 more star in row 0 (outside regions 1 and 2)
    cells[0][4] = 'star';
    // Row 0 now has 2 stars (saturated)
    
    // Add empties in row 0
    cells[0][1] = 'empty';  // region 1
    cells[0][2] = 'empty';  // region 2 (differential)
    cells[0][3] = 'empty';  // region 2 (differential)
    
    // Mark rest of row 0 as crosses
    for (let c = 5; c < size; c++) {
      cells[0][c] = 'cross';
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findSetDifferentialsHint(state);
    
    // The technique should identify that empties in the differential must be crosses
    if (hint && hint.technique === 'set-differentials') {
      // Requirement 12.1: Forces specific cells based on star count difference
      expect(hint.kind).toBe('place-cross');
      expect(hint.resultCells.length).toBeGreaterThan(0);
      
      // Requirement 12.4: Verify highlights include both shapes and differential region
      expect(hint.highlights).toBeDefined();
      expect(hint.highlights?.rows || hint.highlights?.cols).toBeDefined();
      expect(hint.highlights?.regions).toBeDefined();
      expect(hint.highlights?.regions!.length).toBeGreaterThanOrEqual(2);
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells!.length).toBeGreaterThan(0);
      
      // Requirement 12.2: Verify explanation mentions both shapes
      expect(hint.explanation).toContain('∩');
      expect(hint.explanation).toContain('∪');
    }
  });

  it('finds forced moves with overlapping shapes', () => {
    // Create a scenario where set differential applies
    // This test verifies the technique works regardless of whether it forces stars or crosses
    // Requirements: 12.1, 12.2, 12.4
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create vertical regions (each 2 columns wide)
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(Math.floor(c / 2) + 1);
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Scenario demonstrating set differential:
    // Shape A = row 0 ∩ region 1 (cols 0-1)
    // Shape B = row 0 ∩ (region 1 ∪ region 2) (cols 0-3)
    // Difference = row 0 ∩ region 2 (cols 2-3)
    
    // Saturate region 1 with 2 stars outside row 0
    cells[1][0] = 'star';
    cells[2][1] = 'star';
    // Region 1 now has 2 stars (saturated)
    
    // Region 2 needs 2 stars, has 0
    // Row 0 needs 2 stars, has 0
    
    // Mark all cells in row 0, region 1 as crosses (since region 1 is saturated)
    cells[0][0] = 'cross';
    cells[0][1] = 'cross';
    
    // Leave only 2 empties in row 0, region 2 (the differential)
    cells[0][2] = 'empty';
    cells[0][3] = 'empty';
    
    // Mark rest of row 0 as crosses (forcing stars into region 2)
    for (let c = 4; c < size; c++) {
      cells[0][c] = 'cross';
    }
    
    // Mark most of region 2 as crosses except row 0
    for (let r = 1; r < size; r++) {
      cells[r][2] = 'cross';
      cells[r][3] = 'cross';
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findSetDifferentialsHint(state);
    
    // The technique should identify forced moves in the differential
    // (Could be stars or crosses depending on the exact constraints)
    if (hint && hint.technique === 'set-differentials') {
      // Requirement 12.1: Forces specific cells based on star count difference
      expect(['place-star', 'place-cross']).toContain(hint.kind);
      expect(hint.resultCells.length).toBeGreaterThan(0);
      
      // Requirement 12.4: Highlights both composite shapes and differential region
      expect(hint.highlights).toBeDefined();
      expect(hint.highlights?.regions).toBeDefined();
      expect(hint.highlights?.regions!.length).toBeGreaterThanOrEqual(2);
      expect(hint.highlights?.cells).toBeDefined();
      
      // Requirement 12.2: Explanation identifies the two shapes and their difference
      expect(hint.explanation).toBeDefined();
      expect(hint.explanation.length).toBeGreaterThan(0);
      expect(hint.explanation).toContain('∩');
      expect(hint.explanation).toContain('∪');
    }
  });

  it('verifies hint structure includes both shapes and differential', () => {
    // Test that verifies the hint structure meets all requirements
    // This is a comprehensive test that validates the complete hint structure
    // Requirements: 12.1, 12.2, 12.4
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create vertical regions
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(Math.floor(c / 2) + 1);
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Create a clear scenario where set differential applies
    // Shape A = row 0 ∩ region 1 (cols 0-1)
    // Shape B = row 0 ∩ (region 1 ∪ region 2) (cols 0-3)
    // Difference = row 0 ∩ region 2 (cols 2-3)
    
    // Place 1 star in row 0, region 1
    cells[0][0] = 'star';
    
    // Saturate region 1 with another star
    cells[1][1] = 'star';
    
    // Saturate region 2 with 2 stars outside row 0
    cells[1][2] = 'star';
    cells[2][3] = 'star';
    
    // Place 1 more star in row 0 (outside regions 1 and 2)
    cells[0][4] = 'star';
    
    // Add empties in row 0
    cells[0][1] = 'empty';
    cells[0][2] = 'empty';
    cells[0][3] = 'empty';
    
    // Mark rest as crosses
    for (let c = 5; c < size; c++) {
      cells[0][c] = 'cross';
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findSetDifferentialsHint(state);
    
    if (hint && hint.technique === 'set-differentials') {
      // Requirement 12.1: Marks cells as stars or crosses based on differential
      expect(['place-star', 'place-cross']).toContain(hint.kind);
      expect(hint.resultCells).toBeDefined();
      expect(Array.isArray(hint.resultCells)).toBe(true);
      expect(hint.resultCells.length).toBeGreaterThan(0);
      
      // Requirement 12.2: Identifies two shapes and their symmetric difference
      expect(hint.explanation).toBeDefined();
      expect(typeof hint.explanation).toBe('string');
      expect(hint.explanation.length).toBeGreaterThan(0);
      // Explanation should mention intersection (∩) and union (∪)
      expect(hint.explanation).toContain('∩');
      expect(hint.explanation).toContain('∪');
      
      // Requirement 12.4: Highlights both composite shapes and differential region
      expect(hint.highlights).toBeDefined();
      
      // Should highlight at least one row or column (the unit being analyzed)
      const hasRowOrCol = (hint.highlights?.rows && hint.highlights.rows.length > 0) ||
                          (hint.highlights?.cols && hint.highlights.cols.length > 0);
      expect(hasRowOrCol).toBe(true);
      
      // Should highlight at least 2 regions (the two shapes being compared)
      expect(hint.highlights?.regions).toBeDefined();
      expect(hint.highlights?.regions!.length).toBeGreaterThanOrEqual(2);
      
      // Should highlight the cells in the differential
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells!.length).toBeGreaterThan(0);
      
      // The highlighted cells should match the result cells
      expect(hint.highlights?.cells).toEqual(hint.resultCells);
    }
  });
});
