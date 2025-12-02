import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { rowCells, colCells, regionCells, emptyCells, countStars } from '../src/logic/helpers';
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

const EXPECTED_STARS: [number, number][] = [
  [0, 3], [0, 6],
  [1, 1], [1, 8],
  [2, 3], [2, 5],
  [3, 0], [3, 9],
  [4, 4], [4, 6],
  [5, 2], [5, 8],
  [6, 0], [6, 5],
  [7, 2], [7, 7],
  [8, 4], [8, 9],
  [9, 1], [9, 7],
];

function applyHint(state: PuzzleState) {
  const hint = findNextHint(state);
  if (!hint) return null;
  
  for (const cell of hint.resultCells) {
    const value = hint.kind === 'place-star' ? 'star' : 'cross';
    state.cells[cell.row][cell.col] = value;
  }
  
  return hint;
}

describe('Find Easy Stars', () => {
  it('should identify easy star placements that are being missed', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    console.log('\n=== APPLYING HINTS AND LOOKING FOR EASY STARS ===\n');
    
    const expectedSet = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));
    
    // Apply first 10 hints
    for (let i = 0; i < 10; i++) {
      const hint = applyHint(state);
      if (!hint) break;
      
      console.log(`\nIteration ${i}: ${hint.technique} (${hint.kind})`);
      console.log(`  Cells:`, hint.resultCells.map(c => `[${c.row},${c.col}]`).join(', '));
    }
    
    console.log('\n\n=== CHECKING FOR EASY STAR PLACEMENTS ===\n');
    
    // Check each region to see if there are obvious star placements
    for (let regionId = 1; regionId <= 10; regionId++) {
      const region = regionCells(state, regionId);
      const empties = emptyCells(state, region);
      const stars = countStars(state, region);
      const remaining = 2 - stars;
      
      if (remaining === 0) continue;
      
      // Check if empties == remaining (all empties must be stars)
      if (empties.length === remaining) {
        const allExpected = empties.every(c => expectedSet.has(`${c.row},${c.col}`));
        if (allExpected) {
          console.log(`Region ${regionId}: Has ${empties.length} empties, needs ${remaining} stars`);
          console.log(`  ✓ All empties should be stars:`, empties.map(c => `[${c.row},${c.col}]`).join(', '));
        }
      }
    }
    
    // Check each row
    for (let r = 0; r < 10; r++) {
      const row = rowCells(state, r);
      const empties = emptyCells(state, row);
      const stars = countStars(state, row);
      const remaining = 2 - stars;
      
      if (remaining === 0) continue;
      
      if (empties.length === remaining) {
        const allExpected = empties.every(c => expectedSet.has(`${c.row},${c.col}`));
        if (allExpected) {
          console.log(`Row ${r} (0-indexed): Has ${empties.length} empties, needs ${remaining} stars`);
          console.log(`  ✓ All empties should be stars:`, empties.map(c => `[${c.row},${c.col}]`).join(', '));
        }
      }
    }
    
    // Check each column
    for (let c = 0; c < 10; c++) {
      const col = colCells(state, c);
      const empties = emptyCells(state, col);
      const stars = countStars(state, col);
      const remaining = 2 - stars;
      
      if (remaining === 0) continue;
      
      if (empties.length === remaining) {
        const allExpected = empties.every(cell => expectedSet.has(`${cell.row},${cell.col}`));
        if (allExpected) {
          console.log(`Column ${c} (0-indexed): Has ${empties.length} empties, needs ${remaining} stars`);
          console.log(`  ✓ All empties should be stars:`, empties.map(cell => `[${cell.row},${cell.col}]`).join(', '));
        }
      }
    }
  });
});
