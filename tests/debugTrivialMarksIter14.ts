import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findTrivialMarksHint } from '../src/logic/techniques/trivialMarks';
import { rowCells, colCells, regionCells, countStars, emptyCells } from '../src/logic/helpers';
import type { PuzzleState } from '../src/types/puzzle';

const EXAMPLE_REGIONS = [
  [10, 10, 10, 1, 1, 1, 2, 2, 3, 3],
  [10, 10, 10, 1, 1, 1, 2, 2, 3, 3],
  [4, 4, 10, 10, 1, 2, 2, 2, 2, 3],
  [4, 10, 10, 10, 1, 2, 2, 3, 2, 3],
  [4, 10, 5, 10, 1, 7, 7, 3, 3, 3],
  [4, 10, 5, 1, 1, 7, 3, 3, 9, 3],
  [4, 5, 5, 5, 1, 7, 3, 8, 9, 3],
  [4, 4, 5, 5, 5, 5, 5, 8, 9, 9],
  [4, 4, 6, 6, 6, 5, 5, 8, 9, 9],
  [6, 6, 6, 5, 5, 5, 5, 8, 9, 9],
];

describe('Debug Trivial Marks at Iteration 14', () => {
  it('should analyze what trivial-marks finds at iteration 14', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    // Apply all hints up to iteration 13
    const hintsToApply = [
      // Iter 0: simple-shapes crosses
      [[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,6],[7,6],[8,6],[9,6],[6,8],[7,8],[8,8],[9,8]],
      // Iter 1: simple-shapes star
      [[6,5]],
      // Iter 2: trivial-marks crosses
      [[5,4],[5,5],[5,6],[6,4],[7,4],[7,5]],
      // Iter 3: simple-shapes crosses
      [[8,1],[9,3]],
      // Iter 4-6: pressured-exclusion crosses
      [[3,5],[3,6],[1,5]],
      // Iter 7-9: by-a-thread crosses
      [[0,0],[0,1],[0,2]],
      // Iter 10: by-a-thread star
      [[0,3]],
      // Iter 11: trivial-marks crosses
      [[0,4],[1,2],[1,3],[1,4]],
      // Iter 12: composite-shapes star (still happening - need to check why)
      [[5,3]], // Still happening despite the fix
      // Iter 13: trivial-marks crosses
      [[2,3],[3,3],[4,3],[6,3],[7,3],[8,3]],
    ];

    for (let i = 0; i < hintsToApply.length; i++) {
      const cells = hintsToApply[i];
      const isStar = i === 1 || i === 9; // iterations 1 and 10 place stars
      for (const [r, c] of cells) {
        state.cells[r][c] = isStar ? 'star' : 'cross';
      }
    }

    console.log('\n=== STATE AT ITERATION 14 ===');
    
    // Check row 4 specifically
    const row4 = rowCells(state, 4);
    const row4Stars = countStars(state, row4);
    const row4Empties = emptyCells(state, row4);
    console.log(`\nRow 4: ${row4Stars} stars, ${row4Empties.length} empties`);
    console.log(`  Stars:`, row4.map(c => state.cells[c.row][c.col] === 'star' ? `[${c.row},${c.col}]` : null).filter(x => x));
    console.log(`  Empty cells:`, row4Empties.map(c => `[${c.row},${c.col}]`).join(', '));
    console.log(`  Expected stars: [4,4] and [4,6]`);
    console.log(`  Current state of row 4:`);
    for (let c = 0; c < 10; c++) {
      const val = state.cells[4][c];
      const symbol = val === 'star' ? 'S' : val === 'cross' ? '×' : '.';
      console.log(`    [4,${c}]: ${symbol}`);
    }

    // Check column 4
    const col4 = colCells(state, 4);
    const col4Stars = countStars(state, col4);
    const col4Empties = emptyCells(state, col4);
    console.log(`\nColumn 4: ${col4Stars} stars, ${col4Empties.length} empties`);
    console.log(`  Empty cells:`, col4Empties.map(c => `[${c.row},${c.col}]`).join(', '));

    // Check region 1 (which contains [4,4])
    const region1 = regionCells(state, 1);
    const region1Stars = countStars(state, region1);
    const region1Empties = emptyCells(state, region1);
    console.log(`\nRegion 1: ${region1Stars} stars, ${region1Empties.length} empties`);
    console.log(`  Empty cells:`, region1Empties.map(c => `[${c.row},${c.col}]`).join(', '));

    // Check what trivial-marks finds
    const hint = findTrivialMarksHint(state);
    if (hint) {
      console.log(`\nTrivial-marks hint found:`);
      console.log(`  Technique: ${hint.technique}`);
      console.log(`  Kind: ${hint.kind}`);
      console.log(`  Cells:`, hint.resultCells.map(c => `[${c.row},${c.col}]`));
      console.log(`  Explanation: ${hint.explanation}`);
      
      if (hint.highlights.rows) {
        console.log(`  Row involved: ${hint.highlights.rows[0]}`);
        const row = rowCells(state, hint.highlights.rows[0]);
        const rowStars = countStars(state, row);
        const rowEmpties = emptyCells(state, row);
        console.log(`    Row ${hint.highlights.rows[0]} has ${rowStars} stars, ${rowEmpties.length} empties`);
      }
    } else {
      console.log('\nNo trivial-marks hint found');
    }
  });
});
