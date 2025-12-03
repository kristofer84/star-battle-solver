import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleDef, createEmptyPuzzleState, type PuzzleState } from '../src/types/puzzle';
import { findCrossEmptyPatternsHint } from '../src/logic/techniques/crossEmptyPatterns';

describe('Cross-Empty Patterns technique', () => {
  describe('Row with 5 adjacent empty cells', () => {
    it('places crosses vertically adjacent to 2nd and 4th empty spots in a row', () => {
      /**
       * Scenario: Row has 5 crosses and 5 adjacent empty cells.
       * Crosses can be placed vertically adjacent (above/below) to the 2nd and 4th empty spots.
       */
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Row 5: place 5 crosses
      const crossesInRow = [0, 1, 2, 3, 4];
      for (const col of crossesInRow) {
        state.cells[5][col] = 'cross';
      }
      // Cells (5, 5), (5, 6), (5, 7), (5, 8), (5, 9) remain empty and are adjacent
      
      const hint = findCrossEmptyPatternsHint(state);
      
      expect(hint).not.toBeNull();
      if (hint) {
        expect(hint.technique).toBe('cross-empty-patterns');
        expect(hint.kind).toBe('place-cross');
        expect(hint.resultCells.length).toBeGreaterThan(0);
        
        // The 2nd empty spot is at (5, 6) and 4th is at (5, 8)
        // Should find cells vertically adjacent to these positions (above/below row 5)
        const crosses = hint.resultCells;
        
        // Check for vertical adjacency (above/below row 5)
        const above2nd = crosses.find(c => c.row === 4 && c.col === 6);
        const below2nd = crosses.find(c => c.row === 6 && c.col === 6);
        const above4th = crosses.find(c => c.row === 4 && c.col === 8);
        const below4th = crosses.find(c => c.row === 6 && c.col === 8);
        
        // Should have at least some vertically adjacent cells (depending on boundaries)
        const hasVertical = (above2nd !== undefined || below2nd !== undefined || 
                           above4th !== undefined || below4th !== undefined);
        expect(hasVertical).toBe(true);
        
        // Should NOT have horizontally adjacent cells (same row)
        const horizontal = crosses.filter(c => c.row === 5);
        expect(horizontal.length).toBe(0);
        
        // Verify explanation mentions the row and vertical adjacency
        expect(hint.explanation).toContain('Row 5');
        expect(hint.explanation.toLowerCase()).toContain('vertically');
      }
    });

    it('places crosses horizontally adjacent to 2nd and 4th empty spots in a column', () => {
      /**
       * Scenario: Column has 5 crosses and 5 adjacent empty cells.
       * Crosses can be placed horizontally adjacent (left/right) to the 2nd and 4th empty spots.
       */
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Column 5: place 5 crosses
      const crossesInCol = [0, 1, 2, 3, 4];
      for (const row of crossesInCol) {
        state.cells[row][5] = 'cross';
      }
      // Cells (5, 5), (6, 5), (7, 5), (8, 5), (9, 5) remain empty and are adjacent
      
      const hint = findCrossEmptyPatternsHint(state);
      
      expect(hint).not.toBeNull();
      if (hint) {
        expect(hint.technique).toBe('cross-empty-patterns');
        expect(hint.kind).toBe('place-cross');
        expect(hint.resultCells.length).toBeGreaterThan(0);
        
        // The 2nd empty spot is at (6, 5) and 4th is at (8, 5)
        // Should find cells horizontally adjacent to these positions (left/right of column 5)
        const crosses = hint.resultCells;
        
        // Check for horizontal adjacency (left/right of column 5)
        const left2nd = crosses.find(c => c.row === 6 && c.col === 4);
        const right2nd = crosses.find(c => c.row === 6 && c.col === 6);
        const left4th = crosses.find(c => c.row === 8 && c.col === 4);
        const right4th = crosses.find(c => c.row === 8 && c.col === 6);
        
        // Should have at least some horizontally adjacent cells (depending on boundaries)
        const hasHorizontal = (left2nd !== undefined || right2nd !== undefined || 
                             left4th !== undefined || right4th !== undefined);
        expect(hasHorizontal).toBe(true);
        
        // Should NOT have vertically adjacent cells (same column)
        const vertical = crosses.filter(c => c.col === 5);
        expect(vertical.length).toBe(0);
        
        // Verify explanation mentions the column and horizontal adjacency
        expect(hint.explanation).toContain('Column 5');
        expect(hint.explanation.toLowerCase()).toContain('horizontally');
      }
    });

    it('does not trigger when empty cells are not adjacent', () => {
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Row 5: place 5 crosses
      const crossesInRow = [0, 1, 2, 3, 4];
      for (const col of crossesInRow) {
        state.cells[5][col] = 'cross';
      }
      // Mark one more cell as cross to break adjacency
      state.cells[5][7] = 'cross';
      // Now cells (5, 5), (5, 6), (5, 8), (5, 9) are empty but not all adjacent
      // Actually, we need exactly 5 empty cells, so let's adjust
      // Cells (5, 5), (5, 6), (5, 8), (5, 9) = 4 empty, need one more
      // Let's make (5, 0) empty instead of cross
      state.cells[5][0] = 'empty';
      state.cells[5][4] = 'cross';
      
      // Now we have 5 empty cells: (5, 0), (5, 5), (5, 6), (5, 8), (5, 9)
      // These are NOT all adjacent
      
      const hint = findCrossEmptyPatternsHint(state);
      
      // Should not trigger for non-adjacent cells
      if (hint && hint.technique === 'cross-empty-patterns') {
        const explanation = hint.explanation.toLowerCase();
        if (explanation.includes('5 adjacent empty cells')) {
          // This would be wrong - the cells are not all adjacent
          expect(false).toBe(true); // Fail the test
        }
      }
    });
  });

  describe('Row with 2+3 split empty cells', () => {
    it('places crosses vertically adjacent to middle empty in group of 3 (row)', () => {
      /**
       * Scenario: Row has 5 crosses and 5 empty cells split as 2+3.
       * Crosses can be placed vertically adjacent (above/below) to the middle empty in the group of 3.
       */
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Row 5: place 5 crosses
      const crossesInRow = [0, 1, 2, 3, 4];
      for (const col of crossesInRow) {
        state.cells[5][col] = 'cross';
      }
      // Mark one more cell as cross to create 2+3 split
      state.cells[5][7] = 'cross';
      // Now we have: empty at (5, 5), (5, 6) = group of 2
      //              empty at (5, 8), (5, 9) = need one more for group of 3
      // Let's adjust: make (5, 4) empty, (5, 5) cross, (5, 6) empty, (5, 7) empty, (5, 8) empty
      state.cells[5][4] = 'empty';
      state.cells[5][5] = 'cross';
      state.cells[5][6] = 'empty';
      state.cells[5][7] = 'empty';
      state.cells[5][8] = 'empty';
      state.cells[5][9] = 'cross';
      
      // Now: (5, 4) empty (group of 1), (5, 5) cross, (5, 6), (5, 7), (5, 8) empty (group of 3), (5, 9) cross
      // Actually, we need exactly 5 empty: (5, 4), (5, 6), (5, 7), (5, 8), (5, 9)
      // But (5, 9) is marked as cross above. Let's fix:
      state.cells[5][9] = 'empty';
      
      // Now: (5, 4) empty, (5, 5) cross, (5, 6), (5, 7), (5, 8) empty (group of 3), (5, 9) empty
      // This gives us: group of 1 at (5, 4), group of 3 at (5, 6), (5, 7), (5, 8), group of 1 at (5, 9)
      // That's not 2+3. Let's try: (5, 0), (5, 1) empty (group of 2), (5, 5) cross, (5, 6), (5, 7), (5, 8) empty (group of 3)
      state.cells[5][0] = 'empty';
      state.cells[5][1] = 'empty';
      state.cells[5][2] = 'cross';
      state.cells[5][3] = 'cross';
      state.cells[5][4] = 'cross';
      state.cells[5][5] = 'cross';
      state.cells[5][6] = 'empty';
      state.cells[5][7] = 'empty';
      state.cells[5][8] = 'empty';
      state.cells[5][9] = 'cross';
      
      // Now: (5, 0), (5, 1) = group of 2, (5, 6), (5, 7), (5, 8) = group of 3
      // Total: 5 empty cells, 5 crosses
      
      const hint = findCrossEmptyPatternsHint(state);
      
      expect(hint).not.toBeNull();
      if (hint) {
        expect(hint.technique).toBe('cross-empty-patterns');
        expect(hint.kind).toBe('place-cross');
        expect(hint.resultCells.length).toBeGreaterThan(0);
        
        // The middle empty in the group of 3 is at (5, 7)
        // Should find cells vertically adjacent to this position (above/below row 5)
        const crosses = hint.resultCells;
        
        // Check for vertical adjacency (above/below row 5)
        const above = crosses.find(c => c.row === 4 && c.col === 7);
        const below = crosses.find(c => c.row === 6 && c.col === 7);
        
        // Should have at least some vertically adjacent cells
        const hasVertical = (above !== undefined || below !== undefined);
        expect(hasVertical).toBe(true);
        
        // Should NOT have horizontally adjacent cells (same row)
        const horizontal = crosses.filter(c => c.row === 5);
        expect(horizontal.length).toBe(0);
        
        // Verify explanation mentions the split and vertical adjacency
        expect(hint.explanation).toContain('Row 5');
        expect(hint.explanation.toLowerCase()).toContain('2+3');
        expect(hint.explanation.toLowerCase()).toContain('vertically');
      }
    });

    it('places crosses horizontally adjacent to middle empty in group of 3 (column)', () => {
      /**
       * Scenario: Column has 5 crosses and 5 empty cells split as 2+3.
       * Crosses can be placed horizontally adjacent (left/right) to the middle empty in the group of 3.
       */
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Column 5: create 2+3 split
      // Group of 2: (0, 5), (1, 5)
      // Group of 3: (6, 5), (7, 5), (8, 5)
      state.cells[0][5] = 'empty';
      state.cells[1][5] = 'empty';
      state.cells[2][5] = 'cross';
      state.cells[3][5] = 'cross';
      state.cells[4][5] = 'cross';
      state.cells[5][5] = 'cross';
      state.cells[6][5] = 'empty';
      state.cells[7][5] = 'empty';
      state.cells[8][5] = 'empty';
      state.cells[9][5] = 'cross';
      
      // Total: 5 empty cells, 5 crosses
      
      const hint = findCrossEmptyPatternsHint(state);
      
      expect(hint).not.toBeNull();
      if (hint) {
        expect(hint.technique).toBe('cross-empty-patterns');
        expect(hint.kind).toBe('place-cross');
        expect(hint.resultCells.length).toBeGreaterThan(0);
        
        // The middle empty in the group of 3 is at (7, 5)
        // Should find cells horizontally adjacent to this position (left/right of column 5)
        const crosses = hint.resultCells;
        
        // Check for horizontal adjacency (left/right of column 5)
        const left = crosses.find(c => c.row === 7 && c.col === 4);
        const right = crosses.find(c => c.row === 7 && c.col === 6);
        
        // Should have at least some horizontally adjacent cells
        const hasHorizontal = (left !== undefined || right !== undefined);
        expect(hasHorizontal).toBe(true);
        
        // Should NOT have vertically adjacent cells (same column)
        const vertical = crosses.filter(c => c.col === 5);
        expect(vertical.length).toBe(0);
        
        // Verify explanation mentions the split and horizontal adjacency
        expect(hint.explanation).toContain('Column 5');
        expect(hint.explanation.toLowerCase()).toContain('2+3');
        expect(hint.explanation.toLowerCase()).toContain('horizontally');
      }
    });
  });

  describe('Edge cases and validation', () => {
    it('does not trigger for 4+1 split (rejects 4+1 pattern)', () => {
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Row 5: create a 4+1 split (4 adjacent empty, 1 separate empty)
      // Group of 4: (5, 0), (5, 1), (5, 2), (5, 3)
      // Single: (5, 9)
      state.cells[5][0] = 'empty';
      state.cells[5][1] = 'empty';
      state.cells[5][2] = 'empty';
      state.cells[5][3] = 'empty';
      // Mark middle cells as crosses
      for (let col = 4; col < 9; col++) {
        state.cells[5][col] = 'cross';
      }
      state.cells[5][9] = 'empty';
      
      // Total: 5 empty cells, 5 crosses
      
      const hint = findCrossEmptyPatternsHint(state);
      
      // Should not trigger for 4+1 split
      if (hint && hint.technique === 'cross-empty-patterns') {
        const explanation = hint.explanation.toLowerCase();
        if (explanation.includes('2+3')) {
          // Should not trigger for 4+1
          expect(false).toBe(true); // Fail the test
        }
      }
    });

    it('does not trigger for 1+4 split (rejects 1+4 pattern)', () => {
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Row 5: create a 1+4 split (1 separate empty, 4 adjacent empty)
      // Single: (5, 0)
      // Group of 4: (5, 6), (5, 7), (5, 8), (5, 9)
      state.cells[5][0] = 'empty';
      // Mark middle cells as crosses
      for (let col = 1; col < 6; col++) {
        state.cells[5][col] = 'cross';
      }
      state.cells[5][6] = 'empty';
      state.cells[5][7] = 'empty';
      state.cells[5][8] = 'empty';
      state.cells[5][9] = 'empty';
      
      // Total: 5 empty cells, 5 crosses
      
      const hint = findCrossEmptyPatternsHint(state);
      
      // Should not trigger for 1+4 split
      if (hint && hint.technique === 'cross-empty-patterns') {
        const explanation = hint.explanation.toLowerCase();
        if (explanation.includes('2+3')) {
          // Should not trigger for 1+4
          expect(false).toBe(true); // Fail the test
        }
      }
    });

    it('does not trigger when row does not have exactly 5 crosses and 5 empty cells', () => {
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Row 5: place 4 crosses (not 5)
      const crossesInRow = [0, 1, 2, 3];
      for (const col of crossesInRow) {
        state.cells[5][col] = 'cross';
      }
      // 6 empty cells remain (not 5)
      
      const hint = findCrossEmptyPatternsHint(state);
      
      // Should not trigger
      if (hint && hint.technique === 'cross-empty-patterns') {
        // If it triggers, verify it's not for the 5-crosses-5-empty case
        const explanation = hint.explanation.toLowerCase();
        if (explanation.includes('5 crosses and 5')) {
          expect(false).toBe(true); // Fail
        }
      }
    });

    it('only returns crosses that are actually empty', () => {
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Row 5: place 5 crosses
      const crossesInRow = [0, 1, 2, 3, 4];
      for (const col of crossesInRow) {
        state.cells[5][col] = 'cross';
      }
      // Cells (5, 5) through (5, 9) remain empty and are adjacent
      
      // Pre-mark some adjacent cells as crosses
      state.cells[4][6] = 'cross';
      state.cells[6][8] = 'cross';
      
      const hint = findCrossEmptyPatternsHint(state);
      
      if (hint) {
        // Should only return empty cells, not already-marked crosses
        for (const cell of hint.resultCells) {
          expect(state.cells[cell.row][cell.col]).toBe('empty');
        }
      }
    });

    it('handles edge cases at grid boundaries', () => {
      const def = createEmptyPuzzleDef();
      const state = createEmptyPuzzleState(def);
      
      // Row 0 (top row): place 5 crosses
      const crossesInRow = [0, 1, 2, 3, 4];
      for (const col of crossesInRow) {
        state.cells[0][col] = 'cross';
      }
      // Cells (0, 5) through (0, 9) remain empty and are adjacent
      
      const hint = findCrossEmptyPatternsHint(state);
      
      if (hint) {
        expect(hint.technique).toBe('cross-empty-patterns');
        expect(hint.kind).toBe('place-cross');
        
        // Should only place crosses below (not above, since row 0 is at top)
        const crosses = hint.resultCells;
        const above = crosses.filter(c => c.row < 0);
        expect(above.length).toBe(0);
        
        // Should have some crosses below row 0
        const below = crosses.filter(c => c.row === 1);
        expect(below.length).toBeGreaterThan(0);
      }
    });
  });
});
