import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findCompositeShapesHint } from '../src/logic/techniques/compositeShapes';
import { rowCells, regionCells, intersection, union, difference, emptyCells, countStars } from '../src/logic/helpers';
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

describe('Debug Composite Shapes at Iteration 12', () => {
  it('should analyze what composite-shapes finds at iteration 12', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    // Apply all hints up to iteration 11
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
    ];

    for (let i = 0; i < hintsToApply.length; i++) {
      const cells = hintsToApply[i];
      const isStar = i === 1 || i === 9; // iterations 1 and 10 place stars
      for (const [r, c] of cells) {
        state.cells[r][c] = isStar ? 'star' : 'cross';
      }
    }

    console.log('\n=== STATE AT ITERATION 12 ===');
    const row5 = rowCells(state, 5);
    const row5Stars = countStars(state, row5);
    const row5Empties = emptyCells(state, row5);
    console.log(`Row 5: ${row5Stars} stars, ${row5Empties.length} empties`);
    console.log(`  Empty cells:`, row5Empties.map(c => `[${c.row},${c.col}]`).join(', '));
    console.log(`  Expected stars: [5,2] and [5,8]`);

    // Check what composite-shapes finds
    const hint = findCompositeShapesHint(state);
    if (hint) {
      console.log(`\nComposite-shapes hint found:`);
      console.log(`  Technique: ${hint.technique}`);
      console.log(`  Kind: ${hint.kind}`);
      console.log(`  Cells:`, hint.resultCells.map(c => `[${c.row},${c.col}]`));
      console.log(`  Explanation: ${hint.explanation}`);

      // Analyze which regions are involved
      if (hint.highlights.regions) {
        console.log(`\n  Regions involved: ${hint.highlights.regions.join(', ')}`);
        for (const regId of hint.highlights.regions) {
          const region = regionCells(state, regId);
          const regionStars = countStars(state, region);
          const regionEmpties = emptyCells(state, region);
          console.log(`    Region ${regId}: ${regionStars} stars, ${regionEmpties.length} empties`);
        }
      }

      if (hint.highlights.rows) {
        console.log(`\n  Row involved: ${hint.highlights.rows[0]}`);
      }
    } else {
      console.log('\nNo composite-shapes hint found');
    }

    // Check all region pairs that intersect with row 5
    console.log('\n=== CHECKING ALL REGION PAIRS ===');
    for (let reg1 = 1; reg1 <= 10; reg1++) {
      for (let reg2 = reg1 + 1; reg2 <= 10; reg2++) {
        const region1 = regionCells(state, reg1);
        const region2 = regionCells(state, reg2);
        const unionRegions = union(region1, region2);
        const shape = intersection(row5, unionRegions);
        if (shape.length === 0) continue;
        
        const empties = emptyCells(state, shape);
        if (empties.length === 0) continue;

        const reg1Stars = countStars(state, region1);
        const reg2Stars = countStars(state, region2);
        const reg1Remaining = 2 - reg1Stars;
        const reg2Remaining = 2 - reg2Stars;
        
        if (reg1Remaining <= 0 || reg2Remaining <= 0) continue;

        const rowOutsideIntersection = difference(row5, shape);
        const unionOutsideIntersection = difference(unionRegions, shape);
        const emptyCellsInRowOutside = emptyCells(state, rowOutsideIntersection).length;
        const emptyCellsInUnionOutside = emptyCells(state, unionOutsideIntersection).length;
        const rowRemaining = 2 - row5Stars;
        const unionRemaining = Math.max(reg1Remaining, reg2Remaining);
        const minStarsInIntersection = Math.max(
          0,
          rowRemaining - emptyCellsInRowOutside,
          unionRemaining - emptyCellsInUnionOutside
        );

        console.log(`\n  Row 5 ∩ Union(Region ${reg1}, Region ${reg2}):`);
        console.log(`    Intersection empties:`, empties.map(c => `[${c.row},${c.col}]`).join(', '));
        console.log(`    Row remaining: ${2 - row5Stars}, Row empties outside: ${emptyCellsInRowOutside}`);
        console.log(`    Union remaining: ${unionRemaining}, Union empties outside: ${emptyCellsInUnionOutside}`);
        console.log(`    Min stars in intersection: ${minStarsInIntersection}`);
        console.log(`    Match? ${minStarsInIntersection === empties.length ? 'YES' : 'NO'}`);
      }
    }
  });
});
