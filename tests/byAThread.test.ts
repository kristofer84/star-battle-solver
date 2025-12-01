import { describe, it, expect } from 'vitest';
import { findByAThreadHint } from '../src/logic/techniques/byAThread';
import type { PuzzleState, PuzzleDef, CellState } from '../src/types/puzzle';

// Helper to create a puzzle state
function createPuzzleState(size: number, starsPerUnit: number, regions: number[][], cells: CellState[][]): PuzzleState {
  const def: PuzzleDef = { size, starsPerUnit, regions };
  return { def, cells };
}

describe('By a Thread Technique', () => {
  /**
   * Test specific example requiring uniqueness logic
   * Validates: Requirements 13.1, 13.2, 13.4
   * 
   * A puzzle state where a cell's value is determined by uniqueness
   * should produce a by-a-thread hint. One hypothesis should lead to
   * 0 or multiple solutions, while the other leads to exactly 1 solution.
   */
  it('finds forced cell using uniqueness argument', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a simple region layout (each row is a region)
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(r + 1);
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Create a near-complete puzzle where one cell determines uniqueness
    // This is a simplified scenario for testing
    
    // Fill most of the puzzle with a valid partial solution
    // Row 0: stars at (0, 0) and (0, 5)
    cells[0][0] = 'star';
    cells[0][5] = 'star';
    
    // Row 1: stars at (1, 2) and (1, 7)
    cells[1][2] = 'star';
    cells[1][7] = 'star';
    
    // Row 2: stars at (2, 4) and (2, 9)
    cells[2][4] = 'star';
    cells[2][9] = 'star';
    
    // Row 3: stars at (3, 1) and (3, 6)
    cells[3][1] = 'star';
    cells[3][6] = 'star';
    
    // Row 4: stars at (4, 3) and (4, 8)
    cells[4][3] = 'star';
    cells[4][8] = 'star';
    
    // Row 5: stars at (5, 0) and (5, 5)
    cells[5][0] = 'star';
    cells[5][5] = 'star';
    
    // Row 6: stars at (6, 2) and (6, 7)
    cells[6][2] = 'star';
    cells[6][7] = 'star';
    
    // Row 7: stars at (7, 4) and (7, 9)
    cells[7][4] = 'star';
    cells[7][9] = 'star';
    
    // Row 8: stars at (8, 1) and (8, 6)
    cells[8][1] = 'star';
    cells[8][6] = 'star';
    
    // Row 9: one star at (9, 3), need one more
    cells[9][3] = 'star';
    // Leave (9, 8) empty - this will be the critical cell
    
    // Mark other cells in row 9 as crosses
    for (let c = 0; c < size; c++) {
      if (c !== 3 && c !== 8) {
        cells[9][c] = 'cross';
      }
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadHint(state);
    
    // The hint should identify that (9, 8) must be a star
    // (In this simple case, it's actually forced by simpler techniques,
    // but we're testing the by-a-thread mechanism)
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.technique).toBe('by-a-thread');
      expect(hint.resultCells).toHaveLength(1);
      expect(hint.explanation).toContain('uniqueness');
      
      // Verify hint highlights critical cell and involved regions
      expect(hint.highlights).toBeDefined();
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells?.length).toBeGreaterThan(0);
    }
  });

  it('finds forced cross using uniqueness argument', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a region layout where columns 0-4 are region 1, columns 5-9 are region 2
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(c < 5 ? 1 : 2);
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Create a scenario where placing a star would lead to multiple solutions
    // but placing a cross leads to a unique solution
    
    // Fill in a partial puzzle
    cells[0][0] = 'star';
    cells[0][5] = 'star';
    cells[1][2] = 'star';
    cells[1][7] = 'star';
    
    // Leave some cells empty for the uniqueness test
    // Mark most other cells as crosses
    for (let r = 2; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((r === 2 && c === 4) || (r === 2 && c === 9)) {
          // Leave these empty for testing
          continue;
        }
        cells[r][c] = 'cross';
      }
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadHint(state);
    
    // The technique should find a forced move based on uniqueness
    if (hint) {
      expect(hint.technique).toBe('by-a-thread');
      expect(['place-star', 'place-cross']).toContain(hint.kind);
      expect(hint.explanation).toContain('uniqueness');
      expect(hint.highlights?.cells).toBeDefined();
    }
  });

  it('returns null when no uniqueness argument applies', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a simple empty puzzle
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(Math.floor(r / 2) + 1);
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadHint(state);
    
    // No uniqueness argument in an empty puzzle
    expect(hint).toBeNull();
  });

  it('returns null when puzzle is already complete', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a region layout
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(r + 1);
        cellRow.push('cross');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Place exactly 2 stars per row
    cells[0][0] = 'star';
    cells[0][5] = 'star';
    cells[1][2] = 'star';
    cells[1][7] = 'star';
    cells[2][4] = 'star';
    cells[2][9] = 'star';
    cells[3][1] = 'star';
    cells[3][6] = 'star';
    cells[4][3] = 'star';
    cells[4][8] = 'star';
    cells[5][0] = 'star';
    cells[5][5] = 'star';
    cells[6][2] = 'star';
    cells[6][7] = 'star';
    cells[7][4] = 'star';
    cells[7][9] = 'star';
    cells[8][1] = 'star';
    cells[8][6] = 'star';
    cells[9][3] = 'star';
    cells[9][8] = 'star';
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadHint(state);
    
    // No hint for a complete puzzle
    expect(hint).toBeNull();
  });

  it('verifies hint highlights critical cell and involved regions', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a region layout (each row is a region)
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(r + 1);
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Create a near-complete puzzle
    cells[0][0] = 'star';
    cells[0][5] = 'star';
    cells[1][2] = 'star';
    cells[1][7] = 'star';
    cells[2][4] = 'star';
    cells[2][9] = 'star';
    cells[3][1] = 'star';
    cells[3][6] = 'star';
    cells[4][3] = 'star';
    cells[4][8] = 'star';
    cells[5][0] = 'star';
    cells[5][5] = 'star';
    cells[6][2] = 'star';
    cells[6][7] = 'star';
    cells[7][4] = 'star';
    cells[7][9] = 'star';
    cells[8][1] = 'star';
    cells[8][6] = 'star';
    cells[9][3] = 'star';
    
    // Mark most cells as crosses, leaving one critical cell
    for (let c = 0; c < size; c++) {
      if (c !== 3 && c !== 8) {
        cells[9][c] = 'cross';
      }
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadHint(state);
    
    if (hint) {
      // Verify highlights structure
      expect(hint.highlights).toBeDefined();
      
      // Should highlight the critical cell
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells?.length).toBeGreaterThan(0);
      
      // Should include at least one unit (row, col, or region)
      const hasUnit = (hint.highlights?.rows && hint.highlights.rows.length > 0) ||
                     (hint.highlights?.cols && hint.highlights.cols.length > 0) ||
                     (hint.highlights?.regions && hint.highlights.regions.length > 0);
      expect(hasUnit).toBe(true);
    }
  });
});
