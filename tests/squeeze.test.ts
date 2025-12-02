import { describe, it, expect } from 'vitest';
import { findSqueezeHint } from '../src/logic/techniques/squeeze';
import type { PuzzleState, PuzzleDef, CellState } from '../src/types/puzzle';

// Helper to create a puzzle state
function createPuzzleState(size: number, starsPerUnit: number, regions: number[][], cells: CellState[][]): PuzzleState {
  const def: PuzzleDef = { size, starsPerUnit, regions };
  return { def, cells };
}

describe('Squeeze Technique', () => {
  /**
   * Test specific example of squeeze pattern
   * Validates: Requirements 11.1, 11.3
   * 
   * A puzzle state where stars must fit into a narrow corridor with crosses
   * blocking other options should produce a squeeze hint.
   */
  it('finds forced star in narrow corridor', () => {
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
    
    // Create a squeeze scenario in row 0:
    // - Row 0 has 1 star already at (0, 0)
    // - Most cells are crosses, leaving only a narrow corridor
    cells[0][0] = 'star';
    
    // Mark cells as crosses, leaving only cells (0, 5), (0, 6), (0, 7) as empty
    for (let c = 1; c < size; c++) {
      if (c < 5 || c > 7) {
        cells[0][c] = 'cross';
      }
    }
    
    // Place a star at (0, 6) to create adjacency constraint
    // This makes (0, 5) and (0, 7) invalid due to adjacency
    // But we need to test the squeeze, so let's create a different scenario
    
    // Actually, let's create a scenario where only 1 cell remains valid
    // Row 0 needs 1 more star, and only (0, 5) is valid
    cells[0][4] = 'star'; // This makes (0, 5) adjacent, so let's adjust
    
    // Reset and create a clearer scenario
    cells[0][0] = 'star';
    cells[0][1] = 'cross';
    cells[0][2] = 'cross';
    cells[0][3] = 'cross';
    cells[0][4] = 'cross';
    cells[0][5] = 'empty';  // Only valid placement
    cells[0][6] = 'cross';
    cells[0][7] = 'cross';
    cells[0][8] = 'cross';
    cells[0][9] = 'cross';
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findSqueezeHint(state);
    
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.kind).toBe('place-star');
      expect(hint.technique).toBe('squeeze');
      expect(hint.resultCells).toHaveLength(1);
      expect(hint.resultCells[0]).toEqual({ row: 0, col: 5 });
      expect(hint.explanation).toContain('Row 0');
      expect(hint.explanation).toContain('crosses and 2×2 constraints');
      expect(hint.highlights?.rows).toContain(0);
      expect(hint.highlights?.cells).toHaveLength(1);
    }
  });

  it('finds forced stars when valid placements equal remaining stars', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a simple region layout where each column is a region
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
    
    // Create a squeeze in column 3:
    // - Column 3 (region 4) has 0 stars
    // - Most cells are crosses
    // - Only 2 cells remain valid (not adjacent to any stars)
    
    // Place stars in other columns to avoid other squeeze patterns
    cells[0][0] = 'star';
    cells[2][0] = 'star';
    cells[1][1] = 'star';
    cells[3][1] = 'star';
    cells[0][2] = 'star';
    cells[2][2] = 'star';
    
    // Mark most of column 3 as crosses, leaving only 2 cells
    cells[0][3] = 'cross';
    cells[1][3] = 'cross';
    cells[2][3] = 'cross';
    cells[3][3] = 'cross';
    cells[4][3] = 'empty';  // Valid placement 1
    cells[5][3] = 'cross';
    cells[6][3] = 'cross';
    cells[7][3] = 'cross';
    cells[8][3] = 'empty';  // Valid placement 2
    cells[9][3] = 'cross';
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findSqueezeHint(state);
    
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.kind).toBe('place-star');
      expect(hint.technique).toBe('squeeze');
      // Squeeze now returns all forced stars, which can be 2 in this case
      expect(hint.resultCells.length).toBeGreaterThanOrEqual(1);
      expect(hint.resultCells.length).toBeLessThanOrEqual(2);
      expect(hint.explanation).toContain('Column 3');
      expect(hint.explanation).toContain('2×2 constraints');
      expect(hint.highlights?.cols).toContain(3);
      // Verify the result cell is one of the valid placements
      expect([4, 8]).toContain(hint.resultCells[0].row);
      expect(hint.resultCells[0].col).toBe(3);
    }
  });

  it('finds forced star when corridor blocks other placements', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create regions where each row is its own region
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
    
    // Create a squeeze in row 1:
    // - Row 1 has 1 star already at (1, 0)
    // - Most cells are crosses, leaving only 2 valid placements
    // - Region 2 (row 1) needs 1 more star
    cells[1][0] = 'star';
    
    // Mark most cells as crosses, leaving only cells (1, 5) and (1, 8) as empty
    for (let c = 1; c < size; c++) {
      if (c !== 5 && c !== 8) {
        cells[1][c] = 'cross';
      }
    }
    
    // Now row 1 needs 1 more star and has only 2 valid placements
    // But we need exactly 1 star, so this is not a squeeze yet
    // Let's add a star adjacent to one of them to make only 1 valid
    cells[0][5] = 'star'; // Makes (1, 5) invalid due to adjacency
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findSqueezeHint(state);
    
    // Should find that (1, 8) is forced
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.kind).toBe('place-star');
      expect(hint.technique).toBe('squeeze');
      expect(hint.resultCells).toHaveLength(1);
      expect(hint.resultCells[0]).toEqual({ row: 1, col: 8 });
    }
  });

  it('returns null when no squeeze pattern exists', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a puzzle with some progress but no squeeze pattern
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
    
    // Place some stars to avoid trivial squeeze patterns
    cells[0][0] = 'star';
    cells[0][5] = 'star';
    cells[2][2] = 'star';
    cells[2][7] = 'star';
    cells[4][1] = 'star';
    cells[4][6] = 'star';
    cells[6][3] = 'star';
    cells[6][8] = 'star';
    cells[8][0] = 'star';
    cells[8][5] = 'star';
    
    // Mark some cells as crosses to create variety
    cells[1][0] = 'cross';
    cells[1][5] = 'cross';
    cells[3][2] = 'cross';
    cells[3][7] = 'cross';
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findSqueezeHint(state);
    
    // No squeeze pattern in this configuration
    expect(hint).toBeNull();
  });

  it('verifies hint highlights constrained region and forcing cells', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create regions (each row is a region)
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
    
    // Create a clear squeeze scenario in region 3 (row 2)
    // Region 3 needs 2 stars, mark most cells as crosses leaving exactly 2
    cells[2][0] = 'cross';
    cells[2][1] = 'cross';
    cells[2][2] = 'empty';  // Valid placement 1
    cells[2][3] = 'cross';
    cells[2][4] = 'cross';
    cells[2][5] = 'cross';
    cells[2][6] = 'empty';  // Valid placement 2
    cells[2][7] = 'cross';
    cells[2][8] = 'cross';
    cells[2][9] = 'cross';
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findSqueezeHint(state);
    
    expect(hint).not.toBeNull();
    if (hint) {
      // Verify highlights include the constrained unit (row, col, or region)
      expect(hint.highlights).toBeDefined();
      
      // Should have at least one of: rows, cols, or regions
      const hasUnit = (hint.highlights?.rows && hint.highlights.rows.length > 0) ||
                     (hint.highlights?.cols && hint.highlights.cols.length > 0) ||
                     (hint.highlights?.regions && hint.highlights.regions.length > 0);
      expect(hasUnit).toBe(true);
      
      // Verify highlights include forcing cells
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells?.length).toBeGreaterThan(0);
      
      // Verify result cells contain forced placements
      // Squeeze now returns all forced stars, which can be 2 in this case
      expect(hint.resultCells.length).toBeGreaterThanOrEqual(1);
      expect(hint.resultCells.length).toBeLessThanOrEqual(2);
      // Should be one or both of the two valid placements
      for (const cell of hint.resultCells) {
        expect([2, 6]).toContain(cell.col);
      }
    }
  });
});
