import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findAdjacentExclusionHint } from '../src/logic/techniques/adjacentExclusion';
import { neighbors8, regionCells, emptyCells, countStars } from '../src/logic/helpers';

describe('Debug Adjacent Exclusion 2', () => {
  it('debugs the actual scenario', () => {
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

    // Mark region 7 cells as empty (except {7,0} and {8,0} which we'll mark as cross)
    // {8,0} is also a valid exclusion (region 6 needs stars), so mark it as cross first
    state.cells[8][0] = 'cross'; // {8,0} - region 7, but excluded by region 6 pattern
    state.cells[8][2] = 'empty'; // {8,2} - region 7
    state.cells[9][0] = 'empty'; // {9,0} - region 7
    state.cells[9][1] = 'empty'; // {9,1} - region 7
    state.cells[9][2] = 'empty'; // {9,2} - region 7
    state.cells[8][1] = 'empty'; // {8,1} - region 6, should be excluded

    // Check region 7
    const region7 = regionCells(state, 7);
    const region7Stars = countStars(state, region7);
    const region7Empties = emptyCells(state, region7);
    console.log('Region 7 stars:', region7Stars);
    console.log('Region 7 empties:', region7Empties.map(c => `{${c.row},${c.col}}`));
    console.log('Region 7 needs:', 2 - region7Stars);

    // Check {8,1} neighbors
    const testCell = { row: 8, col: 1 };
    const nbs = neighbors8(testCell, 10);
    console.log('Neighbors of {8,1}:', nbs.map(n => `{${n.row},${n.col}}`));
    
    // Check if all region 7 empties are adjacent to {8,1}
    const allAdj = region7Empties.every(c => 
      nbs.some(n => n.row === c.row && n.col === c.col)
    );
    console.log('Are all region 7 empties adjacent to {8,1}?', allAdj);
    
    // Check which cells can contain stars (not adjacent to existing stars)
    const possiblePlacements = region7Empties.filter(cell => {
      const cellNbs = neighbors8(cell, 10);
      return !cellNbs.some(nb => state.cells[nb.row][nb.col] === 'star');
    });
    console.log('Possible placements in region 7:', possiblePlacements.map(c => `{${c.row},${c.col}}`));
    
    // Check if all possible placements are adjacent to {8,1}
    const allPossibleAdj = possiblePlacements.every(cell => 
      nbs.some(n => n.row === cell.row && n.col === cell.col)
    );
    console.log('Are all possible placements adjacent to {8,1}?', allPossibleAdj);
    
    // Check what region {8,1} is in
    console.log('{8,1} is in region:', regions[8][1]);
    
    const hint = findAdjacentExclusionHint(state);
    console.log('Hint found:', hint);
    if (hint) {
      console.log('Result cells:', hint.resultCells);
      console.log('Explanation:', hint.explanation);
    }
    
    expect(hint).not.toBeNull();
    if (hint) {
      expect(hint.resultCells).toContainEqual({ row: 8, col: 1 });
    }
  });
});
