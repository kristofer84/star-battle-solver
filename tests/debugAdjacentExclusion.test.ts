import { describe, expect, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findAdjacentExclusionHint } from '../src/logic/techniques/adjacentExclusion';
import { neighbors8 } from '../src/logic/helpers';

describe('Debug Adjacent Exclusion', () => {
  it('verifies adjacency relationships', () => {
    const testCell = { row: 7, col: 0 };
    const nbs = neighbors8(testCell, 10);
    console.log('Neighbors of {7,0}:', nbs.map(n => `{${n.row},${n.col}}`).join(', '));
    console.log('Is {8,2} adjacent to {7,0}?', nbs.some(n => n.row === 8 && n.col === 2));
    
    const testCell2 = { row: 8, col: 1 };
    const nbs2 = neighbors8(testCell2, 10);
    const region7Cells = [
      {row:7,col:0},
      {row:8,col:0},
      {row:8,col:2},
      {row:9,col:0},
      {row:9,col:1},
      {row:9,col:2}
    ];
    const allAdj = region7Cells.every(c => nbs2.some(n => n.row === c.row && n.col === c.col));
    console.log('Are all region 7 cells adjacent to {8,1}?', allAdj);
    console.log('Neighbors of {8,1}:', nbs2.map(n => `{${n.row},${n.col}}`).join(', '));
    
    expect(allAdj).toBe(true);
  });
  
  it('checks what hint is found', () => {
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

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        state.cells[r][c] = 'cross';
      }
    }

    state.cells[7][0] = 'empty';
    state.cells[8][0] = 'empty';
    state.cells[8][2] = 'empty';
    state.cells[9][0] = 'empty';
    state.cells[9][1] = 'empty';
    state.cells[9][2] = 'empty';
    state.cells[8][1] = 'empty';

    const hint = findAdjacentExclusionHint(state);
    console.log('Hint found:', hint);
    if (hint) {
      console.log('Result cells:', hint.resultCells);
      console.log('Explanation:', hint.explanation);
    }
    
    expect(hint).not.toBeNull();
  });
});
