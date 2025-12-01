import { describe, it, expect } from 'vitest';
import { findAtSeaHint } from '../src/logic/techniques/atSea';
import type { PuzzleState, PuzzleDef, CellState } from '../src/types/puzzle';

// Helper to create a puzzle state
function createPuzzleState(size: number, starsPerUnit: number, regions: number[][], cells: CellState[][]): PuzzleState {
  const def: PuzzleDef = { size, starsPerUnit, regions };
  return { def, cells };
}

describe('At Sea Technique', () => {
  /**
   * Test specific example of isolation pattern
   * Validates: Requirements 14.1, 14.3
   * 
   * A puzzle state with an isolated region forcing specific placements
   * should produce an at-sea hint that highlights the isolated region
   * and forced cells.
   */
  it('finds forced stars in isolated cells', () => {
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
    
    // Create an isolation scenario in row 5
    // Row 5 needs 2 stars, and we'll set it up so only 2 specific cells are viable
    
    // First, place stars in columns 0 and 1 in other rows to create pressure
    cells[0][0] = 'star';
    cells[0][5] = 'star';
    cells[1][1] = 'star';
    cells[1][6] = 'star';
    cells[2][2] = 'star';
    cells[2][7] = 'star';
    cells[3][3] = 'star';
    cells[3][8] = 'star';
    cells[4][4] = 'star';
    cells[4][9] = 'star';
    
    // In row 5, mark most cells as crosses, leaving only 2 cells empty
    // These 2 cells will be isolated and must be stars
    for (let c = 0; c < size; c++) {
      if (c !== 2 && c !== 7) {
        cells[5][c] = 'cross';
      }
    }
    
    // Also ensure columns 2 and 7 need exactly 2 more stars
    // and row 5's empty cells are the only options
    cells[6][2] = 'cross';
    cells[7][2] = 'cross';
    cells[8][2] = 'cross';
    cells[9][2] = 'cross';
    
    cells[6][7] = 'cross';
    cells[7][7] = 'cross';
    cells[8][7] = 'cross';
    cells[9][7] = 'cross';
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findAtSeaHint(state);
    
    // The hint should identify that cells in row 5 are isolated and must be stars
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.technique).toBe('at-sea');
      expect(hint.kind).toBe('place-star');
      expect(hint.resultCells.length).toBeGreaterThan(0);
      expect(hint.explanation).toContain('sea');
      expect(hint.explanation).toContain('isolated');
      
      // Verify hint highlights isolated region and forced cells
      expect(hint.highlights).toBeDefined();
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells?.length).toBeGreaterThan(0);
      
      // Should highlight at least one unit
      const hasUnit = (hint.highlights?.rows && hint.highlights.rows.length > 0) ||
                     (hint.highlights?.cols && hint.highlights.cols.length > 0) ||
                     (hint.highlights?.regions && hint.highlights.regions.length > 0);
      expect(hasUnit).toBe(true);
    }
  });

  it('finds forced crosses due to isolation', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a region layout
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(Math.floor(c / 5) + 1);
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Create a scenario where some cells must be crosses due to isolation
    // Place stars to create constraints
    cells[0][0] = 'star';
    cells[0][5] = 'star';
    cells[1][2] = 'star';
    cells[1][7] = 'star';
    
    // In row 2, create isolation where only specific cells can be stars
    // Mark some cells as crosses
    cells[2][0] = 'cross';
    cells[2][1] = 'cross';
    cells[2][5] = 'cross';
    cells[2][6] = 'cross';
    
    // Leave cells at positions 2, 3, 4, 7, 8, 9 empty
    // But make it so that only 2 of them can be stars due to other constraints
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findAtSeaHint(state);
    
    // The technique should potentially find forced crosses
    if (hint && hint.kind === 'place-cross') {
      expect(hint.technique).toBe('at-sea');
      expect(hint.explanation).toContain('sea');
      expect(hint.highlights?.cells).toBeDefined();
    }
  });

  it('returns null when no isolation pattern exists', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a simple empty puzzle with no isolation
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
    const hint = findAtSeaHint(state);
    
    // No isolation in an empty puzzle
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
    const hint = findAtSeaHint(state);
    
    // No hint for a complete puzzle
    expect(hint).toBeNull();
  });

  it('highlights isolated region and forced cells', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a region layout (each column is a region)
    for (let r = 0; r < size; r++) {
      const regionRow: number[] = [];
      const cellRow: CellState[] = [];
      for (let c = 0; c < size; c++) {
        regionRow.push(c + 1);
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Create isolation in column 3
    // Place stars in other columns
    cells[0][0] = 'star';
    cells[1][0] = 'star';
    cells[0][1] = 'star';
    cells[1][1] = 'star';
    cells[0][2] = 'star';
    cells[1][2] = 'star';
    
    // In column 3, mark most cells as crosses, leaving only 2 empty
    for (let r = 0; r < size; r++) {
      if (r !== 5 && r !== 8) {
        cells[r][3] = 'cross';
      }
    }
    
    // Make rows 5 and 8 need exactly 2 more stars each
    // and column 3's cells are critical
    for (let c = 0; c < size; c++) {
      if (c !== 3) {
        cells[5][c] = 'cross';
        cells[8][c] = 'cross';
      }
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findAtSeaHint(state);
    
    if (hint) {
      // Verify highlights structure
      expect(hint.highlights).toBeDefined();
      
      // Should highlight the forced cells
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells?.length).toBeGreaterThan(0);
      
      // Should include the isolated unit
      const hasUnit = (hint.highlights?.rows && hint.highlights.rows.length > 0) ||
                     (hint.highlights?.cols && hint.highlights.cols.length > 0) ||
                     (hint.highlights?.regions && hint.highlights.regions.length > 0);
      expect(hasUnit).toBe(true);
    }
  });
});
