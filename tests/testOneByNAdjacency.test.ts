import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findExactFillHint } from '../src/logic/techniques/exactFill';
import { validateState } from '../src/logic/validation';

describe('Exact Fill Adjacency Check', () => {
  it('should not place adjacent stars in a column', () => {
    // Create a 10x10 puzzle with 2 stars per unit
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: Array(10).fill(null).map(() => Array(10).fill(1)), // All cells in region 1 for simplicity
    });

    // Set up a column (column 4) where:
    // - It needs 2 more stars
    // - It has exactly 2 empty cells left
    // - But those 2 empty cells are adjacent (rows 8 and 9)
    
    // Place stars in other positions in column 4 to make it need 2 more
    // Actually, let's make column 4 have 0 stars and 2 adjacent empty cells
    
    // Mark all cells in column 4 as empty except rows 8 and 9
    for (let r = 0; r < 10; r++) {
      if (r !== 8 && r !== 9) {
        state.cells[r][4] = 'cross'; // Mark as cross so they're not empty
      }
    }
    
    // Column 4 now has:
    // - 0 stars
    // - 2 empty cells at (8,4) and (9,4) - these are adjacent!
    // - Needs 2 stars
    
    // The exactFill technique should NOT suggest placing stars here
    const hint = findExactFillHint(state);
    
    if (hint && hint.technique === 'exact-fill') {
      // If a hint is found, verify it doesn't place adjacent stars
      const cells = hint.resultCells;
      
      // Check if any cells are adjacent
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const dr = Math.abs(cells[i].row - cells[j].row);
          const dc = Math.abs(cells[i].col - cells[j].col);
          const areAdjacent = dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
          
          if (areAdjacent) {
            // Apply the hint and check for validation errors
            for (const cell of hint.resultCells) {
              state.cells[cell.row][cell.col] = 'star';
            }
            
            const errors = validateState(state);
            expect(errors.length).toBe(0); // Should not have errors if hint is valid
          }
        }
      }
    }
    
    // The technique should either return null or return a hint that doesn't place adjacent stars
    // If it returns a hint for column 4, that's the bug
    if (hint && hint.technique === 'exact-fill') {
      const isColumn4Hint = hint.resultCells.some(c => c.col === 4);
      if (isColumn4Hint) {
        // Check if it's placing stars in adjacent cells
        const cells = hint.resultCells.filter(c => c.col === 4);
        if (cells.length === 2) {
          const dr = Math.abs(cells[0].row - cells[1].row);
          const dc = Math.abs(cells[0].col - cells[1].col);
          const areAdjacent = dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
          expect(areAdjacent).toBe(false); // Should not be adjacent
        }
      }
    }
  });

  it('should not place stars adjacent to existing stars', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: Array(10).fill(null).map(() => Array(10).fill(1)),
    });

    // Set up column 5 where:
    // - It has 1 star already at (7,5)
    // - It needs 1 more star
    // - It has 1 empty cell at (8,5) which is adjacent to the star at (7,5)
    
    // Place a star at (7,5)
    state.cells[7][5] = 'star';
    
    // Mark all other cells in column 5 as crosses except (8,5)
    for (let r = 0; r < 10; r++) {
      if (r !== 7 && r !== 8) {
        state.cells[r][5] = 'cross';
      }
    }
    
    // Column 5 now has:
    // - 1 star at (7,5)
    // - 1 empty cell at (8,5) - adjacent to the star!
    // - Needs 1 more star
    
    // The exactFill technique should NOT suggest placing a star at (8,5)
    const hint = findExactFillHint(state);
    
    if (hint && hint.technique === 'exact-fill') {
      const isColumn5Hint = hint.resultCells.some(c => c.col === 5);
      if (isColumn5Hint) {
        // Should not place star at (8,5) since it's adjacent to (7,5)
        const hasAdjacentStar = hint.resultCells.some(c => c.row === 8 && c.col === 5);
        expect(hasAdjacentStar).toBe(false);
      }
    }
  });
});
