import { describe, it } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
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

describe('Check Indexing Issue', () => {
  it('should verify that row/col numbers in explanations match actual array indices', () => {
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions: EXAMPLE_REGIONS,
    });

    console.log('\n=== CHECKING FOR INDEXING ISSUES ===\n');
    console.log('Expected stars (0-indexed):');
    EXPECTED_STARS.forEach(([r, c]) => {
      console.log(`  [${r},${c}] = Row ${r+1}, Col ${c+1} (1-indexed)`);
    });

    console.log('\n=== ANALYZING FIRST FEW HINTS ===\n');
    
    for (let iteration = 0; iteration < 15; iteration++) {
      const hint = applyHint(state);
      if (!hint) {
        console.log(`\nNo more hints found at iteration ${iteration}`);
        break;
      }
      
      console.log(`\nIteration ${iteration}: ${hint.technique} (${hint.kind})`);
      console.log(`  Explanation: ${hint.explanation}`);
      console.log(`  Cells (0-indexed):`, hint.resultCells.map(c => `[${c.row},${c.col}]`).join(', '));
      console.log(`  Cells (1-indexed):`, hint.resultCells.map(c => `[${c.row+1},${c.col+1}]`).join(', '));
      
      // Check if explanation mentions row/column numbers
      const rowMatch = hint.explanation.match(/Row (\d+)/);
      const colMatch = hint.explanation.match(/Column (\d+)/);
      const regionMatch = hint.explanation.match(/[Rr]egion (\d+)/);
      
      if (rowMatch) {
        const mentionedRow = parseInt(rowMatch[1]);
        const actualRows = [...new Set(hint.resultCells.map(c => c.row))];
        console.log(`  ⚠️  Explanation mentions "Row ${mentionedRow}"`);
        console.log(`     Actual rows affected (0-indexed): ${actualRows.join(', ')}`);
        console.log(`     Actual rows affected (1-indexed): ${actualRows.map(r => r+1).join(', ')}`);
        
        // Check if there's a mismatch
        if (!actualRows.includes(mentionedRow - 1) && !actualRows.includes(mentionedRow)) {
          console.log(`     ❌ MISMATCH! Mentioned row doesn't match affected rows!`);
        }
      }
      
      if (colMatch) {
        const mentionedCol = parseInt(colMatch[1]);
        const actualCols = [...new Set(hint.resultCells.map(c => c.col))];
        console.log(`  ⚠️  Explanation mentions "Column ${mentionedCol}"`);
        console.log(`     Actual cols affected (0-indexed): ${actualCols.join(', ')}`);
        console.log(`     Actual cols affected (1-indexed): ${actualCols.map(c => c+1).join(', ')}`);
        
        // Check if there's a mismatch
        if (!actualCols.includes(mentionedCol - 1) && !actualCols.includes(mentionedCol)) {
          console.log(`     ❌ MISMATCH! Mentioned column doesn't match affected columns!`);
        }
      }
      
      if (regionMatch) {
        const mentionedRegion = parseInt(regionMatch[1]);
        const actualRegions = [...new Set(hint.resultCells.map(c => EXAMPLE_REGIONS[c.row][c.col]))];
        console.log(`  ⚠️  Explanation mentions "region ${mentionedRegion}"`);
        console.log(`     Actual regions affected: ${actualRegions.join(', ')}`);
        
        if (!actualRegions.includes(mentionedRegion)) {
          console.log(`     ❌ MISMATCH! Mentioned region doesn't match affected regions!`);
        }
      }
      
      // If this is a star placement, check if it matches expected
      if (hint.kind === 'place-star') {
        const expectedSet = new Set(EXPECTED_STARS.map(([r, c]) => `${r},${c}`));
        const wrongStars = hint.resultCells.filter(c => !expectedSet.has(`${c.row},${c.col}`));
        if (wrongStars.length > 0) {
          console.log(`  ❌ WRONG STAR PLACEMENT:`, wrongStars.map(c => `[${c.row},${c.col}]`).join(', '));
        }
      }
    }
  });
});
