import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findAdjacentExclusionHint } from '../src/logic/techniques/adjacentExclusion';

describe('Adjacent Exclusion', () => {
  it('detects that {8,1} must be a cross when all possible star placements in region 7 are adjacent', () => {
    // User's puzzle scenario:
    // Region 7 needs stars, and all possible placements {7,0},{8,0},{9,0},{9,1},{9,2},{8,2}
    // are adjacent to {8,1}. Therefore {8,1} must be a cross.

    const regions = [
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      [0, 2, 2, 2, 2, 2, 1, 1, 1, 1],
      [2, 2, 3, 4, 4, 4, 1, 1, 5, 5],
      [2, 2, 3, 4, 4, 4, 5, 5, 5, 5],
      [2, 6, 3, 3, 3, 4, 4, 4, 5, 5],
      [7, 6, 3, 3, 3, 3, 3, 4, 5, 9],
      [7, 6, 6, 6, 3, 4, 4, 4, 5, 9],
      [7, 6, 6, 6, 3, 3, 3, 4, 8, 9],
      [7, 6, 7, 6, 8, 8, 8, 8, 8, 9],
      [7, 7, 7, 8, 8, 9, 9, 9, 9, 9],
    ];

    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Mark all cells as cross first
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        state.cells[r][c] = 'cross';
      }
    }

    // Mark region 7 cells as empty (these are the only possible placements)
    // Region 7 = {7,0}, {8,0}, {8,2}, {9,0}, {9,1}, {9,2}
    state.cells[7][0] = 'empty'; // {7,0} - region 7
    state.cells[8][0] = 'empty'; // {8,0} - region 7
    state.cells[8][2] = 'empty'; // {8,2} - region 7
    state.cells[9][0] = 'empty'; // {9,0} - region 7
    state.cells[9][1] = 'empty'; // {9,1} - region 7
    state.cells[9][2] = 'empty'; // {9,2} - region 7
    
    // Mark {8,1} as empty - this should be detected as needing a cross
    // {8,1} is in region 6, not region 7
    state.cells[8][1] = 'empty';

    // Region 7 needs 2 stars total and has 0 stars, so needs 2 stars
    // At least 1 star must be placed in these 6 cells
    // All 6 are adjacent to {8,1}, so {8,1} cannot be a star
    
    // Mark {7,0}, {8,0}, {8,2} as cross to ensure {8,1} is found
    // This simulates the case where those cells were already excluded by other techniques
    // Note: {8,0} is also a valid exclusion (region 6 pattern), so we mark it as cross first
    state.cells[7][0] = 'cross';
    state.cells[8][0] = 'cross'; // Excluded by region 6 pattern
    state.cells[8][2] = 'cross';
    
    // Now region 7 has only {9,0}, {9,1}, {9,2} as empty cells
    // Region 7 needs 2 stars, so at least 1 must be in these 3 cells
    // All 3 are adjacent to {8,1}, so {8,1} cannot be a star
    
    const hint = findAdjacentExclusionHint(state);
    
    // The hint should mark {8,1} as a cross
    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.technique).toBe('adjacent-exclusion');
    
    // Check that {8,1} is in the result
    const has81 = hint?.resultCells.some(c => c.row === 8 && c.col === 1);
    expect(has81).toBe(true);
    
    if (!has81 && hint) {
      // Debug: show what was actually found
      console.error('Expected {8,1} but found:', hint.resultCells);
      console.error('Explanation:', hint.explanation);
    }
  });

  it('detects {8,1} as cross with full region 7 scenario including overlapping and non-overlapping placements', () => {
    // User's exact scenario:
    // Region 7 needs 2 stars
    // Region 7 cells: {7,0}, {8,0}, {8,2}, {9,0}, {9,1}, {9,2}
    // {8,1} is in region 6 and is adjacent to all possible star placements
    // The technique should find all valid ways to place 2 non-adjacent stars
    // and check overlapping + non-overlapping placements

    const regions = [
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      [0, 2, 2, 2, 2, 2, 1, 1, 1, 1],
      [2, 2, 3, 4, 4, 4, 1, 1, 5, 5],
      [2, 2, 3, 4, 4, 4, 5, 5, 5, 5],
      [2, 6, 3, 3, 3, 4, 4, 4, 5, 5],
      [7, 6, 3, 3, 3, 3, 3, 4, 5, 9],
      [7, 6, 6, 6, 3, 4, 4, 4, 5, 9],
      [7, 6, 6, 6, 3, 3, 3, 4, 8, 9],
      [7, 6, 7, 6, 8, 8, 8, 8, 8, 9],
      [7, 7, 7, 8, 8, 9, 9, 9, 9, 9],
    ];

    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions,
    });

    // Mark all cells as cross first
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        state.cells[r][c] = 'cross';
      }
    }

    // Mark region 7 cells as empty: {7,0}, {8,0}, {8,2}, {9,0}, {9,1}, {9,2}
    state.cells[7][0] = 'empty'; // {7,0}
    state.cells[8][0] = 'empty'; // {8,0}
    state.cells[8][2] = 'empty'; // {8,2}
    state.cells[9][0] = 'empty'; // {9,0}
    state.cells[9][1] = 'empty'; // {9,1}
    state.cells[9][2] = 'empty'; // {9,2}

    // Mark {8,1} as empty - this should be detected as needing a cross
    // {8,1} is in region 6, not region 7
    state.cells[8][1] = 'empty';

    // Region 7 needs 2 stars
    // Valid placements for 2 non-adjacent stars in region 7:
    // - {7,0} + {9,1} (not adjacent)
    // - {7,0} + {9,2} (not adjacent)
    // - {8,0} + {9,2} (not adjacent)
    // - {8,2} + {9,0} (not adjacent)
    // - {8,2} + {9,1} (not adjacent)
    // - {9,0} + {9,2} (adjacent - invalid!)
    // So valid sets: [{7,0}, {9,1}], [{7,0}, {9,2}], [{8,0}, {9,2}], [{8,2}, {9,0}], [{8,2}, {9,1}]
    //
    // Overlapping cells (appear in all sets): none
    // But wait, let me check: {7,0} appears in 2 sets, {8,0} in 1, {8,2} in 2, {9,0} in 1, {9,1} in 2, {9,2} in 3
    // Actually, no cell appears in ALL sets, so overlapping is empty
    // Non-overlapping: all cells that appear in at least one set
    // {8,1} is adjacent to: {7,0}, {8,0}, {8,2}, {9,0}, {9,1}, {9,2} - all of them!
    // So {8,1} should be excluded

    const hint = findAdjacentExclusionHint(state);

    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.technique).toBe('adjacent-exclusion');

    const has81 = hint?.resultCells.some(c => c.row === 8 && c.col === 1);
    expect(has81).toBe(true);

    if (!has81 && hint) {
      console.error('Expected {8,1} but found:', hint.resultCells);
      console.error('Explanation:', hint.explanation);
      console.error('Highlighted cells:', hint.highlights?.cells);
    }
  });
});
