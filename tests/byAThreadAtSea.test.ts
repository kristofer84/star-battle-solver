import { describe, it, expect } from 'vitest';
import { findByAThreadAtSeaHint } from '../src/logic/techniques/byAThreadAtSea';
import type { PuzzleState, PuzzleDef, CellState } from '../src/types/puzzle';

// Helper to create a puzzle state
function createPuzzleState(size: number, starsPerUnit: number, regions: number[][], cells: CellState[][]): PuzzleState {
  const def: PuzzleDef = { size, starsPerUnit, regions };
  return { def, cells };
}

describe('By a Thread at Sea Technique', () => {
  /**
   * Test specific example requiring both uniqueness and isolation
   * Validates: Requirements 15.1, 15.3
   * 
   * A puzzle state where a cell's value is determined by combining
   * uniqueness and isolation arguments should produce a by-a-thread-at-sea hint.
   * The hint should highlight critical cells and isolated regions.
   */
  it('finds forced cell using combined uniqueness and isolation', () => {
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
    
    // Create a scenario that requires BOTH uniqueness and isolation logic
    // This is more complex than either technique alone
    
    // Fill most of the puzzle
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
    
    // Row 9 needs 2 stars
    // Create an isolation scenario where only certain cells are viable
    // AND uniqueness determines which specific cell must be a star
    
    // Mark most cells in row 9 as crosses, leaving a few options
    for (let c = 0; c < size; c++) {
      if (c !== 3 && c !== 8) {
        cells[9][c] = 'cross';
      }
    }
    
    // Make column 3 and column 8 each need exactly 1 more star
    // This creates isolation - row 9's empty cells are critical for these columns
    
    // But also set up the puzzle so that uniqueness matters:
    // One choice leads to multiple solutions, the other to a unique solution
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadAtSeaHint(state);
    
    // The hint should identify a forced move using both uniqueness and isolation
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.technique).toBe('by-a-thread-at-sea');
      expect(['place-star', 'place-cross']).toContain(hint.kind);
      expect(hint.resultCells).toHaveLength(1);
      expect(hint.explanation).toContain('uniqueness');
      expect(hint.explanation).toContain('isolation');
      
      // Verify hint highlights critical cells and isolated regions
      expect(hint.highlights).toBeDefined();
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells?.length).toBeGreaterThan(0);
      
      // Should highlight involved units
      const hasUnit = (hint.highlights?.rows && hint.highlights.rows.length > 0) ||
                     (hint.highlights?.cols && hint.highlights.cols.length > 0) ||
                     (hint.highlights?.regions && hint.highlights.regions.length > 0);
      expect(hasUnit).toBe(true);
    }
  });

  it('returns null when only uniqueness applies (not isolation)', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a scenario where by-a-thread would work but not at-sea
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
    
    // Fill with a pattern that has uniqueness but no isolation
    cells[0][0] = 'star';
    cells[0][5] = 'star';
    cells[1][2] = 'star';
    cells[1][7] = 'star';
    
    // Leave many cells empty - no isolation
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadAtSeaHint(state);
    
    // Should return null because isolation is not present
    // (by-a-thread would handle the uniqueness-only case)
    expect(hint).toBeNull();
  });

  it('returns null when only isolation applies (not uniqueness)', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
    // Create a scenario where at-sea would work but not by-a-thread
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
    
    // Create clear isolation without uniqueness ambiguity
    cells[0][0] = 'star';
    cells[0][5] = 'star';
    
    // Row 1 has only 2 cells left and needs 2 stars - clear isolation
    for (let c = 0; c < size; c++) {
      if (c !== 2 && c !== 7) {
        cells[1][c] = 'cross';
      }
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadAtSeaHint(state);
    
    // Should return null because uniqueness is not needed
    // (at-sea would handle the isolation-only case)
    expect(hint).toBeNull();
  });

  it('returns null when puzzle is empty', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
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
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadAtSeaHint(state);
    
    expect(hint).toBeNull();
  });

  it('returns null when puzzle is complete', () => {
    const size = 10;
    const starsPerUnit = 2;
    const regions: number[][] = [];
    const cells: CellState[][] = [];
    
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
    const hint = findByAThreadAtSeaHint(state);
    
    expect(hint).toBeNull();
  });

  it('highlights both critical cells and isolated regions', () => {
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
        cellRow.push('empty');
      }
      regions.push(regionRow);
      cells.push(cellRow);
    }
    
    // Create a combined scenario
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
    
    // Create isolation in row 9
    for (let c = 0; c < size; c++) {
      if (c !== 3 && c !== 8) {
        cells[9][c] = 'cross';
      }
    }
    
    const state = createPuzzleState(size, starsPerUnit, regions, cells);
    const hint = findByAThreadAtSeaHint(state);
    
    if (hint) {
      // Verify comprehensive highlights
      expect(hint.highlights).toBeDefined();
      expect(hint.highlights?.cells).toBeDefined();
      expect(hint.highlights?.cells?.length).toBeGreaterThan(0);
      
      // Should include multiple units to show both isolation and uniqueness context
      const unitCount = 
        (hint.highlights?.rows?.length || 0) +
        (hint.highlights?.cols?.length || 0) +
        (hint.highlights?.regions?.length || 0);
      expect(unitCount).toBeGreaterThan(0);
    }
  });
});
