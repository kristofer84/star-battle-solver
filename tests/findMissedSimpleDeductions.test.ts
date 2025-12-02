import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
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

describe('Find Missed Simple Deductions', () => {
  it('should identify what simple deductions are missed at each step', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    const expectedSet = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));
    
    console.log('\n=== ANALYZING MISSED SIMPLE DEDUCTIONS ===\n');
    
    // Apply hints and check for missed opportunities after each step
    for (let iteration = 0; iteration < 20; iteration++) {
      const hint = applyHint(state);
      if (!hint) {
        console.log(`\nNo more hints found at iteration ${iteration}`);
        break;
      }
      
      console.log(`\nIteration ${iteration}: ${hint.technique} (${hint.kind})`);
      console.log(`  Cells:`, hint.resultCells.map(c => `[${c.row},${c.col}]`).join(', '));
      
      // After applying the hint, check for obvious missed deductions
      const missedDeductions = findMissedSimpleDeductions(state, expectedSet);
      
      if (missedDeductions.length > 0) {
        console.log(`\n  ⚠️  MISSED SIMPLE DEDUCTIONS:`);
        missedDeductions.forEach(missed => {
          console.log(`    ${missed}`);
        });
      }
    }
  });
});

function findMissedSimpleDeductions(state: PuzzleState, expectedSet: Set<string>): string[] {
  const missed: string[] = [];
  
  // Check each row
  for (let r = 0; r < 10; r++) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowEmpties = emptyCells(state, row);
    
    // If row needs exactly as many stars as it has empties, all empties should be stars
    if (rowStars < 2 && rowEmpties.length === 2 - rowStars) {
      const allAreExpected = rowEmpties.every(cell => expectedSet.has(`${cell.row},${cell.col}`));
      if (allAreExpected) {
        missed.push(`Row ${r + 1}: Has ${rowEmpties.length} empties and needs ${2 - rowStars} stars - all empties should be stars!`);
      }
    }
    
    // If row is full, all empties should be crosses
    if (rowStars === 2 && rowEmpties.length > 0) {
      missed.push(`Row ${r + 1}: Already has 2 stars but still has ${rowEmpties.length} empties - should all be crosses!`);
    }
  }
  
  // Check each column
  for (let c = 0; c < 10; c++) {
    const col = colCells(state, c);
    const colStars = countStars(state, col);
    const colEmpties = emptyCells(state, col);
    
    // If column needs exactly as many stars as it has empties, all empties should be stars
    if (colStars < 2 && colEmpties.length === 2 - colStars) {
      const allAreExpected = colEmpties.every(cell => expectedSet.has(`${cell.row},${cell.col}`));
      if (allAreExpected) {
        missed.push(`Column ${c + 1}: Has ${colEmpties.length} empties and needs ${2 - colStars} stars - all empties should be stars!`);
      }
    }
    
    // If column is full, all empties should be crosses
    if (colStars === 2 && colEmpties.length > 0) {
      missed.push(`Column ${c + 1}: Already has 2 stars but still has ${colEmpties.length} empties - should all be crosses!`);
    }
  }
  
  // Check each region
  for (let regionId = 1; regionId <= 10; regionId++) {
    const region = regionCells(state, regionId);
    const regionStars = countStars(state, region);
    const regionEmpties = emptyCells(state, region);
    
    // If region needs exactly as many stars as it has empties, all empties should be stars
    if (regionStars < 2 && regionEmpties.length === 2 - regionStars) {
      const allAreExpected = regionEmpties.every(cell => expectedSet.has(`${cell.row},${cell.col}`));
      if (allAreExpected) {
        missed.push(`Region ${regionId}: Has ${regionEmpties.length} empties and needs ${2 - regionStars} stars - all empties should be stars!`);
      }
    }
    
    // If region is full, all empties should be crosses
    if (regionStars === 2 && regionEmpties.length > 0) {
      missed.push(`Region ${regionId}: Already has 2 stars but still has ${regionEmpties.length} empties - should all be crosses!`);
    }
  }
  
  return missed;
}
